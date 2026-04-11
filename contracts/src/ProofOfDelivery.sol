// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

interface IVaultPayout {
    function payout(uint256 poolId, address recipient, uint256 amount, bytes32 payoutRef) external;
}

interface ICredential {
    function balanceOf(address owner) external view returns (uint256);
    function verifiedSince(address owner) external view returns (uint256);
}

/// @title ProofOfDelivery
/// @notice Multi-signal consensus system for automated aid reimbursement.
///         Collects independent attestations (oracle, peer NGO, beneficiary)
///         and auto-triggers payout when the weighted confidence score crosses
///         a governance-configurable threshold.  No human admin approves payouts.
contract ProofOfDelivery is AccessControl {

    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");

    // ── Signal types ──────────────────────────────────────────────────────
    enum SignalType { RECEIPT_ORACLE, GEO_ORACLE, PEER_ATTESTATION, BENEFICIARY }

    // ── Claim lifecycle ───────────────────────────────────────────────────
    struct Claim {
        uint256 poolId;
        address ngo;
        uint256 amount;
        bytes32 receiptRef;
        bytes32 geoHash;
        uint256 submittedAt;
        uint256 confidenceScore;  // basis points accumulated
        bool paid;
        uint8   beneficiaryCount; // how many beneficiaries have attested
        uint8   beneficiaryThreshold; // how many are required
    }

    // ── External contracts ────────────────────────────────────────────────
    IVaultPayout public immutable vault;
    ICredential  public immutable credential;

    // ── Configuration (governance-tunable) ─────────────────────────────────
    uint256 public payoutThreshold = 7500; // 75% default
    uint256 public claimExpiry = 7 days;
    uint256 public veteranAge = 180 days;    // verified > this → reduced threshold
    uint256 public veteranThreshold = 6000;  // 60% for veterans

    mapping(SignalType => uint256) public signalWeights;

    // ── State ─────────────────────────────────────────────────────────────
    uint256 public claimCount;
    mapping(uint256 claimId => Claim) public claims;
    mapping(uint256 claimId => mapping(SignalType => bool)) public signalAttested;
    mapping(uint256 claimId => mapping(address => bool)) public beneficiaryAttested;
    mapping(uint256 claimId => mapping(address => bool)) public peerAttested;
    mapping(address ngo => uint256) public successfulDeliveries;

    // Per-NGO daily cap tracking
    uint256 public dailyCap = 10_000_000_000; // $10,000 USDC per NGO per day
    mapping(address ngo => mapping(uint256 day => uint256 spent)) public dailySpend;

    // ── Events ────────────────────────────────────────────────────────────
    event ClaimSubmitted(uint256 indexed claimId, address indexed ngo, uint256 poolId, uint256 amount);
    event Attested(uint256 indexed claimId, SignalType indexed signalType, address indexed attestor, uint256 newScore);
    event AutoPayout(uint256 indexed claimId, address indexed ngo, uint256 amount, uint256 finalScore);
    event ClaimExpired(uint256 indexed claimId);

    // ── Errors ────────────────────────────────────────────────────────────
    error NotVerifiedNGO();
    error ClaimNotActive();
    error ClaimAlreadyPaid();
    error ClaimHasExpired();
    error AlreadyAttested();
    error InvalidAmount();
    error SelfAttestation();
    error DailyCapExceeded();
    error InvalidThreshold();

    constructor(address admin, address vaultAddr, address credentialAddr) {
        if (admin == address(0) || vaultAddr == address(0) || credentialAddr == address(0)) revert();

        vault = IVaultPayout(vaultAddr);
        credential = ICredential(credentialAddr);

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(GOVERNANCE_ROLE, admin);
        _grantRole(ORACLE_ROLE, admin);

        signalWeights[SignalType.RECEIPT_ORACLE]    = 2500;
        signalWeights[SignalType.GEO_ORACLE]        = 2500;
        signalWeights[SignalType.PEER_ATTESTATION]  = 2500;
        signalWeights[SignalType.BENEFICIARY]       = 2500;
    }

    // ── Submit claim ──────────────────────────────────────────────────────

    /// @notice NGO submits a delivery claim. Must hold a SoulboundCredential.
    function submitClaim(
        uint256 poolId,
        uint256 amount,
        bytes32 receiptRef,
        bytes32 geoHash,
        uint8   beneficiaryThreshold
    ) external returns (uint256 claimId) {
        if (credential.balanceOf(msg.sender) == 0) revert NotVerifiedNGO();
        if (amount == 0) revert InvalidAmount();

        // Daily cap check
        uint256 today = block.timestamp / 1 days;
        if (dailySpend[msg.sender][today] + amount > dailyCap) revert DailyCapExceeded();
        dailySpend[msg.sender][today] += amount;

        claimId = claimCount++;
        claims[claimId] = Claim({
            poolId: poolId,
            ngo: msg.sender,
            amount: amount,
            receiptRef: receiptRef,
            geoHash: geoHash,
            submittedAt: block.timestamp,
            confidenceScore: 0,
            paid: false,
            beneficiaryCount: 0,
            beneficiaryThreshold: beneficiaryThreshold > 0 ? beneficiaryThreshold : 1
        });

        emit ClaimSubmitted(claimId, msg.sender, poolId, amount);
    }

    // ── Oracle attestation ────────────────────────────────────────────────

    /// @notice Bridge service attests after automated verification (OCR, geo).
    function attestOracle(uint256 claimId, SignalType signalType) external onlyRole(ORACLE_ROLE) {
        Claim storage c = claims[claimId];
        _requireActiveClaim(c, claimId);

        if (signalType != SignalType.RECEIPT_ORACLE && signalType != SignalType.GEO_ORACLE) revert();
        if (signalAttested[claimId][signalType]) revert AlreadyAttested();

        signalAttested[claimId][signalType] = true;
        c.confidenceScore += signalWeights[signalType];

        emit Attested(claimId, signalType, msg.sender, c.confidenceScore);
        _checkAndPayout(claimId);
    }

    // ── Peer attestation ──────────────────────────────────────────────────

    /// @notice Another verified NGO vouches for this delivery.
    function attestPeer(uint256 claimId) external {
        Claim storage c = claims[claimId];
        _requireActiveClaim(c, claimId);

        if (credential.balanceOf(msg.sender) == 0) revert NotVerifiedNGO();
        if (msg.sender == c.ngo) revert SelfAttestation();
        if (peerAttested[claimId][msg.sender]) revert AlreadyAttested();
        if (signalAttested[claimId][SignalType.PEER_ATTESTATION]) revert AlreadyAttested();

        peerAttested[claimId][msg.sender] = true;
        signalAttested[claimId][SignalType.PEER_ATTESTATION] = true;
        c.confidenceScore += signalWeights[SignalType.PEER_ATTESTATION];

        emit Attested(claimId, SignalType.PEER_ATTESTATION, msg.sender, c.confidenceScore);
        _checkAndPayout(claimId);
    }

    // ── Beneficiary attestation ───────────────────────────────────────────

    /// @notice A beneficiary confirms they received aid for this claim.
    function attestBeneficiary(uint256 claimId) external {
        Claim storage c = claims[claimId];
        _requireActiveClaim(c, claimId);

        if (msg.sender == c.ngo) revert SelfAttestation();
        if (beneficiaryAttested[claimId][msg.sender]) revert AlreadyAttested();

        beneficiaryAttested[claimId][msg.sender] = true;
        c.beneficiaryCount++;

        // Only add weight once the threshold of beneficiaries is met
        if (c.beneficiaryCount == c.beneficiaryThreshold && !signalAttested[claimId][SignalType.BENEFICIARY]) {
            signalAttested[claimId][SignalType.BENEFICIARY] = true;
            c.confidenceScore += signalWeights[SignalType.BENEFICIARY];
        }

        emit Attested(claimId, SignalType.BENEFICIARY, msg.sender, c.confidenceScore);
        _checkAndPayout(claimId);
    }

    // ── Internal: auto-payout check ───────────────────────────────────────

    function _checkAndPayout(uint256 claimId) internal {
        Claim storage c = claims[claimId];
        if (c.paid) return;

        uint256 threshold = _effectiveThreshold(c.ngo);
        if (c.confidenceScore >= threshold) {
            c.paid = true;
            successfulDeliveries[c.ngo]++;
            vault.payout(c.poolId, c.ngo, c.amount, c.receiptRef);
            emit AutoPayout(claimId, c.ngo, c.amount, c.confidenceScore);
        }
    }

    function _effectiveThreshold(address ngo) internal view returns (uint256) {
        uint256 since = credential.verifiedSince(ngo);
        if (since > 0 && block.timestamp - since >= veteranAge) {
            return veteranThreshold;
        }
        return payoutThreshold;
    }

    function _requireActiveClaim(Claim storage c, uint256 claimId) internal view {
        if (c.submittedAt == 0) revert ClaimNotActive();
        if (c.paid) revert ClaimAlreadyPaid();
        if (block.timestamp > c.submittedAt + claimExpiry) revert ClaimHasExpired();
        // Silence unused variable warning — claimId used only for clarity at call sites
        (claimId);
    }

    // ── Governance setters ────────────────────────────────────────────────

    function setPayoutThreshold(uint256 bps) external onlyRole(GOVERNANCE_ROLE) {
        if (bps == 0 || bps > 10_000) revert InvalidThreshold();
        payoutThreshold = bps;
    }

    function setVeteranThreshold(uint256 bps) external onlyRole(GOVERNANCE_ROLE) {
        if (bps == 0 || bps > 10_000) revert InvalidThreshold();
        veteranThreshold = bps;
    }

    function setSignalWeight(SignalType signalType, uint256 bps) external onlyRole(GOVERNANCE_ROLE) {
        signalWeights[signalType] = bps;
    }

    function setDailyCap(uint256 cap) external onlyRole(GOVERNANCE_ROLE) {
        dailyCap = cap;
    }

    function setClaimExpiry(uint256 duration) external onlyRole(GOVERNANCE_ROLE) {
        claimExpiry = duration;
    }

    function setVeteranAge(uint256 duration) external onlyRole(GOVERNANCE_ROLE) {
        veteranAge = duration;
    }

    /// @notice View helper for frontends to check the effective threshold for an NGO.
    function getEffectiveThreshold(address ngo) external view returns (uint256) {
        return _effectiveThreshold(ngo);
    }
}

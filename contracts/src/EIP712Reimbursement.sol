// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

interface ICrisisPoolVault {
    function payout(uint256 poolId, address recipient, uint256 amount, bytes32 payoutRef) external;
}

/// @title EIP712Reimbursement
/// @notice Gasless reimbursement approvals via EIP-712 typed signatures.
///         An admin signs an approval off-chain; the NGO (or anyone) submits
///         the signature on-chain to trigger `CrisisPoolVault.payout()`.
contract EIP712Reimbursement is AccessControl, EIP712 {
    bytes32 public constant APPROVER_ROLE = keccak256("APPROVER_ROLE");

    ICrisisPoolVault public immutable vault;

    bytes32 private constant _APPROVAL_TYPEHASH = keccak256(
        "ReimbursementApproval(uint256 poolId,address recipient,uint256 amount,bytes32 payoutRef,uint256 nonce,uint256 deadline)"
    );

    /// @notice Monotonically increasing nonce per approver to prevent replay.
    mapping(address approver => uint256 nonce) public nonces;

    // ── Events ────────────────────────────────────────────────────────────
    event ApprovalExecuted(
        address indexed approver,
        address indexed recipient,
        uint256 indexed poolId,
        uint256 amount,
        uint256 nonce
    );

    // ── Errors ────────────────────────────────────────────────────────────
    error DeadlineExpired();
    error InvalidNonce();
    error SignerNotApprover();
    error InvalidSignature();

    constructor(address admin, address vaultAddress)
        EIP712("CrisisChainReimbursement", "1")
    {
        if (admin == address(0) || vaultAddress == address(0)) revert();
        vault = ICrisisPoolVault(vaultAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(APPROVER_ROLE, admin);
    }

    /// @notice Execute a reimbursement using an off-chain EIP-712 signature from an approver.
    /// @dev    Anyone can call this — the signature proves the approver authorized it.
    function executeApproval(
        uint256 poolId,
        address recipient,
        uint256 amount,
        bytes32 payoutRef,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external {
        if (block.timestamp > deadline) revert DeadlineExpired();

        bytes32 structHash = keccak256(abi.encode(
            _APPROVAL_TYPEHASH,
            poolId,
            recipient,
            amount,
            payoutRef,
            nonce,
            deadline
        ));

        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, signature);

        if (signer == address(0)) revert InvalidSignature();
        if (!hasRole(APPROVER_ROLE, signer)) revert SignerNotApprover();
        if (nonces[signer] != nonce) revert InvalidNonce();

        nonces[signer] = nonce + 1;

        vault.payout(poolId, recipient, amount, payoutRef);

        emit ApprovalExecuted(signer, recipient, poolId, amount, nonce);
    }

    /// @notice Returns the EIP-712 domain separator (useful for off-chain signers).
    function domainSeparatorV4() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /// @notice Returns the typehash for the ReimbursementApproval struct.
    function APPROVAL_TYPEHASH() external pure returns (bytes32) {
        return _APPROVAL_TYPEHASH;
    }
}

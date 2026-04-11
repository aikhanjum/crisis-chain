// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract CrisisPoolVault is AccessControl, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant PAYOUT_ROLE = keccak256("PAYOUT_ROLE");
    bytes32 public constant NGO_ROLE = keccak256("NGO_ROLE");
    IERC20 public immutable token;

    // ── Global distribution defaults ─────────────────────────────────────
    uint256 public cooldownPeriod = 48 hours;
    uint256 public minReserveBps = 1000;

    // ── Per-pool configuration ───────────────────────────────────────────
    struct PoolConfig {
        uint256 maxPayoutPerRequest; // 0 = no per-request cap
        uint256 cooldownOverride;    // 0 = use global cooldownPeriod
        uint256 reserveBpsOverride;  // 0 = use global minReserveBps
        bool configured;
    }

    mapping(uint256 poolId => PoolConfig) public poolConfigs;

    // ── On-chain reimbursement requests ──────────────────────────────────
    struct ReimbursementRequest {
        uint256 poolId;
        address ngo;
        uint256 amount;
        bytes32 receiptRef; // IPFS CID or off-chain reference
        bool executed;
    }

    uint256 public nextRequestId;
    mapping(uint256 requestId => ReimbursementRequest) public reimbursementRequests;

    // ── Core state ───────────────────────────────────────────────────────
    mapping(uint256 poolId => uint256 balance) public poolBalances;
    mapping(uint256 poolId => mapping(address recipient => uint256 timestamp)) public lastPayoutAt;

    // ── Events ───────────────────────────────────────────────────────────
    event Donation(
        uint256 indexed poolId,
        address indexed donor,
        uint256 amount,
        bytes32 indexed memo
    );

    event Payout(
        uint256 indexed poolId,
        address indexed recipient,
        uint256 amount,
        bytes32 indexed payoutRef
    );

    event CooldownPeriodUpdated(uint256 oldPeriod, uint256 newPeriod);
    event MinReserveBpsUpdated(uint256 oldBps, uint256 newBps);

    event PoolConfigured(
        uint256 indexed poolId,
        uint256 maxPayoutPerRequest,
        uint256 cooldownOverride,
        uint256 reserveBpsOverride
    );

    event ReimbursementRequested(
        uint256 indexed requestId,
        uint256 indexed poolId,
        address indexed ngo,
        uint256 amount,
        bytes32 receiptRef
    );

    event ReimbursementApproved(
        uint256 indexed requestId,
        uint256 indexed poolId,
        address indexed ngo,
        uint256 amount
    );

    // ── Errors ───────────────────────────────────────────────────────────
    error InvalidAddress();
    error InvalidAmount();
    error InsufficientPoolBalance(uint256 available, uint256 requested);
    error CooldownActive(address recipient, uint256 availableAt);
    error ReserveTooLow(uint256 poolBalance, uint256 requested, uint256 minReserve);
    error InvalidBps();
    error PayoutExceedsPoolMax(uint256 amount, uint256 max);
    error RequestAlreadyExecuted(uint256 requestId);
    error RequestNotFound(uint256 requestId);

    constructor(address admin, address tokenAddress) {
        if (admin == address(0) || tokenAddress == address(0)) {
            revert InvalidAddress();
        }

        token = IERC20(tokenAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAYOUT_ROLE, admin);
    }

    // ── Donor side ───────────────────────────────────────────────────────

    function donate(uint256 poolId, uint256 amount, bytes32 memo) external whenNotPaused {
        if (amount == 0) revert InvalidAmount();

        poolBalances[poolId] += amount;
        token.safeTransferFrom(msg.sender, address(this), amount);

        emit Donation(poolId, msg.sender, amount, memo);
    }

    // ── Direct payout (operator / admin) ─────────────────────────────────

    function payout(
        uint256 poolId,
        address recipient,
        uint256 amount,
        bytes32 payoutRef
    ) external whenNotPaused onlyRole(PAYOUT_ROLE) {
        _executePayout(poolId, recipient, amount, payoutRef, msg.sender);
    }

    // ── NGO reimbursement flow ───────────────────────────────────────────

    /// @notice NGO submits a reimbursement request on-chain. Does NOT move funds.
    function requestReimbursement(
        uint256 poolId,
        uint256 amount,
        bytes32 receiptRef
    ) external whenNotPaused onlyRole(NGO_ROLE) returns (uint256 requestId) {
        if (amount == 0) revert InvalidAmount();

        requestId = nextRequestId++;
        reimbursementRequests[requestId] = ReimbursementRequest({
            poolId: poolId,
            ngo: msg.sender,
            amount: amount,
            receiptRef: receiptRef,
            executed: false
        });

        emit ReimbursementRequested(requestId, poolId, msg.sender, amount, receiptRef);
    }

    /// @notice Operator/admin approves a pending request, executing the payout.
    function approveReimbursement(uint256 requestId) external whenNotPaused onlyRole(PAYOUT_ROLE) {
        ReimbursementRequest storage req = reimbursementRequests[requestId];
        if (req.ngo == address(0)) revert RequestNotFound(requestId);
        if (req.executed) revert RequestAlreadyExecuted(requestId);

        req.executed = true;
        _executePayout(req.poolId, req.ngo, req.amount, req.receiptRef, msg.sender);

        emit ReimbursementApproved(requestId, req.poolId, req.ngo, req.amount);
    }

    // ── Admin controls ───────────────────────────────────────────────────

    function configurePool(
        uint256 poolId,
        uint256 maxPayoutPerRequest,
        uint256 cooldownOverride,
        uint256 reserveBpsOverride
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (reserveBpsOverride > 10_000) revert InvalidBps();

        poolConfigs[poolId] = PoolConfig({
            maxPayoutPerRequest: maxPayoutPerRequest,
            cooldownOverride: cooldownOverride,
            reserveBpsOverride: reserveBpsOverride,
            configured: true
        });

        emit PoolConfigured(poolId, maxPayoutPerRequest, cooldownOverride, reserveBpsOverride);
    }

    function setCooldownPeriod(uint256 newPeriod) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emit CooldownPeriodUpdated(cooldownPeriod, newPeriod);
        cooldownPeriod = newPeriod;
    }

    function setMinReserveBps(uint256 newBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newBps > 10_000) revert InvalidBps();
        emit MinReserveBpsUpdated(minReserveBps, newBps);
        minReserveBps = newBps;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // ── Internal payout logic ────────────────────────────────────────────

    function _executePayout(
        uint256 poolId,
        address recipient,
        uint256 amount,
        bytes32 payoutRef,
        address caller
    ) internal {
        if (recipient == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();

        uint256 currentBalance = poolBalances[poolId];
        if (amount > currentBalance) {
            revert InsufficientPoolBalance(currentBalance, amount);
        }

        PoolConfig storage cfg = poolConfigs[poolId];
        bool isAdmin = hasRole(DEFAULT_ADMIN_ROLE, caller);

        // Per-pool max payout cap (admin bypasses)
        if (!isAdmin && cfg.configured && cfg.maxPayoutPerRequest > 0) {
            if (amount > cfg.maxPayoutPerRequest) {
                revert PayoutExceedsPoolMax(amount, cfg.maxPayoutPerRequest);
            }
        }

        // Cooldown: per-pool override or global (admin bypasses).
        // Skip check when recipient has never received a payout (lastPayoutAt == 0).
        if (!isAdmin) {
            uint256 lastPayout = lastPayoutAt[poolId][recipient];
            if (lastPayout > 0) {
                uint256 cd = (cfg.configured && cfg.cooldownOverride > 0)
                    ? cfg.cooldownOverride
                    : cooldownPeriod;
                uint256 availableAt = lastPayout + cd;
                if (block.timestamp < availableAt) {
                    revert CooldownActive(recipient, availableAt);
                }
            }
        }

        // Min reserve: per-pool override or global (admin bypasses)
        if (!isAdmin) {
            uint256 bps = (cfg.configured && cfg.reserveBpsOverride > 0)
                ? cfg.reserveBpsOverride
                : minReserveBps;
            uint256 minReserve = (currentBalance * bps) / 10_000;
            if (currentBalance - amount < minReserve) {
                revert ReserveTooLow(currentBalance, amount, minReserve);
            }
        }

        lastPayoutAt[poolId][recipient] = block.timestamp;
        poolBalances[poolId] = currentBalance - amount;
        token.safeTransfer(recipient, amount);

        emit Payout(poolId, recipient, amount, payoutRef);
    }
}

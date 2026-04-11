// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract CrisisPoolVault is AccessControl, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant PAYOUT_ROLE = keccak256("PAYOUT_ROLE");
    IERC20 public immutable token;

    // ── Distribution rules ───────────────────────────────────────────────
    /// @notice Minimum seconds between payouts to the same recipient per pool.
    ///         DEFAULT_ADMIN_ROLE callers bypass this check for emergencies.
    uint256 public cooldownPeriod = 48 hours;

    /// @notice Basis points of pool balance that must remain after any payout.
    ///         1000 bps = 10%. Prevents a pool from being fully drained.
    ///         DEFAULT_ADMIN_ROLE callers bypass this check for emergencies.
    uint256 public minReserveBps = 1000;

    // ── State ────────────────────────────────────────────────────────────
    mapping(uint256 poolId => uint256 balance) public poolBalances;

    /// @notice Last payout timestamp per recipient per pool.
    ///         Used to enforce the per-NGO cooldown window.
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

    // ── Errors ───────────────────────────────────────────────────────────
    error InvalidAddress();
    error InvalidAmount();
    error InsufficientPoolBalance(uint256 available, uint256 requested);
    /// @param recipient The NGO address still in cooldown.
    /// @param availableAt Unix timestamp when the next payout is allowed.
    error CooldownActive(address recipient, uint256 availableAt);
    /// @param poolBalance Current pool balance.
    /// @param requested   Amount requested for payout.
    /// @param minReserve  Minimum balance that must remain (poolBalance * minReserveBps / 10000).
    error ReserveTooLow(uint256 poolBalance, uint256 requested, uint256 minReserve);
    error InvalidBps();

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

    // ── NGO side ─────────────────────────────────────────────────────────

    function payout(
        uint256 poolId,
        address recipient,
        uint256 amount,
        bytes32 payoutRef
    ) external whenNotPaused onlyRole(PAYOUT_ROLE) {
        if (recipient == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();

        uint256 currentBalance = poolBalances[poolId];
        if (amount > currentBalance) {
            revert InsufficientPoolBalance(currentBalance, amount);
        }

        // Rule 2: 48-hour cooldown per recipient per pool.
        // Admin bypasses so emergency payouts are never blocked.
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            uint256 availableAt = lastPayoutAt[poolId][recipient] + cooldownPeriod;
            if (block.timestamp < availableAt) {
                revert CooldownActive(recipient, availableAt);
            }
        }

        // Rule 3: minimum reserve — pool must retain minReserveBps after payout.
        // Admin bypasses for the same reason.
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            uint256 minReserve = (currentBalance * minReserveBps) / 10_000;
            if (currentBalance - amount < minReserve) {
                revert ReserveTooLow(currentBalance, amount, minReserve);
            }
        }

        lastPayoutAt[poolId][recipient] = block.timestamp;
        poolBalances[poolId] = currentBalance - amount;
        token.safeTransfer(recipient, amount);

        emit Payout(poolId, recipient, amount, payoutRef);
    }

    // ── Admin controls ───────────────────────────────────────────────────

    /// @notice Update the cooldown period between payouts to the same recipient.
    function setCooldownPeriod(uint256 newPeriod) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emit CooldownPeriodUpdated(cooldownPeriod, newPeriod);
        cooldownPeriod = newPeriod;
    }

    /// @notice Update the minimum reserve ratio. Must be <= 10000 bps (100%).
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
}

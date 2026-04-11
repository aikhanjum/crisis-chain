// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

interface ICrisisPoolVaultDonatable {
    function donate(uint256 poolId, uint256 amount, bytes32 memo) external;
}

/// @title YieldVault
/// @notice ERC-4626 tokenized vault that wraps USDC.
///         Donors deposit USDC and receive share tokens.  Idle funds accrue
///         yield (simulated via `accrueYield`).  Admin can allocate vault
///         assets to a CrisisPoolVault pool when crisis funds are needed.
contract YieldVault is ERC4626, AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant STRATEGIST_ROLE = keccak256("STRATEGIST_ROLE");

    IERC20 private immutable _underlying;

    // ── Events ────────────────────────────────────────────────────────────
    event YieldAccrued(uint256 amount, uint256 newTotalAssets);
    event AllocatedToCrisis(address indexed vault, uint256 indexed poolId, uint256 amount);

    // ── Errors ────────────────────────────────────────────────────────────
    error InvalidAddress();
    error InvalidAmount();

    constructor(address admin, IERC20 asset_)
        ERC20("CrisisChain Yield Shares", "ccYS")
        ERC4626(asset_)
    {
        if (admin == address(0)) revert InvalidAddress();
        _underlying = asset_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(STRATEGIST_ROLE, admin);
    }

    /// @notice Simulate yield accrual by minting new underlying tokens into the vault.
    ///         In production this would come from a lending protocol (Aave, Compound, etc.).
    ///         For the demo we use MockUSDC.mint() externally, then call this to account for it.
    ///         Alternatively, the caller can transfer tokens then call this as a no-op accounting trigger.
    /// @dev    The caller must transfer `amount` of the underlying asset to this contract
    ///         before calling (or use a mintable mock).  `totalAssets()` increases automatically
    ///         because it reads the contract's token balance.
    function accrueYield(uint256 amount) external onlyRole(STRATEGIST_ROLE) {
        if (amount == 0) revert InvalidAmount();
        // Pull yield tokens from caller into the vault
        _underlying.safeTransferFrom(msg.sender, address(this), amount);
        emit YieldAccrued(amount, totalAssets());
    }

    /// @notice Move `amount` of underlying from the yield vault into a CrisisPoolVault pool.
    ///         This effectively "deploys" idle donations to an active crisis.
    function allocateToCrisis(
        address crisisVault,
        uint256 poolId,
        uint256 amount,
        bytes32 memo
    ) external onlyRole(STRATEGIST_ROLE) {
        if (crisisVault == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();

        // Approve and donate into the crisis vault's pool
        _underlying.forceApprove(crisisVault, amount);
        ICrisisPoolVaultDonatable(crisisVault).donate(poolId, amount, memo);

        emit AllocatedToCrisis(crisisVault, poolId, amount);
    }
}

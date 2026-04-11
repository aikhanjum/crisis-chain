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

    mapping(uint256 poolId => uint256 balance) public poolBalances;

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

    error InvalidAddress();
    error InvalidAmount();
    error InsufficientPoolBalance(uint256 available, uint256 requested);

    constructor(address admin, address tokenAddress) {
        if (admin == address(0) || tokenAddress == address(0)) {
            revert InvalidAddress();
        }

        token = IERC20(tokenAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAYOUT_ROLE, admin);
    }

    function donate(uint256 poolId, uint256 amount, bytes32 memo) external whenNotPaused {
        if (amount == 0) {
            revert InvalidAmount();
        }

        poolBalances[poolId] += amount;
        token.safeTransferFrom(msg.sender, address(this), amount);

        emit Donation(poolId, msg.sender, amount, memo);
    }

    function payout(
        uint256 poolId,
        address recipient,
        uint256 amount,
        bytes32 payoutRef
    ) external whenNotPaused onlyRole(PAYOUT_ROLE) {
        if (recipient == address(0)) {
            revert InvalidAddress();
        }
        if (amount == 0) {
            revert InvalidAmount();
        }

        uint256 currentBalance = poolBalances[poolId];
        if (amount > currentBalance) {
            revert InsufficientPoolBalance(currentBalance, amount);
        }

        poolBalances[poolId] = currentBalance - amount;
        token.safeTransfer(recipient, amount);

        emit Payout(poolId, recipient, amount, payoutRef);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}

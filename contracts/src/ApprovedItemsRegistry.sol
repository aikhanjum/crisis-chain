// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title ApprovedItemsRegistry
/// @notice On-chain whitelist of approved supply categories with price caps.
///         Governance-updatable (multisig-friendly). Other contracts can check
///         whether an item keyword is approved and enforce price limits.
contract ApprovedItemsRegistry is AccessControl {
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");

    struct Item {
        bool approved;
        uint256 maxPricePerUnit; // 6-decimal USDC
    }

    mapping(bytes32 keyword => Item) public items;
    bytes32[] public itemKeys;

    // ── Events ────────────────────────────────────────────────────────────
    event ItemAdded(bytes32 indexed keyword, uint256 maxPricePerUnit);
    event ItemRemoved(bytes32 indexed keyword);
    event PriceUpdated(bytes32 indexed keyword, uint256 oldPrice, uint256 newPrice);

    // ── Errors ────────────────────────────────────────────────────────────
    error AlreadyApproved();
    error NotApproved();
    error InvalidPrice();

    constructor(address admin) {
        if (admin == address(0)) revert();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(GOVERNANCE_ROLE, admin);
    }

    function addItem(bytes32 keyword, uint256 maxPricePerUnit)
        external
        onlyRole(GOVERNANCE_ROLE)
    {
        if (items[keyword].approved) revert AlreadyApproved();
        if (maxPricePerUnit == 0) revert InvalidPrice();

        items[keyword] = Item({approved: true, maxPricePerUnit: maxPricePerUnit});
        itemKeys.push(keyword);
        emit ItemAdded(keyword, maxPricePerUnit);
    }

    function removeItem(bytes32 keyword) external onlyRole(GOVERNANCE_ROLE) {
        if (!items[keyword].approved) revert NotApproved();
        items[keyword].approved = false;
        emit ItemRemoved(keyword);
    }

    function updateMaxPrice(bytes32 keyword, uint256 newPrice)
        external
        onlyRole(GOVERNANCE_ROLE)
    {
        if (!items[keyword].approved) revert NotApproved();
        if (newPrice == 0) revert InvalidPrice();
        uint256 oldPrice = items[keyword].maxPricePerUnit;
        items[keyword].maxPricePerUnit = newPrice;
        emit PriceUpdated(keyword, oldPrice, newPrice);
    }

    function isApproved(bytes32 keyword) external view returns (bool) {
        return items[keyword].approved;
    }

    function getMaxPrice(bytes32 keyword) external view returns (uint256) {
        return items[keyword].maxPricePerUnit;
    }

    function itemCount() external view returns (uint256) {
        return itemKeys.length;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ApprovedItemsRegistry} from "src/ApprovedItemsRegistry.sol";

contract ApprovedItemsRegistryTest is Test {
    ApprovedItemsRegistry internal registry;

    address internal admin = makeAddr("admin");
    address internal rando = makeAddr("rando");

    bytes32 internal constant RICE = bytes32("rice");
    bytes32 internal constant WATER = bytes32("water_filter");
    uint256 internal constant RICE_PRICE = 50_000_000;  // $50 USDC max per unit
    uint256 internal constant WATER_PRICE = 200_000_000; // $200 USDC max

    function setUp() external {
        registry = new ApprovedItemsRegistry(admin);
    }

    // ── Add items ─────────────────────────────────────────────────────────

    function testAddItemStoresData() external {
        vm.prank(admin);
        registry.addItem(RICE, RICE_PRICE);

        assertTrue(registry.isApproved(RICE));
        assertEq(registry.getMaxPrice(RICE), RICE_PRICE);
        assertEq(registry.itemCount(), 1);
    }

    function testAddMultipleItems() external {
        vm.startPrank(admin);
        registry.addItem(RICE, RICE_PRICE);
        registry.addItem(WATER, WATER_PRICE);
        vm.stopPrank();

        assertTrue(registry.isApproved(RICE));
        assertTrue(registry.isApproved(WATER));
        assertEq(registry.itemCount(), 2);
    }

    function testAddItemRevertsIfAlreadyApproved() external {
        vm.prank(admin);
        registry.addItem(RICE, RICE_PRICE);

        vm.prank(admin);
        vm.expectRevert(ApprovedItemsRegistry.AlreadyApproved.selector);
        registry.addItem(RICE, RICE_PRICE);
    }

    function testAddItemRevertsForZeroPrice() external {
        vm.prank(admin);
        vm.expectRevert(ApprovedItemsRegistry.InvalidPrice.selector);
        registry.addItem(RICE, 0);
    }

    function testAddItemRevertsForNonGovernance() external {
        vm.prank(rando);
        vm.expectRevert();
        registry.addItem(RICE, RICE_PRICE);
    }

    // ── Remove items ──────────────────────────────────────────────────────

    function testRemoveItem() external {
        vm.prank(admin);
        registry.addItem(RICE, RICE_PRICE);

        vm.prank(admin);
        registry.removeItem(RICE);

        assertFalse(registry.isApproved(RICE));
    }

    function testRemoveItemRevertsIfNotApproved() external {
        vm.prank(admin);
        vm.expectRevert(ApprovedItemsRegistry.NotApproved.selector);
        registry.removeItem(RICE);
    }

    // ── Update price ──────────────────────────────────────────────────────

    function testUpdateMaxPrice() external {
        vm.prank(admin);
        registry.addItem(RICE, RICE_PRICE);

        uint256 newPrice = 75_000_000;
        vm.prank(admin);
        registry.updateMaxPrice(RICE, newPrice);

        assertEq(registry.getMaxPrice(RICE), newPrice);
    }

    function testUpdatePriceRevertsIfNotApproved() external {
        vm.prank(admin);
        vm.expectRevert(ApprovedItemsRegistry.NotApproved.selector);
        registry.updateMaxPrice(RICE, 100);
    }

    function testUpdatePriceRevertsForZero() external {
        vm.prank(admin);
        registry.addItem(RICE, RICE_PRICE);

        vm.prank(admin);
        vm.expectRevert(ApprovedItemsRegistry.InvalidPrice.selector);
        registry.updateMaxPrice(RICE, 0);
    }

    // ── View functions ────────────────────────────────────────────────────

    function testIsApprovedReturnsFalseForUnknown() external view {
        assertFalse(registry.isApproved(bytes32("nonexistent")));
    }

    function testGetMaxPriceReturnsZeroForUnknown() external view {
        assertEq(registry.getMaxPrice(bytes32("nonexistent")), 0);
    }
}

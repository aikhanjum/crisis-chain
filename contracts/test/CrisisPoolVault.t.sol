// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {CrisisPoolVault} from "src/CrisisPoolVault.sol";
import {MockUSDC} from "src/MockUSDC.sol";

contract CrisisPoolVaultTest is Test {
    MockUSDC internal usdc;
    CrisisPoolVault internal vault;

    address internal admin = makeAddr("admin");
    address internal donor = makeAddr("donor");
    address internal ngo = makeAddr("ngo");

    uint256 internal constant POOL_ID = 1;

    function setUp() external {
        usdc = new MockUSDC();
        vault = new CrisisPoolVault(admin, address(usdc));

        usdc.mint(donor, 1_000_000_000); // 1,000 USDC with 6 decimals
    }

    function testDonateIncreasesPoolBalanceAndVaultBalance() external {
        vm.startPrank(donor);
        usdc.approve(address(vault), 250_000_000);
        vault.donate(POOL_ID, 250_000_000, bytes32("donation-1"));
        vm.stopPrank();

        assertEq(vault.poolBalances(POOL_ID), 250_000_000);
        assertEq(usdc.balanceOf(address(vault)), 250_000_000);
        assertEq(usdc.balanceOf(donor), 750_000_000);
    }

    function testPayoutReducesPoolAndTransfersToRecipient() external {
        vm.prank(donor);
        usdc.approve(address(vault), 500_000_000);
        vm.prank(donor);
        vault.donate(POOL_ID, 500_000_000, bytes32("donation-2"));

        vm.prank(admin);
        vault.payout(POOL_ID, ngo, 150_000_000, bytes32("payout-1"));

        assertEq(vault.poolBalances(POOL_ID), 350_000_000);
        assertEq(usdc.balanceOf(ngo), 150_000_000);
        assertEq(usdc.balanceOf(address(vault)), 350_000_000);
    }

    function testUnauthorizedPayoutReverts() external {
        vm.prank(donor);
        usdc.approve(address(vault), 100_000_000);
        vm.prank(donor);
        vault.donate(POOL_ID, 100_000_000, bytes32("donation-3"));

        vm.prank(donor);
        vm.expectRevert();
        vault.payout(POOL_ID, donor, 10_000_000, bytes32("bad-payout"));
    }

    function testPauseBlocksDonateAndPayout() external {
        vm.prank(donor);
        usdc.approve(address(vault), 100_000_000);
        vm.prank(donor);
        vault.donate(POOL_ID, 100_000_000, bytes32("donation-4"));

        vm.prank(admin);
        vault.pause();

        vm.startPrank(donor);
        vm.expectRevert();
        vault.donate(POOL_ID, 1, bytes32("blocked-donation"));
        vm.stopPrank();

        vm.prank(admin);
        vm.expectRevert();
        vault.payout(POOL_ID, ngo, 1, bytes32("blocked-payout"));
    }
}

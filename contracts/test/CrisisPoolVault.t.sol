// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {CrisisPoolVault} from "src/CrisisPoolVault.sol";
import {MockUSDC} from "src/MockUSDC.sol";

contract CrisisPoolVaultTest is Test {
    MockUSDC internal usdc;
    CrisisPoolVault internal vault;

    address internal admin  = makeAddr("admin");
    address internal donor  = makeAddr("donor");
    address internal ngo    = makeAddr("ngo");
    address internal ngo2   = makeAddr("ngo2");
    // operator has PAYOUT_ROLE but NOT DEFAULT_ADMIN_ROLE — used to test rule enforcement
    address internal operator = makeAddr("operator");

    uint256 internal constant POOL_ID = 1;
    // 1,000 USDC (6 decimals)
    uint256 internal constant INITIAL_MINT = 1_000_000_000;

    function setUp() external {
        vm.warp(1_000_000);

        usdc = new MockUSDC();
        vault = new CrisisPoolVault(admin, address(usdc));

        usdc.mint(donor, INITIAL_MINT);

        // Give operator PAYOUT_ROLE so we can test rules without admin bypass.
        // Use startPrank so the nested vault.PAYOUT_ROLE() view call doesn't consume the prank.
        vm.startPrank(admin);
        vault.grantRole(vault.PAYOUT_ROLE(), operator);
        vm.stopPrank();
    }

    // ── Helper ───────────────────────────────────────────────────────────

    function _donate(uint256 amount) internal {
        vm.startPrank(donor);
        usdc.approve(address(vault), amount);
        vault.donate(POOL_ID, amount, bytes32("donation"));
        vm.stopPrank();
    }

    // ── Existing tests (unchanged behaviour) ─────────────────────────────

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
        _donate(500_000_000);

        // admin bypasses both rules, so this must succeed unchanged
        vm.prank(admin);
        vault.payout(POOL_ID, ngo, 150_000_000, bytes32("payout-1"));

        assertEq(vault.poolBalances(POOL_ID), 350_000_000);
        assertEq(usdc.balanceOf(ngo), 150_000_000);
        assertEq(usdc.balanceOf(address(vault)), 350_000_000);
    }

    function testUnauthorizedPayoutReverts() external {
        _donate(100_000_000);

        vm.prank(donor);
        vm.expectRevert();
        vault.payout(POOL_ID, donor, 10_000_000, bytes32("bad-payout"));
    }

    function testPauseBlocksDonateAndPayout() external {
        _donate(100_000_000);

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

    // ── Rule 2: cooldown ─────────────────────────────────────────────────

    function testCooldownBlocksSecondPayoutToSameRecipient() external {
        // Pool: 1000 USDC. First payout of 100 USDC succeeds.
        _donate(1_000_000_000);

        vm.prank(operator);
        vault.payout(POOL_ID, ngo, 100_000_000, bytes32("payout-a"));

        // Immediate second payout to the same ngo must revert with CooldownActive.
        // Cache cooldownPeriod before prank so the view call doesn't consume it.
        uint256 cooldown = vault.cooldownPeriod();
        vm.prank(operator);
        vm.expectRevert(
            abi.encodeWithSelector(
                CrisisPoolVault.CooldownActive.selector,
                ngo,
                block.timestamp + cooldown
            )
        );
        vault.payout(POOL_ID, ngo, 100_000_000, bytes32("payout-b"));
    }

    function testCooldownDoesNotBlockDifferentRecipient() external {
        // After paying ngo, operator can immediately pay ngo2 (different recipient).
        _donate(1_000_000_000);

        vm.prank(operator);
        vault.payout(POOL_ID, ngo, 100_000_000, bytes32("payout-ngo1"));

        vm.prank(operator);
        vault.payout(POOL_ID, ngo2, 100_000_000, bytes32("payout-ngo2"));

        assertEq(usdc.balanceOf(ngo),  100_000_000);
        assertEq(usdc.balanceOf(ngo2), 100_000_000);
    }

    function testCooldownAllowsPayoutAfterPeriodElapses() external {
        _donate(1_000_000_000);

        vm.prank(operator);
        vault.payout(POOL_ID, ngo, 100_000_000, bytes32("payout-1"));

        // Warp past the cooldown window.
        vm.warp(block.timestamp + vault.cooldownPeriod() + 1);

        vm.prank(operator);
        vault.payout(POOL_ID, ngo, 100_000_000, bytes32("payout-2"));

        assertEq(usdc.balanceOf(ngo), 200_000_000);
    }

    function testAdminBypassesCooldown() external {
        // Admin can call payout twice in a row to the same recipient with no delay.
        _donate(1_000_000_000);

        vm.prank(admin);
        vault.payout(POOL_ID, ngo, 100_000_000, bytes32("admin-payout-1"));

        vm.prank(admin);
        vault.payout(POOL_ID, ngo, 100_000_000, bytes32("admin-payout-2"));

        assertEq(usdc.balanceOf(ngo), 200_000_000);
    }

    function testSetCooldownPeriod() external {
        vm.prank(admin);
        vault.setCooldownPeriod(1 hours);
        assertEq(vault.cooldownPeriod(), 1 hours);
    }

    // ── Rule 3: minimum reserve ──────────────────────────────────────────

    function testReserveBlocksPayoutThatWouldDrainPool() external {
        // Pool: 1000 USDC. minReserveBps = 1000 (10%) → must keep 100 USDC.
        // Requesting 901 USDC leaves only 99, which is below the 100 USDC reserve.
        _donate(1_000_000_000);

        uint256 tooMuch = 901_000_000; // leaves 99 USDC < 10% reserve
        uint256 minReserve = (1_000_000_000 * vault.minReserveBps()) / 10_000;

        vm.prank(operator);
        vm.expectRevert(
            abi.encodeWithSelector(
                CrisisPoolVault.ReserveTooLow.selector,
                1_000_000_000,
                tooMuch,
                minReserve
            )
        );
        vault.payout(POOL_ID, ngo, tooMuch, bytes32("too-large"));
    }

    function testReserveAllowsPayoutUpToLimit() external {
        // Requesting exactly 90% (900 USDC) leaves exactly 10% — should succeed.
        _donate(1_000_000_000);

        vm.prank(operator);
        vault.payout(POOL_ID, ngo, 900_000_000, bytes32("max-allowed"));

        assertEq(vault.poolBalances(POOL_ID), 100_000_000);
        assertEq(usdc.balanceOf(ngo), 900_000_000);
    }

    function testAdminBypassesReserve() external {
        // Admin can drain the pool entirely (emergency use).
        _donate(1_000_000_000);

        vm.prank(admin);
        vault.payout(POOL_ID, ngo, 1_000_000_000, bytes32("full-drain"));

        assertEq(vault.poolBalances(POOL_ID), 0);
        assertEq(usdc.balanceOf(ngo), 1_000_000_000);
    }

    function testSetMinReserveBps() external {
        vm.prank(admin);
        vault.setMinReserveBps(2000); // raise reserve to 20%
        assertEq(vault.minReserveBps(), 2000);
    }

    function testSetMinReserveBpsRevertsIfOver10000() external {
        vm.prank(admin);
        vm.expectRevert(CrisisPoolVault.InvalidBps.selector);
        vault.setMinReserveBps(10_001);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {CrisisPoolVault} from "src/CrisisPoolVault.sol";
import {MockUSDC} from "src/MockUSDC.sol";

contract CrisisPoolVaultTest is Test {
    MockUSDC internal usdc;
    CrisisPoolVault internal vault;

    address internal admin    = makeAddr("admin");
    address internal donor    = makeAddr("donor");
    address internal ngo      = makeAddr("ngo");
    address internal ngo2     = makeAddr("ngo2");
    address internal operator = makeAddr("operator");

    bytes32 internal PAYOUT_ROLE;
    bytes32 internal NGO_ROLE;

    uint256 internal constant POOL_ID = 1;
    uint256 internal constant INITIAL_MINT = 1_000_000_000; // 1,000 USDC (6 decimals)

    function setUp() external {
        usdc = new MockUSDC();
        vault = new CrisisPoolVault(admin, address(usdc));

        PAYOUT_ROLE = vault.PAYOUT_ROLE();
        NGO_ROLE = vault.NGO_ROLE();

        usdc.mint(donor, INITIAL_MINT);

        vm.startPrank(admin);
        vault.grantRole(PAYOUT_ROLE, operator);
        vault.grantRole(NGO_ROLE, ngo);
        vault.grantRole(NGO_ROLE, ngo2);
        vm.stopPrank();
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    function _donate(uint256 amount) internal {
        vm.startPrank(donor);
        usdc.approve(address(vault), amount);
        vault.donate(POOL_ID, amount, bytes32("donation"));
        vm.stopPrank();
    }

    // ═════════════════════════════════════════════════════════════════════
    //  Original tests (backward compatibility)
    // ═════════════════════════════════════════════════════════════════════

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

    // ── Cooldown tests ───────────────────────────────────────────────────

    function testCooldownBlocksSecondPayoutToSameRecipient() external {
        _donate(1_000_000_000);

        vm.prank(operator);
        vault.payout(POOL_ID, ngo, 100_000_000, bytes32("payout-a"));

        uint256 cd = vault.cooldownPeriod();
        uint256 availableAt = block.timestamp + cd;

        vm.prank(operator);
        vm.expectRevert(
            abi.encodeWithSelector(
                CrisisPoolVault.CooldownActive.selector,
                ngo,
                availableAt
            )
        );
        vault.payout(POOL_ID, ngo, 100_000_000, bytes32("payout-b"));
    }

    function testCooldownDoesNotBlockDifferentRecipient() external {
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

        vm.warp(block.timestamp + vault.cooldownPeriod() + 1);

        vm.prank(operator);
        vault.payout(POOL_ID, ngo, 100_000_000, bytes32("payout-2"));

        assertEq(usdc.balanceOf(ngo), 200_000_000);
    }

    function testAdminBypassesCooldown() external {
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

    // ── Reserve tests ────────────────────────────────────────────────────

    function testReserveBlocksPayoutThatWouldDrainPool() external {
        _donate(1_000_000_000);

        uint256 tooMuch = 901_000_000;
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
        _donate(1_000_000_000);

        vm.prank(operator);
        vault.payout(POOL_ID, ngo, 900_000_000, bytes32("max-allowed"));

        assertEq(vault.poolBalances(POOL_ID), 100_000_000);
        assertEq(usdc.balanceOf(ngo), 900_000_000);
    }

    function testAdminBypassesReserve() external {
        _donate(1_000_000_000);

        vm.prank(admin);
        vault.payout(POOL_ID, ngo, 1_000_000_000, bytes32("full-drain"));

        assertEq(vault.poolBalances(POOL_ID), 0);
        assertEq(usdc.balanceOf(ngo), 1_000_000_000);
    }

    function testSetMinReserveBps() external {
        vm.prank(admin);
        vault.setMinReserveBps(2000);
        assertEq(vault.minReserveBps(), 2000);
    }

    function testSetMinReserveBpsRevertsIfOver10000() external {
        vm.prank(admin);
        vm.expectRevert(CrisisPoolVault.InvalidBps.selector);
        vault.setMinReserveBps(10_001);
    }

    // ═════════════════════════════════════════════════════════════════════
    //  Per-pool configuration
    // ═════════════════════════════════════════════════════════════════════

    function testConfigurePoolSetsValues() external {
        vm.prank(admin);
        vault.configurePool(POOL_ID, 200_000_000, 12 hours, 2000);

        (uint256 maxPayout, uint256 cd, uint256 reserve, bool configured) =
            vault.poolConfigs(POOL_ID);
        assertEq(maxPayout, 200_000_000);
        assertEq(cd, 12 hours);
        assertEq(reserve, 2000);
        assertTrue(configured);
    }

    function testConfigurePoolRevertsForNonAdmin() external {
        vm.prank(operator);
        vm.expectRevert();
        vault.configurePool(POOL_ID, 200_000_000, 12 hours, 2000);
    }

    function testConfigurePoolRevertsForInvalidBps() external {
        vm.prank(admin);
        vm.expectRevert(CrisisPoolVault.InvalidBps.selector);
        vault.configurePool(POOL_ID, 0, 0, 10_001);
    }

    function testPoolMaxPayoutCapsOperatorPayout() external {
        _donate(1_000_000_000);

        vm.prank(admin);
        vault.configurePool(POOL_ID, 200_000_000, 0, 0);

        vm.prank(operator);
        vm.expectRevert(
            abi.encodeWithSelector(
                CrisisPoolVault.PayoutExceedsPoolMax.selector,
                300_000_000,
                200_000_000
            )
        );
        vault.payout(POOL_ID, ngo, 300_000_000, bytes32("too-big"));
    }

    function testPoolMaxPayoutAllowsUnderLimit() external {
        _donate(1_000_000_000);

        vm.prank(admin);
        vault.configurePool(POOL_ID, 200_000_000, 0, 0);

        vm.prank(operator);
        vault.payout(POOL_ID, ngo, 200_000_000, bytes32("under-cap"));

        assertEq(usdc.balanceOf(ngo), 200_000_000);
    }

    function testAdminBypassesPoolMaxPayout() external {
        _donate(1_000_000_000);

        vm.prank(admin);
        vault.configurePool(POOL_ID, 200_000_000, 0, 0);

        vm.prank(admin);
        vault.payout(POOL_ID, ngo, 500_000_000, bytes32("admin-big"));

        assertEq(usdc.balanceOf(ngo), 500_000_000);
    }

    function testPoolCooldownOverridesGlobal() external {
        _donate(1_000_000_000);

        vm.prank(admin);
        vault.configurePool(POOL_ID, 0, 1 hours, 0);

        vm.prank(operator);
        vault.payout(POOL_ID, ngo, 100_000_000, bytes32("p1"));

        // Global cooldown is 48h but pool override is 1h -- warp 2h
        vm.warp(block.timestamp + 2 hours);

        vm.prank(operator);
        vault.payout(POOL_ID, ngo, 100_000_000, bytes32("p2"));

        assertEq(usdc.balanceOf(ngo), 200_000_000);
    }

    function testPoolReserveOverridesGlobal() external {
        _donate(1_000_000_000);

        // Pool reserve = 20% (global is 10%)
        vm.prank(admin);
        vault.configurePool(POOL_ID, 0, 0, 2000);

        // 810M leaves 190M = 19% of 1000M -- below 20%
        vm.prank(operator);
        vm.expectRevert(
            abi.encodeWithSelector(
                CrisisPoolVault.ReserveTooLow.selector,
                1_000_000_000,
                810_000_000,
                200_000_000
            )
        );
        vault.payout(POOL_ID, ngo, 810_000_000, bytes32("over-reserve"));

        // 800M leaves 200M = exactly 20% -- should pass
        vm.prank(operator);
        vault.payout(POOL_ID, ngo, 800_000_000, bytes32("at-reserve"));

        assertEq(usdc.balanceOf(ngo), 800_000_000);
    }

    function testUnconfiguredPoolUsesGlobals() external {
        uint256 otherPool = 99;
        _donate(1_000_000_000);

        // Donate to another pool
        vm.startPrank(donor);
        usdc.mint(donor, 1_000_000_000);
        usdc.approve(address(vault), 1_000_000_000);
        vault.donate(otherPool, 1_000_000_000, bytes32("other"));
        vm.stopPrank();

        // Pool 99 has no config -- uses global 10% reserve
        vm.prank(operator);
        vault.payout(otherPool, ngo, 900_000_000, bytes32("global-rules"));

        assertEq(usdc.balanceOf(ngo), 900_000_000);
    }

    // ═════════════════════════════════════════════════════════════════════
    //  NGO reimbursement requests
    // ═════════════════════════════════════════════════════════════════════

    function testNgoCanRequestReimbursement() external {
        _donate(1_000_000_000);

        vm.prank(ngo);
        uint256 reqId = vault.requestReimbursement(
            POOL_ID, 100_000_000, bytes32("receipt-cid-1")
        );

        assertEq(reqId, 0);
        assertEq(vault.nextRequestId(), 1);

        (uint256 poolId, address reqNgo, uint256 amt, bytes32 ref, bool executed) =
            vault.reimbursementRequests(reqId);
        assertEq(poolId, POOL_ID);
        assertEq(reqNgo, ngo);
        assertEq(amt, 100_000_000);
        assertEq(ref, bytes32("receipt-cid-1"));
        assertFalse(executed);
    }

    function testNonNgoCannotRequestReimbursement() external {
        _donate(100_000_000);

        vm.prank(donor);
        vm.expectRevert();
        vault.requestReimbursement(POOL_ID, 50_000_000, bytes32("bad"));
    }

    function testRequestDoesNotMoveFunds() external {
        _donate(1_000_000_000);

        vm.prank(ngo);
        vault.requestReimbursement(POOL_ID, 500_000_000, bytes32("receipt"));

        assertEq(vault.poolBalances(POOL_ID), 1_000_000_000);
        assertEq(usdc.balanceOf(ngo), 0);
    }

    function testApproveReimbursementPaysFunds() external {
        _donate(1_000_000_000);

        vm.prank(ngo);
        uint256 reqId = vault.requestReimbursement(
            POOL_ID, 100_000_000, bytes32("receipt-cid")
        );

        vm.prank(operator);
        vault.approveReimbursement(reqId);

        assertEq(usdc.balanceOf(ngo), 100_000_000);
        assertEq(vault.poolBalances(POOL_ID), 900_000_000);

        (, , , , bool executed) = vault.reimbursementRequests(reqId);
        assertTrue(executed);
    }

    function testCannotApproveAlreadyExecutedRequest() external {
        _donate(1_000_000_000);

        vm.prank(ngo);
        uint256 reqId = vault.requestReimbursement(
            POOL_ID, 100_000_000, bytes32("receipt")
        );

        vm.prank(operator);
        vault.approveReimbursement(reqId);

        vm.prank(operator);
        vm.expectRevert(
            abi.encodeWithSelector(
                CrisisPoolVault.RequestAlreadyExecuted.selector,
                reqId
            )
        );
        vault.approveReimbursement(reqId);
    }

    function testCannotApproveNonExistentRequest() external {
        vm.prank(operator);
        vm.expectRevert(
            abi.encodeWithSelector(
                CrisisPoolVault.RequestNotFound.selector,
                999
            )
        );
        vault.approveReimbursement(999);
    }

    function testApproveReimbursementRespectsPoolConfig() external {
        _donate(1_000_000_000);

        // Cap per-request to 50 USDC
        vm.prank(admin);
        vault.configurePool(POOL_ID, 50_000_000, 0, 0);

        // NGO requests 100 USDC -- above pool cap
        vm.prank(ngo);
        uint256 reqId = vault.requestReimbursement(
            POOL_ID, 100_000_000, bytes32("over-cap")
        );

        // Approval should revert because amount exceeds pool max
        vm.prank(operator);
        vm.expectRevert(
            abi.encodeWithSelector(
                CrisisPoolVault.PayoutExceedsPoolMax.selector,
                100_000_000,
                50_000_000
            )
        );
        vault.approveReimbursement(reqId);
    }

    function testApproveReimbursementRespectsCooldown() external {
        _donate(1_000_000_000);

        // First request + approve
        vm.prank(ngo);
        uint256 req1 = vault.requestReimbursement(
            POOL_ID, 100_000_000, bytes32("r1")
        );
        vm.prank(operator);
        vault.approveReimbursement(req1);

        // Second request immediately (same NGO, same pool)
        vm.prank(ngo);
        uint256 req2 = vault.requestReimbursement(
            POOL_ID, 100_000_000, bytes32("r2")
        );

        // Should fail -- cooldown active
        vm.prank(operator);
        vm.expectRevert();
        vault.approveReimbursement(req2);

        // Warp past cooldown, should succeed
        vm.warp(block.timestamp + vault.cooldownPeriod() + 1);
        vm.prank(operator);
        vault.approveReimbursement(req2);

        assertEq(usdc.balanceOf(ngo), 200_000_000);
    }

    function testMultipleNgosCanRequestSamePool() external {
        _donate(1_000_000_000);

        vm.prank(ngo);
        uint256 req1 = vault.requestReimbursement(
            POOL_ID, 100_000_000, bytes32("ngo1-receipt")
        );

        vm.prank(ngo2);
        uint256 req2 = vault.requestReimbursement(
            POOL_ID, 150_000_000, bytes32("ngo2-receipt")
        );

        assertEq(req1, 0);
        assertEq(req2, 1);

        // Approve both -- different recipients, no cooldown conflict
        vm.startPrank(operator);
        vault.approveReimbursement(req1);
        vault.approveReimbursement(req2);
        vm.stopPrank();

        assertEq(usdc.balanceOf(ngo),  100_000_000);
        assertEq(usdc.balanceOf(ngo2), 150_000_000);
        assertEq(vault.poolBalances(POOL_ID), 750_000_000);
    }

    function testPauseBlocksRequestAndApproval() external {
        _donate(100_000_000);

        vm.prank(admin);
        vault.pause();

        vm.prank(ngo);
        vm.expectRevert();
        vault.requestReimbursement(POOL_ID, 50_000_000, bytes32("blocked"));

        vm.prank(admin);
        vault.unpause();

        // Now it should work
        vm.prank(ngo);
        uint256 reqId = vault.requestReimbursement(
            POOL_ID, 50_000_000, bytes32("unblocked")
        );

        vm.prank(admin);
        vault.pause();

        // Approval blocked while paused
        vm.prank(operator);
        vm.expectRevert();
        vault.approveReimbursement(reqId);
    }
}

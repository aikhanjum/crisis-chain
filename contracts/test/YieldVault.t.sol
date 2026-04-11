// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {YieldVault} from "src/YieldVault.sol";
import {CrisisPoolVault} from "src/CrisisPoolVault.sol";
import {MockUSDC} from "src/MockUSDC.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract YieldVaultTest is Test {
    MockUSDC internal usdc;
    YieldVault internal yieldVault;
    CrisisPoolVault internal crisisVault;

    address internal admin   = makeAddr("admin");
    address internal donor1  = makeAddr("donor1");
    address internal donor2  = makeAddr("donor2");

    uint256 internal constant POOL_ID = 1;
    uint256 internal constant DEPOSIT = 1_000_000_000; // 1000 USDC

    function setUp() external {
        usdc = new MockUSDC();
        yieldVault = new YieldVault(admin, IERC20(address(usdc)));
        crisisVault = new CrisisPoolVault(admin, address(usdc));

        usdc.mint(donor1, DEPOSIT);
        usdc.mint(donor2, DEPOSIT);
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    function _deposit(address donor, uint256 amount) internal returns (uint256 shares) {
        vm.startPrank(donor);
        usdc.approve(address(yieldVault), amount);
        shares = yieldVault.deposit(amount, donor);
        vm.stopPrank();
    }

    // ── Deposit / Withdraw ────────────────────────────────────────────────

    function testDepositMintsCorrectShares() external {
        uint256 shares = _deposit(donor1, DEPOSIT);

        assertGt(shares, 0);
        assertEq(yieldVault.balanceOf(donor1), shares);
        assertEq(usdc.balanceOf(address(yieldVault)), DEPOSIT);
        assertEq(yieldVault.totalAssets(), DEPOSIT);
    }

    function testWithdrawReturnsAssets() external {
        _deposit(donor1, DEPOSIT);

        vm.startPrank(donor1);
        yieldVault.withdraw(DEPOSIT, donor1, donor1);
        vm.stopPrank();

        assertEq(usdc.balanceOf(donor1), DEPOSIT);
        assertEq(yieldVault.balanceOf(donor1), 0);
    }

    // ── Yield accrual ─────────────────────────────────────────────────────

    function testAccrueYieldIncreasesSharePrice() external {
        uint256 shares = _deposit(donor1, DEPOSIT);

        // Simulate 10% yield (100 USDC)
        uint256 yieldAmount = 100_000_000;
        usdc.mint(admin, yieldAmount);
        vm.startPrank(admin);
        usdc.approve(address(yieldVault), yieldAmount);
        yieldVault.accrueYield(yieldAmount);
        vm.stopPrank();

        assertEq(yieldVault.totalAssets(), DEPOSIT + yieldAmount);

        // Shares haven't changed, but they're worth more now
        uint256 redeemable = yieldVault.previewRedeem(shares);
        assertGt(redeemable, DEPOSIT);
    }

    function testWithdrawAfterYieldReturnsMoreThanDeposited() external {
        _deposit(donor1, DEPOSIT);

        uint256 yieldAmount = 100_000_000;
        usdc.mint(admin, yieldAmount);
        vm.startPrank(admin);
        usdc.approve(address(yieldVault), yieldAmount);
        yieldVault.accrueYield(yieldAmount);
        vm.stopPrank();

        vm.startPrank(donor1);
        uint256 maxWithdraw = yieldVault.maxWithdraw(donor1);
        yieldVault.withdraw(maxWithdraw, donor1, donor1);
        vm.stopPrank();

        assertGt(usdc.balanceOf(donor1), DEPOSIT);
    }

    function testMultipleDepositorsShareYieldProportionally() external {
        // Donor1 deposits 1000, Donor2 deposits 1000
        _deposit(donor1, DEPOSIT);
        _deposit(donor2, DEPOSIT);

        // 200 USDC yield accrues (100 each)
        uint256 yieldAmount = 200_000_000;
        usdc.mint(admin, yieldAmount);
        vm.startPrank(admin);
        usdc.approve(address(yieldVault), yieldAmount);
        yieldVault.accrueYield(yieldAmount);
        vm.stopPrank();

        uint256 redeemable1 = yieldVault.previewRedeem(yieldVault.balanceOf(donor1));
        uint256 redeemable2 = yieldVault.previewRedeem(yieldVault.balanceOf(donor2));

        // Both should get ~1100 USDC (1000 deposit + 100 yield), allow 1 wei rounding
        assertApproxEqAbs(redeemable1, DEPOSIT + yieldAmount / 2, 1);
        assertApproxEqAbs(redeemable2, DEPOSIT + yieldAmount / 2, 1);
    }

    // ── Allocate to crisis ────────────────────────────────────────────────

    function testAllocateToCrisisMovesAssetsToVaultPool() external {
        _deposit(donor1, DEPOSIT);

        uint256 allocAmount = 500_000_000; // 500 USDC
        vm.prank(admin);
        yieldVault.allocateToCrisis(address(crisisVault), POOL_ID, allocAmount, bytes32("crisis-alloc"));

        assertEq(crisisVault.poolBalances(POOL_ID), allocAmount);
        assertEq(yieldVault.totalAssets(), DEPOSIT - allocAmount);
    }

    function testAllocateToCrisisRevertsForNonStrategist() external {
        _deposit(donor1, DEPOSIT);

        vm.prank(donor1);
        vm.expectRevert();
        yieldVault.allocateToCrisis(address(crisisVault), POOL_ID, 100, bytes32("bad"));
    }

    // ── Access control ────────────────────────────────────────────────────

    function testAccrueYieldRevertsForNonStrategist() external {
        usdc.mint(donor1, 100);
        vm.startPrank(donor1);
        usdc.approve(address(yieldVault), 100);
        vm.expectRevert();
        yieldVault.accrueYield(100);
        vm.stopPrank();
    }

    function testAccrueYieldRevertsForZeroAmount() external {
        vm.prank(admin);
        vm.expectRevert(YieldVault.InvalidAmount.selector);
        yieldVault.accrueYield(0);
    }
}

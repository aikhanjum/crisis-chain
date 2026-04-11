// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {EIP712Reimbursement} from "src/EIP712Reimbursement.sol";
import {CrisisPoolVault} from "src/CrisisPoolVault.sol";
import {MockUSDC} from "src/MockUSDC.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract EIP712ReimbursementTest is Test {
    MockUSDC internal usdc;
    CrisisPoolVault internal vault;
    EIP712Reimbursement internal reimbursement;

    // Use a known private key so we can sign in tests
    uint256 internal constant APPROVER_PK = 0xA11CE;
    address internal approver;

    uint256 internal constant RANDOM_PK = 0xBAD;
    address internal randomSigner;

    address internal admin = makeAddr("admin");
    address internal ngo   = makeAddr("ngo");
    address internal donor = makeAddr("donor");

    uint256 internal constant POOL_ID = 1;
    uint256 internal constant PAYOUT  = 100_000_000; // 100 USDC
    bytes32 internal constant REF     = bytes32("ipfs-receipt-cid");

    bytes32 private constant _APPROVAL_TYPEHASH = keccak256(
        "ReimbursementApproval(uint256 poolId,address recipient,uint256 amount,bytes32 payoutRef,uint256 nonce,uint256 deadline)"
    );

    function setUp() external {
        // Warp to a realistic timestamp so the vault's first-payout cooldown check passes
        vm.warp(1_000_000);

        approver = vm.addr(APPROVER_PK);
        randomSigner = vm.addr(RANDOM_PK);

        usdc = new MockUSDC();
        vault = new CrisisPoolVault(admin, address(usdc));
        reimbursement = new EIP712Reimbursement(admin, address(vault));

        // Grant PAYOUT_ROLE on vault to the reimbursement contract,
        // and APPROVER_ROLE to our test approver.
        // Use startPrank so nested view calls (e.g. vault.PAYOUT_ROLE()) don't consume the prank.
        vm.startPrank(admin);
        vault.grantRole(vault.PAYOUT_ROLE(), address(reimbursement));
        reimbursement.grantRole(reimbursement.APPROVER_ROLE(), approver);
        vm.stopPrank();

        // Fund the pool: donor deposits into vault
        usdc.mint(donor, 1_000_000_000);
        vm.startPrank(donor);
        usdc.approve(address(vault), 1_000_000_000);
        vault.donate(POOL_ID, 1_000_000_000, bytes32("seed"));
        vm.stopPrank();
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    function _signApproval(
        uint256 pk,
        uint256 poolId,
        address recipient,
        uint256 amount,
        bytes32 payoutRef,
        uint256 nonce,
        uint256 deadline
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(abi.encode(
            _APPROVAL_TYPEHASH,
            poolId,
            recipient,
            amount,
            payoutRef,
            nonce,
            deadline
        ));
        bytes32 digest = MessageHashUtils.toTypedDataHash(
            reimbursement.domainSeparatorV4(),
            structHash
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    // ── Valid execution ───────────────────────────────────────────────────

    function testExecuteApprovalWithValidSignature() external {
        uint256 deadline = block.timestamp + 1 hours;
        uint256 nonce = reimbursement.nonces(approver);

        bytes memory sig = _signApproval(APPROVER_PK, POOL_ID, ngo, PAYOUT, REF, nonce, deadline);

        vm.prank(ngo);
        reimbursement.executeApproval(POOL_ID, ngo, PAYOUT, REF, nonce, deadline, sig);

        assertEq(usdc.balanceOf(ngo), PAYOUT);
        assertEq(reimbursement.nonces(approver), nonce + 1);
    }

    function testAnyoneCanSubmitValidSignature() external {
        uint256 deadline = block.timestamp + 1 hours;
        uint256 nonce = reimbursement.nonces(approver);
        bytes memory sig = _signApproval(APPROVER_PK, POOL_ID, ngo, PAYOUT, REF, nonce, deadline);

        // A random third party submits — tokens still go to ngo
        address thirdParty = makeAddr("relay");
        vm.prank(thirdParty);
        reimbursement.executeApproval(POOL_ID, ngo, PAYOUT, REF, nonce, deadline, sig);

        assertEq(usdc.balanceOf(ngo), PAYOUT);
        assertEq(usdc.balanceOf(thirdParty), 0);
    }

    // ── Reverts ───────────────────────────────────────────────────────────

    function testRevertsOnExpiredDeadline() external {
        uint256 deadline = block.timestamp - 1; // already expired
        uint256 nonce = reimbursement.nonces(approver);
        bytes memory sig = _signApproval(APPROVER_PK, POOL_ID, ngo, PAYOUT, REF, nonce, deadline);

        vm.prank(ngo);
        vm.expectRevert(EIP712Reimbursement.DeadlineExpired.selector);
        reimbursement.executeApproval(POOL_ID, ngo, PAYOUT, REF, nonce, deadline, sig);
    }

    function testRevertsOnReplayedNonce() external {
        uint256 deadline = block.timestamp + 1 hours;
        uint256 nonce = reimbursement.nonces(approver);
        bytes memory sig = _signApproval(APPROVER_PK, POOL_ID, ngo, PAYOUT, REF, nonce, deadline);

        vm.prank(ngo);
        reimbursement.executeApproval(POOL_ID, ngo, PAYOUT, REF, nonce, deadline, sig);

        // Replay the same signature
        vm.prank(ngo);
        vm.expectRevert(EIP712Reimbursement.InvalidNonce.selector);
        reimbursement.executeApproval(POOL_ID, ngo, PAYOUT, REF, nonce, deadline, sig);
    }

    function testRevertsWhenSignerLacksApproverRole() external {
        uint256 deadline = block.timestamp + 1 hours;
        // Sign with RANDOM_PK — that address has no APPROVER_ROLE
        bytes memory sig = _signApproval(RANDOM_PK, POOL_ID, ngo, PAYOUT, REF, 0, deadline);

        vm.prank(ngo);
        vm.expectRevert(EIP712Reimbursement.SignerNotApprover.selector);
        reimbursement.executeApproval(POOL_ID, ngo, PAYOUT, REF, 0, deadline, sig);
    }

    function testRevertsOnTamperedAmount() external {
        uint256 deadline = block.timestamp + 1 hours;
        uint256 nonce = reimbursement.nonces(approver);
        // Sign for 100 USDC
        bytes memory sig = _signApproval(APPROVER_PK, POOL_ID, ngo, PAYOUT, REF, nonce, deadline);

        // Try to claim 200 USDC with the same signature
        vm.prank(ngo);
        vm.expectRevert(); // ECDSA.recover will produce wrong signer
        reimbursement.executeApproval(POOL_ID, ngo, PAYOUT * 2, REF, nonce, deadline, sig);
    }

    // ── Sequential valid approvals ────────────────────────────────────────

    function testSequentialApprovalsWithIncrementingNonce() external {
        uint256 deadline = block.timestamp + 30 days;

        for (uint256 i = 0; i < 3; i++) {
            // Warp past vault cooldown between payouts to the same recipient
            if (i > 0) vm.warp(block.timestamp + vault.cooldownPeriod() + 1);

            uint256 nonce = reimbursement.nonces(approver);
            bytes memory sig = _signApproval(APPROVER_PK, POOL_ID, ngo, PAYOUT, REF, nonce, deadline);
            vm.prank(ngo);
            reimbursement.executeApproval(POOL_ID, ngo, PAYOUT, REF, nonce, deadline, sig);
        }

        assertEq(usdc.balanceOf(ngo), PAYOUT * 3);
        assertEq(reimbursement.nonces(approver), 3);
    }
}

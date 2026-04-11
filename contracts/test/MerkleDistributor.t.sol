// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {MerkleDistributor} from "src/MerkleDistributor.sol";
import {MockUSDC} from "src/MockUSDC.sol";

contract MerkleDistributorTest is Test {
    MockUSDC internal usdc;
    MerkleDistributor internal distributor;

    address internal admin = makeAddr("admin");
    address internal ngo1  = makeAddr("ngo1");
    address internal ngo2  = makeAddr("ngo2");
    address internal rando = makeAddr("rando");

    uint256 internal constant AMOUNT_1 = 100_000_000; // 100 USDC
    uint256 internal constant AMOUNT_2 = 200_000_000; // 200 USDC
    bytes32 internal constant REF_1 = bytes32("receipt-ipfs-cid-1");
    bytes32 internal constant REF_2 = bytes32("receipt-ipfs-cid-2");

    // Pre-computed Merkle tree for two leaves:
    //   leaf0 = keccak256(abi.encodePacked(uint256(0), ngo1, AMOUNT_1, REF_1))
    //   leaf1 = keccak256(abi.encodePacked(uint256(1), ngo2, AMOUNT_2, REF_2))
    //   root  = keccak256(sorted(leaf0, leaf1))
    bytes32 internal leaf0;
    bytes32 internal leaf1;
    bytes32 internal merkleRoot;

    function setUp() external {
        usdc = new MockUSDC();
        distributor = new MerkleDistributor(admin, address(usdc));

        // Compute leaves — addresses are deterministic via makeAddr
        leaf0 = keccak256(abi.encodePacked(uint256(0), ngo1, AMOUNT_1, REF_1));
        leaf1 = keccak256(abi.encodePacked(uint256(1), ngo2, AMOUNT_2, REF_2));

        // OpenZeppelin MerkleProof expects sorted pairs
        if (uint256(leaf0) < uint256(leaf1)) {
            merkleRoot = keccak256(abi.encodePacked(leaf0, leaf1));
        } else {
            merkleRoot = keccak256(abi.encodePacked(leaf1, leaf0));
        }

        // Fund admin so they can create rounds
        usdc.mint(admin, AMOUNT_1 + AMOUNT_2);
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    function _createRound() internal returns (uint256 roundId) {
        vm.startPrank(admin);
        usdc.approve(address(distributor), AMOUNT_1 + AMOUNT_2);
        roundId = distributor.createRound(merkleRoot, AMOUNT_1 + AMOUNT_2);
        vm.stopPrank();
    }

    function _proofFor(bytes32 sibling) internal pure returns (bytes32[] memory proof) {
        proof = new bytes32[](1);
        proof[0] = sibling;
    }

    // ── Round creation ────────────────────────────────────────────────────

    function testCreateRoundStoresDataAndTransfersTokens() external {
        uint256 roundId = _createRound();

        (bytes32 root, uint256 total, uint256 claimed, bool active) = distributor.rounds(roundId);
        assertEq(root, merkleRoot);
        assertEq(total, AMOUNT_1 + AMOUNT_2);
        assertEq(claimed, 0);
        assertTrue(active);
        assertEq(usdc.balanceOf(address(distributor)), AMOUNT_1 + AMOUNT_2);
    }

    function testCreateRoundRevertsForNonDistributor() external {
        vm.prank(rando);
        vm.expectRevert();
        distributor.createRound(merkleRoot, AMOUNT_1);
    }

    function testCreateRoundRevertsForZeroAmount() external {
        vm.prank(admin);
        vm.expectRevert(MerkleDistributor.InvalidAmount.selector);
        distributor.createRound(merkleRoot, 0);
    }

    // ── Valid claims ──────────────────────────────────────────────────────

    function testClaimWithValidProof() external {
        _createRound();

        // ngo1 claims index 0
        vm.prank(ngo1);
        distributor.claim(0, 0, ngo1, AMOUNT_1, REF_1, _proofFor(leaf1));

        assertEq(usdc.balanceOf(ngo1), AMOUNT_1);
        assertTrue(distributor.isClaimed(0, 0));
    }

    function testMultipleClaimsFromSameRound() external {
        _createRound();

        vm.prank(ngo1);
        distributor.claim(0, 0, ngo1, AMOUNT_1, REF_1, _proofFor(leaf1));

        vm.prank(ngo2);
        distributor.claim(0, 1, ngo2, AMOUNT_2, REF_2, _proofFor(leaf0));

        assertEq(usdc.balanceOf(ngo1), AMOUNT_1);
        assertEq(usdc.balanceOf(ngo2), AMOUNT_2);
        assertEq(usdc.balanceOf(address(distributor)), 0);
    }

    // ── Invalid claims ────────────────────────────────────────────────────

    function testClaimRevertsOnInvalidProof() external {
        _createRound();

        bytes32[] memory badProof = new bytes32[](1);
        badProof[0] = bytes32("garbage");

        vm.prank(ngo1);
        vm.expectRevert(MerkleDistributor.InvalidProof.selector);
        distributor.claim(0, 0, ngo1, AMOUNT_1, REF_1, badProof);
    }

    function testClaimRevertsOnDoubleClaim() external {
        _createRound();

        vm.prank(ngo1);
        distributor.claim(0, 0, ngo1, AMOUNT_1, REF_1, _proofFor(leaf1));

        vm.prank(ngo1);
        vm.expectRevert(MerkleDistributor.AlreadyClaimed.selector);
        distributor.claim(0, 0, ngo1, AMOUNT_1, REF_1, _proofFor(leaf1));
    }

    function testClaimRevertsOnExpiredRound() external {
        uint256 roundId = _createRound();

        vm.prank(admin);
        distributor.expireRound(roundId);

        vm.prank(ngo1);
        vm.expectRevert(MerkleDistributor.RoundNotActive.selector);
        distributor.claim(roundId, 0, ngo1, AMOUNT_1, REF_1, _proofFor(leaf1));
    }

    // ── Round expiry ──────────────────────────────────────────────────────

    function testExpireRoundReclaimsUnclaimedFunds() external {
        uint256 roundId = _createRound();

        // ngo1 claims their share
        vm.prank(ngo1);
        distributor.claim(roundId, 0, ngo1, AMOUNT_1, REF_1, _proofFor(leaf1));

        // Admin expires — should reclaim ngo2's unclaimed portion
        uint256 adminBefore = usdc.balanceOf(admin);
        vm.prank(admin);
        distributor.expireRound(roundId);

        assertEq(usdc.balanceOf(admin), adminBefore + AMOUNT_2);
    }

    function testExpireRoundRevertsIfAlreadyExpired() external {
        uint256 roundId = _createRound();

        vm.prank(admin);
        distributor.expireRound(roundId);

        vm.prank(admin);
        vm.expectRevert(MerkleDistributor.RoundNotActive.selector);
        distributor.expireRound(roundId);
    }

    // ── Anyone can submit a claim on behalf of the recipient ──────────────

    function testThirdPartyCanSubmitClaimForRecipient() external {
        _createRound();

        // rando submits claim but tokens go to ngo1
        vm.prank(rando);
        distributor.claim(0, 0, ngo1, AMOUNT_1, REF_1, _proofFor(leaf1));

        assertEq(usdc.balanceOf(ngo1), AMOUNT_1);
        assertEq(usdc.balanceOf(rando), 0);
    }
}

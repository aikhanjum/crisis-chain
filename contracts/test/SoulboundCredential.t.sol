// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {SoulboundCredential} from "src/SoulboundCredential.sol";

contract SoulboundCredentialTest is Test {
    SoulboundCredential internal credential;

    address internal admin = makeAddr("admin");
    address internal ngo1  = makeAddr("ngo1");
    address internal ngo2  = makeAddr("ngo2");
    address internal rando = makeAddr("rando");

    function setUp() external {
        vm.warp(1_000_000);
        credential = new SoulboundCredential(admin);
    }

    // ── Issue ─────────────────────────────────────────────────────────────

    function testIssueMintsCredential() external {
        vm.prank(admin);
        uint256 tokenId = credential.issue(ngo1, "ipfs://ngo1-metadata");

        assertEq(credential.balanceOf(ngo1), 1);
        assertEq(credential.ownerOf(tokenId), ngo1);
        assertEq(credential.tokenURI(tokenId), "ipfs://ngo1-metadata");
    }

    function testVerifiedSinceSetOnIssue() external {
        uint256 before = block.timestamp;
        vm.prank(admin);
        credential.issue(ngo1, "ipfs://ngo1");

        assertEq(credential.verifiedSince(ngo1), before);
    }

    function testIssueRevertsIfAlreadyVerified() external {
        vm.prank(admin);
        credential.issue(ngo1, "ipfs://ngo1");

        vm.prank(admin);
        vm.expectRevert(SoulboundCredential.AlreadyVerified.selector);
        credential.issue(ngo1, "ipfs://ngo1-again");
    }

    function testOnlyIssuerCanIssue() external {
        vm.prank(rando);
        vm.expectRevert();
        credential.issue(ngo1, "ipfs://ngo1");
    }

    // ── Revoke ────────────────────────────────────────────────────────────

    function testRevokesBurnsAndClearsVerifiedSince() external {
        vm.prank(admin);
        uint256 tokenId = credential.issue(ngo1, "ipfs://ngo1");

        vm.prank(admin);
        credential.revoke(tokenId);

        assertEq(credential.balanceOf(ngo1), 0);
        assertEq(credential.verifiedSince(ngo1), 0);
    }

    function testCanReissueAfterRevoke() external {
        vm.prank(admin);
        uint256 tokenId1 = credential.issue(ngo1, "ipfs://ngo1-v1");

        vm.prank(admin);
        credential.revoke(tokenId1);

        vm.prank(admin);
        uint256 tokenId2 = credential.issue(ngo1, "ipfs://ngo1-v2");

        assertEq(credential.balanceOf(ngo1), 1);
        assertTrue(tokenId2 != tokenId1);
    }

    function testOnlyIssuerCanRevoke() external {
        vm.prank(admin);
        uint256 tokenId = credential.issue(ngo1, "ipfs://ngo1");

        vm.prank(rando);
        vm.expectRevert();
        credential.revoke(tokenId);
    }

    // ── Soulbound (transfers blocked) ─────────────────────────────────────

    function testTransferFromReverts() external {
        vm.prank(admin);
        uint256 tokenId = credential.issue(ngo1, "ipfs://ngo1");

        vm.prank(ngo1);
        vm.expectRevert(SoulboundCredential.Soulbound.selector);
        credential.transferFrom(ngo1, ngo2, tokenId);
    }

    function testSafeTransferFromReverts() external {
        vm.prank(admin);
        uint256 tokenId = credential.issue(ngo1, "ipfs://ngo1");

        vm.prank(ngo1);
        vm.expectRevert(SoulboundCredential.Soulbound.selector);
        credential.safeTransferFrom(ngo1, ngo2, tokenId);
    }

    function testApproveReverts() external {
        vm.prank(admin);
        credential.issue(ngo1, "ipfs://ngo1");

        vm.prank(ngo1);
        vm.expectRevert(SoulboundCredential.Soulbound.selector);
        credential.approve(ngo2, 0);
    }

    function testSetApprovalForAllReverts() external {
        vm.prank(ngo1);
        vm.expectRevert(SoulboundCredential.Soulbound.selector);
        credential.setApprovalForAll(ngo2, true);
    }

    // ── Multiple NGOs ─────────────────────────────────────────────────────

    function testMultipleNgosGetUniqueTokenIds() external {
        vm.startPrank(admin);
        uint256 id1 = credential.issue(ngo1, "ipfs://ngo1");
        uint256 id2 = credential.issue(ngo2, "ipfs://ngo2");
        vm.stopPrank();

        assertTrue(id1 != id2);
        assertEq(credential.ownerOf(id1), ngo1);
        assertEq(credential.ownerOf(id2), ngo2);
    }
}

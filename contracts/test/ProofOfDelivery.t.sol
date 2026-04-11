// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ProofOfDelivery} from "src/ProofOfDelivery.sol";
import {CrisisPoolVault} from "src/CrisisPoolVault.sol";
import {SoulboundCredential} from "src/SoulboundCredential.sol";
import {MockUSDC} from "src/MockUSDC.sol";

contract ProofOfDeliveryTest is Test {
    MockUSDC internal usdc;
    CrisisPoolVault internal vault;
    SoulboundCredential internal cred;
    ProofOfDelivery internal pod;

    address internal admin   = makeAddr("admin");
    address internal oracle  = makeAddr("oracle");
    address internal ngo1    = makeAddr("ngo1");
    address internal ngo2    = makeAddr("ngo2");
    address internal ben1    = makeAddr("beneficiary1");
    address internal ben2    = makeAddr("beneficiary2");
    address internal donor   = makeAddr("donor");
    address internal rando   = makeAddr("rando");

    uint256 internal constant POOL_ID = 1;
    uint256 internal constant CLAIM_AMOUNT = 500_000_000; // $500 USDC
    bytes32 internal constant RECEIPT_REF = bytes32("QmReceiptIPFSCID");
    bytes32 internal constant GEO_HASH = bytes32("u4pruydqqvj");

    function setUp() external {
        vm.warp(1_000_000);

        usdc = new MockUSDC();
        vault = new CrisisPoolVault(admin, address(usdc));
        cred = new SoulboundCredential(admin);
        pod = new ProofOfDelivery(admin, address(vault), address(cred));

        // Wire permissions
        vm.startPrank(admin);
        vault.grantRole(vault.PAYOUT_ROLE(), address(pod));
        pod.grantRole(pod.ORACLE_ROLE(), oracle);
        cred.issue(ngo1, "ipfs://ngo1-verified");
        cred.issue(ngo2, "ipfs://ngo2-verified");
        vm.stopPrank();

        // Fund the pool
        usdc.mint(donor, 10_000_000_000);
        vm.startPrank(donor);
        usdc.approve(address(vault), 10_000_000_000);
        vault.donate(POOL_ID, 10_000_000_000, bytes32("seed-fund"));
        vm.stopPrank();
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    function _submitClaim() internal returns (uint256 claimId) {
        vm.prank(ngo1);
        claimId = pod.submitClaim(POOL_ID, CLAIM_AMOUNT, RECEIPT_REF, GEO_HASH, 2);
    }

    function _attestBothOracles(uint256 claimId) internal {
        vm.startPrank(oracle);
        pod.attestOracle(claimId, ProofOfDelivery.SignalType.RECEIPT_ORACLE);
        pod.attestOracle(claimId, ProofOfDelivery.SignalType.GEO_ORACLE);
        vm.stopPrank();
    }

    // ── Submit claim ──────────────────────────────────────────────────────

    function testSubmitClaimCreatesRecord() external {
        uint256 claimId = _submitClaim();

        (
            uint256 poolId, address ngo, uint256 amount,
            bytes32 receiptRef, bytes32 geoHash,
            uint256 submittedAt, uint256 confidence,
            bool paid, uint8 benCount, uint8 benThreshold
        ) = pod.claims(claimId);

        assertEq(poolId, POOL_ID);
        assertEq(ngo, ngo1);
        assertEq(amount, CLAIM_AMOUNT);
        assertEq(receiptRef, RECEIPT_REF);
        assertEq(geoHash, GEO_HASH);
        assertEq(submittedAt, block.timestamp);
        assertEq(confidence, 0);
        assertFalse(paid);
        assertEq(benCount, 0);
        assertEq(benThreshold, 2);
    }

    function testSubmitClaimRevertsForUnverifiedNGO() external {
        vm.prank(rando);
        vm.expectRevert(ProofOfDelivery.NotVerifiedNGO.selector);
        pod.submitClaim(POOL_ID, CLAIM_AMOUNT, RECEIPT_REF, GEO_HASH, 1);
    }

    function testSubmitClaimRevertsForZeroAmount() external {
        vm.prank(ngo1);
        vm.expectRevert(ProofOfDelivery.InvalidAmount.selector);
        pod.submitClaim(POOL_ID, 0, RECEIPT_REF, GEO_HASH, 1);
    }

    function testSubmitClaimRevertsDailyCapExceeded() external {
        // Set a low daily cap
        vm.prank(admin);
        pod.setDailyCap(CLAIM_AMOUNT - 1);

        vm.prank(ngo1);
        vm.expectRevert(ProofOfDelivery.DailyCapExceeded.selector);
        pod.submitClaim(POOL_ID, CLAIM_AMOUNT, RECEIPT_REF, GEO_HASH, 1);
    }

    // ── Oracle attestation ────────────────────────────────────────────────

    function testOracleAttestationIncreasesScore() external {
        uint256 claimId = _submitClaim();

        vm.prank(oracle);
        pod.attestOracle(claimId, ProofOfDelivery.SignalType.RECEIPT_ORACLE);

        (,,,,,, uint256 confidence,,,) = pod.claims(claimId);
        assertEq(confidence, 2500); // 25%
    }

    function testDoubleOracleAttestationReverts() external {
        uint256 claimId = _submitClaim();

        vm.prank(oracle);
        pod.attestOracle(claimId, ProofOfDelivery.SignalType.RECEIPT_ORACLE);

        vm.prank(oracle);
        vm.expectRevert(ProofOfDelivery.AlreadyAttested.selector);
        pod.attestOracle(claimId, ProofOfDelivery.SignalType.RECEIPT_ORACLE);
    }

    function testNonOracleCannotAttestOracle() external {
        uint256 claimId = _submitClaim();

        vm.prank(rando);
        vm.expectRevert();
        pod.attestOracle(claimId, ProofOfDelivery.SignalType.RECEIPT_ORACLE);
    }

    // ── Peer attestation ──────────────────────────────────────────────────

    function testPeerAttestationIncreasesScore() external {
        uint256 claimId = _submitClaim();

        vm.prank(ngo2);
        pod.attestPeer(claimId);

        (,,,,,, uint256 confidence,,,) = pod.claims(claimId);
        assertEq(confidence, 2500); // 25%
    }

    function testSelfAttestationReverts() external {
        uint256 claimId = _submitClaim();

        vm.prank(ngo1);
        vm.expectRevert(ProofOfDelivery.SelfAttestation.selector);
        pod.attestPeer(claimId);
    }

    function testUnverifiedPeerCannotAttest() external {
        uint256 claimId = _submitClaim();

        vm.prank(rando);
        vm.expectRevert(ProofOfDelivery.NotVerifiedNGO.selector);
        pod.attestPeer(claimId);
    }

    function testDoublePeerAttestationReverts() external {
        uint256 claimId = _submitClaim();

        vm.prank(ngo2);
        pod.attestPeer(claimId);

        vm.prank(ngo2);
        vm.expectRevert(ProofOfDelivery.AlreadyAttested.selector);
        pod.attestPeer(claimId);
    }

    // ── Beneficiary attestation ───────────────────────────────────────────

    function testBeneficiaryAttestationNeedsThreshold() external {
        uint256 claimId = _submitClaim(); // threshold = 2

        vm.prank(ben1);
        pod.attestBeneficiary(claimId);

        // 1 of 2 — weight not yet added
        (,,,,,, uint256 confidence,,,) = pod.claims(claimId);
        assertEq(confidence, 0);

        vm.prank(ben2);
        pod.attestBeneficiary(claimId);

        // 2 of 2 — weight added
        (,,,,,, confidence,,,) = pod.claims(claimId);
        assertEq(confidence, 2500);
    }

    function testBeneficiarySelfAttestationReverts() external {
        uint256 claimId = _submitClaim();

        vm.prank(ngo1); // the claimant
        vm.expectRevert(ProofOfDelivery.SelfAttestation.selector);
        pod.attestBeneficiary(claimId);
    }

    function testDoubleBeneficiaryReverts() external {
        uint256 claimId = _submitClaim();

        vm.prank(ben1);
        pod.attestBeneficiary(claimId);

        vm.prank(ben1);
        vm.expectRevert(ProofOfDelivery.AlreadyAttested.selector);
        pod.attestBeneficiary(claimId);
    }

    // ── Auto-payout ───────────────────────────────────────────────────────

    function testAutoPayoutTriggersAt75Percent() external {
        uint256 claimId = _submitClaim();

        // Oracle: receipt (25%) + geo (25%) = 50%
        _attestBothOracles(claimId);
        (,,,,,,, bool paidAfterOracle,,) = pod.claims(claimId);
        assertFalse(paidAfterOracle); // 50% < 75%

        // Peer: +25% = 75% → should auto-pay
        vm.prank(ngo2);
        pod.attestPeer(claimId);

        (,,,,,,, bool paidAfterPeer,,) = pod.claims(claimId);
        assertTrue(paidAfterPeer);
        assertEq(usdc.balanceOf(ngo1), CLAIM_AMOUNT);
        assertEq(pod.successfulDeliveries(ngo1), 1);
    }

    function testAllFourSignalsTriggerPayout() external {
        uint256 claimId = _submitClaim();

        _attestBothOracles(claimId);

        vm.prank(ben1);
        pod.attestBeneficiary(claimId);
        vm.prank(ben2);
        pod.attestBeneficiary(claimId);

        // 50% oracle + 25% beneficiary = 75% → auto-pay
        (,,,,,,, bool paid,,) = pod.claims(claimId);
        assertTrue(paid);
        assertEq(usdc.balanceOf(ngo1), CLAIM_AMOUNT);
    }

    function testCannotAttestAfterPayout() external {
        uint256 claimId = _submitClaim();
        _attestBothOracles(claimId);

        vm.prank(ngo2);
        pod.attestPeer(claimId); // triggers payout at 75%

        vm.prank(ben1);
        vm.expectRevert(ProofOfDelivery.ClaimAlreadyPaid.selector);
        pod.attestBeneficiary(claimId);
    }

    // ── Claim expiry ──────────────────────────────────────────────────────

    function testClaimExpiresAfterWindow() external {
        uint256 claimId = _submitClaim();

        vm.warp(block.timestamp + pod.claimExpiry() + 1);

        vm.prank(oracle);
        vm.expectRevert(ProofOfDelivery.ClaimHasExpired.selector);
        pod.attestOracle(claimId, ProofOfDelivery.SignalType.RECEIPT_ORACLE);
    }

    // ── Veteran threshold reduction ───────────────────────────────────────

    function testVeteranNGOGetsReducedThreshold() external {
        // ngo1 was verified at block.timestamp (1_000_000). Warp past veteranAge.
        vm.warp(1_000_000 + pod.veteranAge() + 1);

        uint256 threshold = pod.getEffectiveThreshold(ngo1);
        assertEq(threshold, pod.veteranThreshold()); // 6000 instead of 7500

        // Submit claim — only need 60% to auto-pay
        vm.prank(ngo1);
        uint256 claimId = pod.submitClaim(POOL_ID, CLAIM_AMOUNT, RECEIPT_REF, GEO_HASH, 1);

        // Oracle: 50% + peer: 25% = 75% > 60% → but let's test with just oracle + 1 beneficiary
        _attestBothOracles(claimId);

        // 50% ≥ 60%? No. Need one more signal.
        (,,,,,,, bool paidAt50,,) = pod.claims(claimId);
        assertFalse(paidAt50);

        // Beneficiary: +25% = 75% ≥ 60% → auto-pay
        vm.prank(ben1);
        pod.attestBeneficiary(claimId);

        (,,,,,,, bool paidNow,,) = pod.claims(claimId);
        assertTrue(paidNow);
    }

    // ── Governance ────────────────────────────────────────────────────────

    function testGovernanceCanAdjustThreshold() external {
        vm.prank(admin);
        pod.setPayoutThreshold(5000);
        assertEq(pod.payoutThreshold(), 5000);
    }

    function testGovernanceCanAdjustWeights() external {
        vm.prank(admin);
        pod.setSignalWeight(ProofOfDelivery.SignalType.RECEIPT_ORACLE, 4000);
        assertEq(pod.signalWeights(ProofOfDelivery.SignalType.RECEIPT_ORACLE), 4000);
    }

    function testGovernanceCanSetDailyCap() external {
        vm.prank(admin);
        pod.setDailyCap(1_000_000_000);
        assertEq(pod.dailyCap(), 1_000_000_000);
    }

    function testNonGovernanceCannotSetThreshold() external {
        vm.prank(rando);
        vm.expectRevert();
        pod.setPayoutThreshold(5000);
    }

    function testInvalidThresholdReverts() external {
        vm.prank(admin);
        vm.expectRevert(ProofOfDelivery.InvalidThreshold.selector);
        pod.setPayoutThreshold(0);

        vm.prank(admin);
        vm.expectRevert(ProofOfDelivery.InvalidThreshold.selector);
        pod.setPayoutThreshold(10_001);
    }

    // ── Successful deliveries counter ─────────────────────────────────────

    function testSuccessfulDeliveriesIncrementsOnPayout() external {
        assertEq(pod.successfulDeliveries(ngo1), 0);

        uint256 claimId = _submitClaim();
        _attestBothOracles(claimId);
        vm.prank(ngo2);
        pod.attestPeer(claimId);

        assertEq(pod.successfulDeliveries(ngo1), 1);
    }
}

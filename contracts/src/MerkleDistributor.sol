// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/// @title MerkleDistributor
/// @notice Gas-efficient batch disbursements using Merkle proofs.
///         Admin publishes a single root covering N approved reimbursements;
///         NGOs self-claim by proving inclusion.  Bitmap prevents double-claims.
contract MerkleDistributor is AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");

    IERC20 public immutable token;

    struct Round {
        bytes32 merkleRoot;
        uint256 totalAmount;
        uint256 claimedAmount;
        bool active;
    }

    uint256 public roundCount;
    mapping(uint256 roundId => Round) public rounds;

    // Packed bitmap: roundId → wordIndex → bitmap word
    mapping(uint256 roundId => mapping(uint256 wordIndex => uint256 bitmap)) private _claimedBitmap;

    // ── Events ────────────────────────────────────────────────────────────
    event RoundCreated(uint256 indexed roundId, bytes32 merkleRoot, uint256 totalAmount);
    event Claimed(uint256 indexed roundId, uint256 index, address indexed recipient, uint256 amount, bytes32 indexed payoutRef);
    event RoundExpired(uint256 indexed roundId, uint256 reclaimedAmount);

    // ── Errors ────────────────────────────────────────────────────────────
    error InvalidProof();
    error AlreadyClaimed();
    error RoundNotActive();
    error InvalidAmount();

    constructor(address admin, address tokenAddress) {
        if (admin == address(0) || tokenAddress == address(0)) revert();
        token = IERC20(tokenAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(DISTRIBUTOR_ROLE, admin);
    }

    // ── Admin ─────────────────────────────────────────────────────────────

    /// @notice Create a distribution round. Caller must have approved `totalAmount` to this contract.
    function createRound(bytes32 merkleRoot, uint256 totalAmount)
        external
        onlyRole(DISTRIBUTOR_ROLE)
        returns (uint256 roundId)
    {
        if (totalAmount == 0) revert InvalidAmount();

        roundId = roundCount++;
        rounds[roundId] = Round({
            merkleRoot: merkleRoot,
            totalAmount: totalAmount,
            claimedAmount: 0,
            active: true
        });

        token.safeTransferFrom(msg.sender, address(this), totalAmount);
        emit RoundCreated(roundId, merkleRoot, totalAmount);
    }

    /// @notice Expire a round and reclaim unclaimed tokens.
    function expireRound(uint256 roundId) external onlyRole(DISTRIBUTOR_ROLE) {
        Round storage r = rounds[roundId];
        if (!r.active) revert RoundNotActive();

        r.active = false;
        uint256 remaining = r.totalAmount - r.claimedAmount;
        if (remaining > 0) {
            token.safeTransfer(msg.sender, remaining);
        }
        emit RoundExpired(roundId, remaining);
    }

    // ── Claim ─────────────────────────────────────────────────────────────

    function isClaimed(uint256 roundId, uint256 index) public view returns (bool) {
        uint256 wordIndex = index / 256;
        uint256 bitIndex = index % 256;
        return (_claimedBitmap[roundId][wordIndex] & (1 << bitIndex)) != 0;
    }

    /// @notice Claim tokens for `recipient` by providing a valid Merkle proof.
    /// @param roundId  The distribution round.
    /// @param index    Unique index in the Merkle tree (also used for bitmap).
    /// @param recipient Address to receive the tokens.
    /// @param amount   Token amount (6-decimal USDC).
    /// @param payoutRef Arbitrary reference hash (e.g. receipt IPFS CID).
    /// @param proof    Merkle proof siblings.
    function claim(
        uint256 roundId,
        uint256 index,
        address recipient,
        uint256 amount,
        bytes32 payoutRef,
        bytes32[] calldata proof
    ) external {
        Round storage r = rounds[roundId];
        if (!r.active) revert RoundNotActive();
        if (isClaimed(roundId, index)) revert AlreadyClaimed();

        bytes32 leaf = keccak256(abi.encodePacked(index, recipient, amount, payoutRef));
        if (!MerkleProof.verify(proof, r.merkleRoot, leaf)) revert InvalidProof();

        // Mark claimed in bitmap
        uint256 wordIndex = index / 256;
        uint256 bitIndex = index % 256;
        _claimedBitmap[roundId][wordIndex] |= (1 << bitIndex);

        r.claimedAmount += amount;
        token.safeTransfer(recipient, amount);

        emit Claimed(roundId, index, recipient, amount, payoutRef);
    }
}

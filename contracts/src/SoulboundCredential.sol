// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title SoulboundCredential
/// @notice Non-transferable ERC-721 tokens issued to verified NGOs.
///         Acts as on-chain identity: other contracts can gate access
///         via `balanceOf(ngo) > 0`.
contract SoulboundCredential is ERC721, AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    uint256 private _nextTokenId;

    /// @notice Timestamp when each address was first issued a credential.
    mapping(address => uint256) public verifiedSince;

    /// @notice Per-token metadata URI (NGO name, region, verification details).
    mapping(uint256 => string) private _tokenURIs;

    // ── Events ────────────────────────────────────────────────────────────
    event CredentialIssued(address indexed ngo, uint256 indexed tokenId, string metadataURI);
    event CredentialRevoked(address indexed ngo, uint256 indexed tokenId);

    // ── Errors ────────────────────────────────────────────────────────────
    error Soulbound();
    error AlreadyVerified();

    constructor(address admin)
        ERC721("CrisisChain NGO Credential", "ccNGO")
    {
        if (admin == address(0)) revert();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ISSUER_ROLE, admin);
    }

    // ── Issue / Revoke ────────────────────────────────────────────────────

    /// @notice Mint a soulbound credential to `ngo`.
    function issue(address ngo, string calldata metadataURI)
        external
        onlyRole(ISSUER_ROLE)
        returns (uint256 tokenId)
    {
        if (balanceOf(ngo) > 0) revert AlreadyVerified();

        tokenId = _nextTokenId++;
        _safeMint(ngo, tokenId);
        _tokenURIs[tokenId] = metadataURI;
        verifiedSince[ngo] = block.timestamp;

        emit CredentialIssued(ngo, tokenId, metadataURI);
    }

    /// @notice Burn the credential, revoking the NGO's verified status.
    function revoke(uint256 tokenId) external onlyRole(ISSUER_ROLE) {
        address owner = ownerOf(tokenId);
        _burn(tokenId);
        delete _tokenURIs[tokenId];
        delete verifiedSince[owner];

        emit CredentialRevoked(owner, tokenId);
    }

    // ── Soulbound overrides (block all transfers) ─────────────────────────

    function transferFrom(address, address, uint256) public pure override {
        revert Soulbound();
    }

    function safeTransferFrom(address, address, uint256, bytes memory) public pure override {
        revert Soulbound();
    }

    function approve(address, uint256) public pure override {
        revert Soulbound();
    }

    function setApprovalForAll(address, bool) public pure override {
        revert Soulbound();
    }

    // ── Metadata ──────────────────────────────────────────────────────────

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return _tokenURIs[tokenId];
    }

    // ── ERC-165 ───────────────────────────────────────────────────────────

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {MockUSDC} from "src/MockUSDC.sol";
import {CrisisPoolVault} from "src/CrisisPoolVault.sol";
import {YieldVault} from "src/YieldVault.sol";
import {MerkleDistributor} from "src/MerkleDistributor.sol";
import {EIP712Reimbursement} from "src/EIP712Reimbursement.sol";
import {SoulboundCredential} from "src/SoulboundCredential.sol";
import {ApprovedItemsRegistry} from "src/ApprovedItemsRegistry.sol";
import {ProofOfDelivery} from "src/ProofOfDelivery.sol";

/// @title DeployAll
/// @notice Deploys the full CrisisChain contract suite and wires permissions.
///         Set USDC_ADDRESS in env to use an existing token; omit it to deploy MockUSDC.
contract DeployAll is Script {
    function run() external {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address admin = vm.addr(privateKey);

        // Use existing USDC or deploy mock
        address tokenAddress;
        try vm.envAddress("USDC_ADDRESS") returns (address existing) {
            tokenAddress = existing;
            console2.log("Using existing USDC:", tokenAddress);
        } catch {
            vm.startBroadcast(privateKey);
            MockUSDC mockUsdc = new MockUSDC();
            vm.stopBroadcast();
            tokenAddress = address(mockUsdc);
            console2.log("Deployed MockUSDC:", tokenAddress);
        }

        vm.startBroadcast(privateKey);

        // 1. CrisisPoolVault
        CrisisPoolVault vault = new CrisisPoolVault(admin, tokenAddress);
        console2.log("CrisisPoolVault:", address(vault));

        // 2. YieldVault (ERC-4626)
        YieldVault yieldVault = new YieldVault(admin, IERC20(tokenAddress));
        console2.log("YieldVault:", address(yieldVault));

        // 3. MerkleDistributor
        MerkleDistributor distributor = new MerkleDistributor(admin, tokenAddress);
        console2.log("MerkleDistributor:", address(distributor));

        // 4. EIP712Reimbursement
        EIP712Reimbursement reimbursement = new EIP712Reimbursement(admin, address(vault));
        console2.log("EIP712Reimbursement:", address(reimbursement));

        // 5. SoulboundCredential
        SoulboundCredential credential = new SoulboundCredential(admin);
        console2.log("SoulboundCredential:", address(credential));

        // 6. ApprovedItemsRegistry
        ApprovedItemsRegistry registry = new ApprovedItemsRegistry(admin);
        console2.log("ApprovedItemsRegistry:", address(registry));

        // 7. ProofOfDelivery
        ProofOfDelivery proofOfDelivery = new ProofOfDelivery(admin, address(vault), address(credential));
        console2.log("ProofOfDelivery:", address(proofOfDelivery));

        // ── Permission wiring ─────────────────────────────────────────────
        vault.grantRole(vault.PAYOUT_ROLE(), address(reimbursement));
        vault.grantRole(vault.PAYOUT_ROLE(), address(proofOfDelivery));
        console2.log("Granted PAYOUT_ROLE to EIP712Reimbursement + ProofOfDelivery");

        // The deployer key (bridge service) gets ORACLE_ROLE so it can
        // auto-attest receipt/geo signals without human intervention.
        proofOfDelivery.grantRole(proofOfDelivery.ORACLE_ROLE(), admin);
        console2.log("Granted ORACLE_ROLE to deployer (bridge service)");

        // Seed registry with common crisis relief items
        registry.addItem(bytes32("rice"), 50_000_000);
        registry.addItem(bytes32("water_filter"), 200_000_000);
        registry.addItem(bytes32("medical_kit"), 500_000_000);
        registry.addItem(bytes32("blankets"), 30_000_000);
        registry.addItem(bytes32("tarpaulin"), 80_000_000);
        registry.addItem(bytes32("cooking_fuel"), 25_000_000);
        registry.addItem(bytes32("hygiene_kit"), 40_000_000);
        registry.addItem(bytes32("mosquito_net"), 15_000_000);
        console2.log("Seeded ApprovedItemsRegistry with 8 items");

        vm.stopBroadcast();

        // ── Summary ───────────────────────────────────────────────────────
        console2.log("---");
        console2.log("Admin:", admin);
        console2.log("Token:", tokenAddress);
        console2.log("---");
        console2.log("All contracts deployed and permissions wired.");
    }
}

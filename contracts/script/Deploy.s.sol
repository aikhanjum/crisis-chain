// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {CrisisPoolVault} from "src/CrisisPoolVault.sol";

contract DeployScript is Script {
    function run() external returns (CrisisPoolVault deployedVault) {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address tokenAddress = vm.envAddress("USDC_ADDRESS");

        address admin = vm.addr(privateKey);

        vm.startBroadcast(privateKey);
        deployedVault = new CrisisPoolVault(admin, tokenAddress);
        vm.stopBroadcast();

        console2.log("CrisisPoolVault deployed at:", address(deployedVault));
        console2.log("Admin:", admin);
        console2.log("Token:", tokenAddress);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {MockUSDC} from "src/MockUSDC.sol";

contract DeployMockUSDC is Script {
    function run() external returns (MockUSDC token) {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(privateKey);
        token = new MockUSDC();
        vm.stopBroadcast();

        console2.log("MockUSDC deployed at:", address(token));
    }
}

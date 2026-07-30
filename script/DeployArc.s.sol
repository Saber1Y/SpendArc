// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script} from "forge-std/Script.sol";
import {SpendArcVault} from "../src/SpendArcVault.sol";

/// @notice Deploy SpendArcVault on Arc testnet.
///         Usage: source .env && forge script script/DeployArc.s.sol --rpc-url $ARC_RPC_URL --private-key $VAULT_OWNER_PK --broadcast
contract DeployArc is Script {
    function run() external returns (SpendArcVault vault) {
        address deployer = vm.addr(vm.envUint("VAULT_OWNER_PK"));

        vm.startBroadcast();
        vault = new SpendArcVault(deployer);
        vm.stopBroadcast();

        console2.log("SpendArcVault deployed at:", address(vault));
        console2.log("Owner:", deployer);
        console2.log("Network: Arc Testnet (5042002)");
    }
}

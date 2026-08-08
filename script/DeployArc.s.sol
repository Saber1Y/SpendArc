// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {SpendArcVault} from "../src/SpendArcVault.sol";

/// @notice Deploy the shared operator SpendArcVault on Arc testnet.
///         Usage: source .env && forge script script/DeployArc.s.sol --rpc-url $ARC_RPC_URL --private-key $VAULT_OWNER_PK --broadcast
contract DeployArc is Script {
    function run() external returns (SpendArcVault vault) {
        address deployer = vm.addr(vm.envUint("VAULT_OWNER_PK"));
        address executor = vm.addr(vm.envUint("EXECUTOR_PRIVATE_KEY"));
        address usdc = vm.envAddress("USDC_ADDRESS");

        vm.startBroadcast();
        vault = new SpendArcVault(deployer, executor, deployer, 5_000_000, 20_000_000, 0, usdc, deployer);
        vm.stopBroadcast();

        console2.log("SpendArcVault deployed at:", address(vault));
        console2.log("Owner/agent:", deployer);
        console2.log("Executor:", executor);
        console2.log("Network: Arc Testnet (5042002)");
    }
}

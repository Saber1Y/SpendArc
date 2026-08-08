// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {SpendArcVaultFactory} from "../src/SpendArcVaultFactory.sol";

/// @notice Deploy the per-user vault factory on Arc testnet.
///         Usage: source .env && forge script script/DeployFactoryArc.s.sol --rpc-url $ARC_RPC_URL --private-key $VAULT_OWNER_PK --broadcast
contract DeployFactoryArc is Script {
    function run() external returns (SpendArcVaultFactory factory) {
        address deployer = vm.addr(vm.envUint("VAULT_OWNER_PK"));
        address executor = vm.addr(vm.envUint("EXECUTOR_PRIVATE_KEY"));
        address usdc = vm.envAddress("USDC_ADDRESS");

        vm.startBroadcast();
        factory = new SpendArcVaultFactory(usdc, executor);
        vm.stopBroadcast();

        console2.log("SpendArcVaultFactory deployed at:", address(factory));
        console2.log("USDC:", usdc);
        console2.log("Platform executor:", executor);
        console2.log("Network: Arc Testnet (5042002)");
    }
}

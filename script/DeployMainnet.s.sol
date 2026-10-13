// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {SpendArcVaultFactory} from "../src/SpendArcVaultFactory.sol";
import {SpendArcVault} from "../src/SpendArcVault.sol";

/// @title DeployMainnet
/// @notice One-command Arc deploy. The only input you must provide is a funded Arc private key:
///
///   PRIVATE_KEY=0x<your-funded-key> forge script script/DeployMainnet.s.sol \
///     --rpc-url https://rpc.mainnet.arc.io --broadcast
///
/// It deploys the SpendArcVaultFactory and then creates the deployer's own vault through it (a
/// ready reference vault with a conservative $1/tx, $5/day leash), printing both addresses to paste
/// into web/.env.local.
///
/// Optional env:
///   EXECUTOR_ADDRESS  - the server signer authorized to call executeSpendFor (recommended to be a
///                       SEPARATE key from the deployer in production). Defaults to the deployer.
///   USDC_ADDRESS      - override the USDC token. Defaults to Arc's native USDC ERC-20 interface.
contract DeployMainnet is Script {
    // Native USDC (ERC-20 interface) - the same fixed address on Arc mainnet and testnet.
    address internal constant ARC_USDC = 0x3600000000000000000000000000000000000000;

    // Conservative starter leash for the deployer's reference vault.
    uint128 internal constant REF_MAX_PER_TX = 1_000_000; // $1 per transaction
    uint128 internal constant REF_DAILY_CAP = 5_000_000; // $5 per day

    function run() external returns (SpendArcVaultFactory factory, address vault) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address executor = vm.envOr("EXECUTOR_ADDRESS", deployer);
        address usdc = vm.envOr("USDC_ADDRESS", ARC_USDC);

        console2.log("Chain id:       ", block.chainid);
        console2.log("Deployer/owner: ", deployer);
        console2.log("Executor:       ", executor);
        console2.log("USDC:           ", usdc);
        if (executor == deployer) {
            console2.log("WARNING: executor == deployer. For production, set EXECUTOR_ADDRESS to a separate key.");
        }

        vm.startBroadcast(pk);
        factory = new SpendArcVaultFactory(usdc, executor);
        // Create the deployer's own vault so there is an immediately usable reference vault.
        vault = factory.createVault(REF_MAX_PER_TX, REF_DAILY_CAP, 0);
        vm.stopBroadcast();

        // Sanity: the factory should have recorded the vault and configured it with canonical USDC.
        require(factory.vaultOf(deployer) == vault, "vault not registered");
        require(SpendArcVault(payable(vault)).usdc() == usdc, "vault USDC mismatch");

        console2.log("");
        console2.log("=== Deployed ===");
        console2.log("SpendArcVaultFactory:", address(factory));
        console2.log("Reference SpendArcVault (deployer-owned):", vault);
        console2.log("");
        console2.log("Paste into web/.env.local:");
        console2.log(string.concat("NEXT_PUBLIC_FACTORY_ADDRESS=", vm.toString(address(factory))));
        console2.log(string.concat("NEXT_PUBLIC_VAULT_ADDRESS=", vm.toString(vault)));
    }
}

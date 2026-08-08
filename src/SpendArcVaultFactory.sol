// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {SpendArcVault} from "./SpendArcVault.sol";

/// @title SpendArcVaultFactory
/// @notice One isolated vault per wallet. Each vault is owned by its creator, holds that
///         creator's USDC, and runs a policy-enforced leash for the creator's own agent
///         address. The platform executor is pre-authorized as a spend-within-policy
///         executor only - it can never change policy, deposit, or withdraw.
contract SpendArcVaultFactory {
    address public immutable usdc;
    address public immutable executor;

    address[] public vaults;
    mapping(address owner => address vault) public vaultOf;
    mapping(address agent => address vault) public vaultByAgent;

    event VaultCreated(address indexed owner, address indexed agent, address vault, uint128 maxPerTx, uint128 dailyCap);

    constructor(address usdc_, address executor_) {
        usdc = usdc_;
        executor = executor_;
    }

    /// @notice Create a vault owned by the caller. The caller's wallet becomes the vault's
    ///         single agent with the given leash; the platform executor is authorized to
    ///         spend on its behalf (bounded by the leash) but holds no other power.
    function createVault(uint128 maxPerTx, uint128 dailyCap, uint64 expiry) external returns (address vault) {
        require(vaultOf[msg.sender] == address(0), "already has vault");
        require(maxPerTx <= dailyCap, "maxPerTx exceeds dailyCap");

        vault = address(new SpendArcVault(msg.sender, executor, msg.sender, maxPerTx, dailyCap, expiry, usdc, msg.sender));
        vaultOf[msg.sender] = vault;
        vaultByAgent[msg.sender] = vault;
        vaults.push(vault);

        emit VaultCreated(msg.sender, msg.sender, vault, maxPerTx, dailyCap);
    }

    function vaultCount() external view returns (uint256) {
        return vaults.length;
    }
}

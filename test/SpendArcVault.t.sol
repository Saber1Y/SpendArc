// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {SpendArcVault} from "../src/SpendArcVault.sol";
import {MockUSD} from "../src/MockUSD.sol";

contract SpendArcVaultTest is Test {
    SpendArcVault vault;
    MockUSD usdc;

    address owner = makeAddr("owner");
    address executor = makeAddr("executor");
    address stranger = makeAddr("stranger");
    address agent = makeAddr("agent");
    address target = makeAddr("target");

    function setUp() public {
        vm.prank(owner);
        vault = new SpendArcVault(owner);
        usdc = new MockUSD();

        usdc.mint(address(vault), 1_000_000e6);
        vm.prank(owner);
        vault.setAgentPolicy(agent, 100e6, 500e6, 0, true);
        vm.prank(owner);
        vault.setAllowedToken(agent, address(usdc), true);
        vm.prank(owner);
        vault.setAllowedTarget(agent, target, true);
        vm.prank(owner);
        vault.setExecutor(executor, true);
    }

    function test_ExecutorCanSpendForAgent() public {
        uint256 before = usdc.balanceOf(target);
        bytes32 actionId = keccak256("approved");

        vm.prank(executor);
        bool approved = vault.executeSpendFor(agent, address(usdc), target, 25e6, "", actionId);

        assertTrue(approved);
        assertEq(usdc.balanceOf(target), before + 25e6);
    }

    function test_OwnerCanSpendForAgent() public {
        bytes32 actionId = keccak256("owner-spend");
        vm.prank(owner);
        bool approved = vault.executeSpendFor(agent, address(usdc), target, 10e6, "", actionId);
        assertTrue(approved);
    }

    function test_Revert_NonAuthorizedCannotSpendFor() public {
        vm.prank(stranger);
        vm.expectRevert(SpendArcVault.NotAuthorized.selector);
        vault.executeSpendFor(agent, address(usdc), target, 1e6, "", keccak256("x"));
    }

    function test_Blocked_OverMaxPerTx_NoTransfer() public {
        uint256 before = usdc.balanceOf(target);
        vm.prank(executor);
        bool approved = vault.executeSpendFor(agent, address(usdc), target, 101e6, "", keccak256("too-big"));
        assertFalse(approved);
        assertEq(usdc.balanceOf(target), before);
    }

    function test_Blocked_TargetNotAllowlisted() public {
        address other = makeAddr("other");
        vm.prank(executor);
        bool approved = vault.executeSpendFor(agent, address(usdc), other, 1e6, "", keccak256("unlisted"));
        assertFalse(approved);
    }

    function test_Blocked_InactiveAgent() public {
        address inactive = makeAddr("inactive");
        vm.prank(owner);
        vault.setAgentPolicy(inactive, 100e6, 500e6, 0, false);
        vm.prank(owner);
        vault.setAllowedToken(inactive, address(usdc), true);
        vm.prank(owner);
        vault.setAllowedTarget(inactive, target, true);

        vm.prank(executor);
        bool approved = vault.executeSpendFor(inactive, address(usdc), target, 1e6, "", keccak256("inactive"));
        assertFalse(approved);
    }

    function test_Blocked_DuplicateActionId() public {
        bytes32 actionId = keccak256("dup");
        vm.prank(executor);
        vault.executeSpendFor(agent, address(usdc), target, 1e6, "", actionId);
        vm.prank(executor);
        bool approved = vault.executeSpendFor(agent, address(usdc), target, 1e6, "", actionId);
        assertFalse(approved);
    }

    function test_SpendFor_DoesNotUseCallerPolicy() public {
        vm.prank(owner);
        vault.setExecutor(stranger, true);
        vm.prank(stranger);
        bool approved = vault.executeSpendFor(agent, address(usdc), target, 50e6, "", keccak256("caller-policy"));
        assertTrue(approved);
        assertEq(usdc.balanceOf(target), 50e6);
    }
}

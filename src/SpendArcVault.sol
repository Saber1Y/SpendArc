// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title SpendArcVault
/// @notice Policy-enforcing spend vault for autonomous AI agents on Arc.
///         The vault holds USDC; a registered agent (or authorized executor) can only call
///         `executeSpend`, which moves value strictly inside its policy (active/expiry,
///         token + target allowlists, per-tx cap, daily cap, actionId dedup).
///         The owner configures the policy. An authorized executor (e.g. server key) can
///         call `executeSpend` on behalf of agents but cannot change policy or withdraw funds.
contract SpendArcVault {
    using SafeERC20 for IERC20;

    address public constant NATIVE = address(0);

    uint256 private constant DAY = 1 days;

    struct Policy {
        uint128 maxPerTx;
        uint128 dailyCap;
        uint128 spentToday;
        uint64 lastResetTime;
        uint64 expiry;
        bool active;
    }

    address public immutable owner;
    bool internal _locked;

    mapping(address agent => Policy) public policies;
    mapping(address agent => mapping(address target => bool)) public allowedTarget;
    mapping(address agent => mapping(address token => bool)) public allowedToken;
    mapping(bytes32 actionId => bool used) public usedAction;

    event VaultFunded(address indexed from, uint256 amount);
    event PolicyCreated(address indexed agent, uint128 maxPerTx, uint128 dailyCap, uint64 expiry, bool active);
    event PolicyUpdated(address indexed agent, uint128 maxPerTx, uint128 dailyCap, uint64 expiry, bool active);
    event TargetAllowlisted(address indexed agent, address indexed target, bool allowed);
    event TokenAllowlisted(address indexed agent, address indexed token, bool allowed);
    event AgentRevoked(address indexed agent);
    event AgentActionApproved(
        address indexed agent, address indexed target, address indexed token, uint256 amount, bytes32 actionId
    );
    event AgentActionBlocked(
        address indexed agent, address indexed target, address indexed token, uint256 amount, string reason
    );
    event ReceiptIssued(
        address indexed agent,
        address indexed target,
        address token,
        uint256 amount,
        bytes32 actionId,
        uint256 timestamp
    );

    error NotOwner();
    error Reentrancy();
    error NativeTransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (_locked) revert Reentrancy();
        _locked = true;
        _;
        _locked = false;
    }

    constructor(address owner_) {
        owner = owner_;
    }

    receive() external payable {
        emit VaultFunded(msg.sender, msg.value);
    }

    // ---------------------------------------------------------------------
    // Owner configuration
    // ---------------------------------------------------------------------

    function setAgentPolicy(address agent, uint128 maxPerTx, uint128 dailyCap, uint64 expiry, bool active)
        external
        onlyOwner
    {
        Policy storage p = policies[agent];
        bool creating = p.lastResetTime == 0;

        p.maxPerTx = maxPerTx;
        p.dailyCap = dailyCap;
        p.expiry = expiry;
        p.active = active;

        if (creating) {
            p.lastResetTime = uint64(block.timestamp);
            emit PolicyCreated(agent, maxPerTx, dailyCap, expiry, active);
        } else {
            emit PolicyUpdated(agent, maxPerTx, dailyCap, expiry, active);
        }
    }

    function setAllowedTarget(address agent, address target, bool allowed) external onlyOwner {
        allowedTarget[agent][target] = allowed;
        emit TargetAllowlisted(agent, target, allowed);
    }

    function setAllowedToken(address agent, address token, bool allowed) external onlyOwner {
        allowedToken[agent][token] = allowed;
        emit TokenAllowlisted(agent, token, allowed);
    }

    function revokeAgent(address agent) external onlyOwner {
        policies[agent].active = false;
        emit AgentRevoked(agent);
    }

    // ---------------------------------------------------------------------
    // Agent action
    // ---------------------------------------------------------------------

    function executeSpend(address token, address target, uint256 amount, bytes calldata data, bytes32 actionId)
        external
        nonReentrant
        returns (bool approved)
    {
        Policy storage p = policies[msg.sender];

        if (!p.active) {
            emit AgentActionBlocked(msg.sender, target, token, amount, "agent not active");
            return false;
        }
        if (p.expiry != 0 && block.timestamp > p.expiry) {
            emit AgentActionBlocked(msg.sender, target, token, amount, "policy expired");
            return false;
        }
        if (!allowedToken[msg.sender][token]) {
            emit AgentActionBlocked(msg.sender, target, token, amount, "token not allowlisted");
            return false;
        }
        if (!allowedTarget[msg.sender][target]) {
            emit AgentActionBlocked(msg.sender, target, token, amount, "target not allowlisted");
            return false;
        }
        if (amount > p.maxPerTx) {
            emit AgentActionBlocked(msg.sender, target, token, amount, "exceeds maxPerTx");
            return false;
        }

        uint256 spent = p.spentToday;
        uint64 resetTime = p.lastResetTime;
        if (block.timestamp >= uint256(resetTime) + DAY) {
            spent = 0;
            resetTime = uint64(block.timestamp);
        }
        if (spent + amount > p.dailyCap) {
            emit AgentActionBlocked(msg.sender, target, token, amount, "exceeds dailyCap");
            return false;
        }
        if (usedAction[actionId]) {
            emit AgentActionBlocked(msg.sender, target, token, amount, "duplicate action");
            return false;
        }

        usedAction[actionId] = true;
        p.spentToday = uint128(spent + amount);
        p.lastResetTime = resetTime;

        if (token == NATIVE) {
            (bool ok,) = target.call{value: amount}(data);
            if (!ok) revert NativeTransferFailed();
        } else {
            IERC20(token).safeTransfer(target, amount);
        }

        emit AgentActionApproved(msg.sender, target, token, amount, actionId);
        emit ReceiptIssued(msg.sender, target, token, amount, actionId, block.timestamp);
        return true;
    }

    // ---------------------------------------------------------------------
    // Owner withdrawal
    // ---------------------------------------------------------------------

    /// @notice Owner can withdraw any ERC20 token held by the vault.
    function withdrawTokens(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function getPolicy(address agent) external view returns (Policy memory) {
        return policies[agent];
    }

    function remainingDailyCap(address agent) external view returns (uint256) {
        Policy memory p = policies[agent];
        uint256 spent = p.spentToday;
        if (block.timestamp >= uint256(p.lastResetTime) + DAY) {
            spent = 0;
        }
        if (spent >= p.dailyCap) {
            return 0;
        }
        return p.dailyCap - spent;
    }

    function isAllowed(address agent, address target, address token) external view returns (bool) {
        return allowedTarget[agent][target] && allowedToken[agent][token];
    }
}

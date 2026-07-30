import {parseAbi, type Address} from "viem";
import {USDC_ADDRESS} from "./arc";

/** SpendArc deployment on Arc testnet. Addresses are populated after deployment. */
export const CONTRACTS = {
  usdc: USDC_ADDRESS,
  vault: (process.env.NEXT_PUBLIC_VAULT_ADDRESS || "0x0000000000000000000000000000000000000000") as Address,
} as const satisfies Record<string, Address>;

export const USDC_DECIMALS = 6;

export const vaultAbi = parseAbi([
  // reads
  "function getPolicy(address agent) view returns ((uint128 maxPerTx,uint128 dailyCap,uint128 spentToday,uint64 lastResetTime,uint64 expiry,bool active))",
  "function remainingDailyCap(address agent) view returns (uint256)",
  "function isAllowed(address agent,address target,address token) view returns (bool)",
  "function allowedTarget(address agent,address target) view returns (bool)",
  "function allowedToken(address agent,address token) view returns (bool)",
  "function usedAction(bytes32 actionId) view returns (bool)",
  "function owner() view returns (address)",
  "function NATIVE() view returns (address)",
  // owner writes
  "function setAgentPolicy(address agent,uint128 maxPerTx,uint128 dailyCap,uint64 expiry,bool active)",
  "function setAllowedTarget(address agent,address target,bool allowed)",
  "function setAllowedToken(address agent,address token,bool allowed)",
  "function revokeAgent(address agent)",
  // events
  "event AgentActionApproved(address indexed agent,address indexed target,address indexed token,uint256 amount,bytes32 actionId)",
  "event AgentActionBlocked(address indexed agent,address indexed target,address indexed token,uint256 amount,string reason)",
  "event ReceiptIssued(address indexed agent,address indexed target,address token,uint256 amount,bytes32 actionId,uint256 timestamp)",
  "event VaultFunded(address indexed from,uint256 amount)",
  "event PolicyCreated(address indexed agent,uint128 maxPerTx,uint128 dailyCap,uint64 expiry,bool active)",
  "event PolicyUpdated(address indexed agent,uint128 maxPerTx,uint128 dailyCap,uint64 expiry,bool active)",
  "event TargetAllowlisted(address indexed agent,address indexed target,bool allowed)",
  "event TokenAllowlisted(address indexed agent,address indexed token,bool allowed)",
  "event AgentRevoked(address indexed agent)",
]);

export const usdcAbi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function transfer(address to,uint256 amount) returns (bool)",
  "event Transfer(address indexed from,address indexed to,uint256 value)",
]);

export const entryPointAbi = parseAbi(["function balanceOf(address) view returns (uint256)"]);

import type {Address} from "viem";
import {publicClient} from "./chain";
import {CONTRACTS, vaultAbi, usdcAbi} from "./contracts";

export interface Policy {
  maxPerTx: bigint;
  dailyCap: bigint;
  spentToday: bigint;
  lastResetTime: bigint;
  expiry: bigint;
  active: boolean;
}

export interface VaultState {
  vaultBalance: bigint;
  policy: Policy;
  remainingDailyCap: bigint;
  tokenAllowed: boolean;
  agentDeployed: boolean;
  vaultOwner: Address;
}

/** One batched load of every read the dashboard shows, keyed on the agent ADDRESS. */
export async function readVaultState(agent: Address): Promise<VaultState> {
  const vault = CONTRACTS.vault;
  const [
    vaultBalance,
    policy,
    remainingDailyCap,
    tokenAllowed,
    agentCode,
    vaultOwner,
  ] = await Promise.all([
    publicClient.readContract({address: CONTRACTS.usdc, abi: usdcAbi, functionName: "balanceOf", args: [vault]}),
    publicClient.readContract({address: vault, abi: vaultAbi, functionName: "getPolicy", args: [agent]}),
    publicClient.readContract({address: vault, abi: vaultAbi, functionName: "remainingDailyCap", args: [agent]}),
    publicClient.readContract({address: vault, abi: vaultAbi, functionName: "allowedToken", args: [agent, CONTRACTS.usdc]}),
    publicClient.getCode({address: agent}),
    publicClient.readContract({address: vault, abi: vaultAbi, functionName: "owner", args: []}),
  ]);

  return {
    vaultBalance: vaultBalance as bigint,
    policy: policy as Policy,
    remainingDailyCap: remainingDailyCap as bigint,
    tokenAllowed: tokenAllowed as boolean,
    agentDeployed: agentCode !== undefined && agentCode !== "0x",
    vaultOwner: vaultOwner as Address,
  };
}

export type ActionKind = "approved" | "blocked";
export interface AgentAction {
  kind: ActionKind;
  agent: Address;
  target: Address;
  token: Address;
  amount: bigint;
  reason?: string;
  actionId?: string;
  blockNumber: bigint;
  txHash: string;
  logIndex: number;
}

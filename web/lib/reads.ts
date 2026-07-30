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

async function sequential(tasks: (() => Promise<unknown>)[], gap = 150) {
  const results: unknown[] = [];
  for (let i = 0; i < tasks.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, gap));
    results.push(await tasks[i]());
  }
  return results;
}

/** One batched load of every read the dashboard shows, keyed on the agent ADDRESS. Sequential reads with delay to avoid Arc testnet RPC rate limits. */
export async function readVaultState(agent: Address): Promise<VaultState> {
  const vault = CONTRACTS.vault;
  const [
    vaultBalance,
    policy,
    remainingDailyCap,
    tokenAllowed,
    agentCode,
    vaultOwner,
  ] = await sequential([
    () => publicClient.readContract({address: CONTRACTS.usdc, abi: usdcAbi, functionName: "balanceOf", args: [vault]}),
    () => publicClient.readContract({address: vault, abi: vaultAbi, functionName: "getPolicy", args: [agent]}),
    () => publicClient.readContract({address: vault, abi: vaultAbi, functionName: "remainingDailyCap", args: [agent]}),
    () => publicClient.readContract({address: vault, abi: vaultAbi, functionName: "allowedToken", args: [agent, CONTRACTS.usdc]}),
    () => publicClient.getCode({address: agent}),
    () => publicClient.readContract({address: vault, abi: vaultAbi, functionName: "owner", args: []}),
  ]);

  return {
    vaultBalance: vaultBalance as bigint,
    policy: policy as Policy,
    remainingDailyCap: remainingDailyCap as bigint,
    tokenAllowed: tokenAllowed as boolean,
    agentDeployed: (agentCode as `0x${string}`) !== undefined && (agentCode as `0x${string}`) !== "0x",
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

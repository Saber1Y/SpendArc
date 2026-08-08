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

/** True when the Arc testnet RPC rejected the request for exceeding its rate limit. */
function isRateLimited(e: unknown): boolean {
  return e instanceof Error && /request limit reached/i.test(e.message);
}

/** Retry a read with exponential backoff when the RPC rate-limits us. */
async function withRetry<T>(fn: () => Promise<T>, tries = 4): Promise<T> {
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (!isRateLimited(e) || attempt === tries - 1) throw e;
      await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
    }
  }
  throw new Error("unreachable");
}

/**
 * Global FIFO queue for all Arc RPC reads. The testnet RPC rejects bursts of parallel
 * eth_calls ("request limit reached"), and reads from multiple hooks/pages can otherwise
 * interleave. Serializing every read through this chain prevents that.
 */
let readChain: Promise<unknown> = Promise.resolve();

function enqueueRead<T>(fn: () => Promise<T>): Promise<T> {
  const run = readChain.then(fn, fn);
  readChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function sequential(tasks: (() => Promise<unknown>)[], gap = 250) {
  const results: unknown[] = [];
  for (let i = 0; i < tasks.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, gap));
    results.push(await withRetry(tasks[i]));
  }
  return results;
}

/** One batched load of every read the dashboard shows, keyed on the agent ADDRESS and the vault that governs it. Reads are serialized globally, spaced out, and retried on rate limits. */
export async function readVaultState(agent: Address, vault: Address): Promise<VaultState> {
  return enqueueRead(async () => {
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
  });
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

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

// Canonical Multicall3 (deployed at the same address on Arc). Passed explicitly so viem batches
// the dashboard's reads even though the Arc chain def may not carry a multicall3 entry.
const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11" as Address;

/**
 * One batched load of every read the dashboard shows, keyed on the agent ADDRESS and the vault
 * that governs it. The five contract reads go in a single Multicall3 call (one round-trip through
 * the RPC proxy) instead of six spaced-out sequential calls, so a cold dashboard resolves in well
 * under a second. getCode runs in parallel. Still serialized globally and retried on rate limits.
 */
export async function readVaultState(agent: Address, vault: Address): Promise<VaultState> {
  return enqueueRead(() =>
    withRetry(async () => {
      const [results, agentCode] = await Promise.all([
        publicClient.multicall({
          multicallAddress: MULTICALL3,
          allowFailure: false,
          contracts: [
            {address: CONTRACTS.usdc, abi: usdcAbi, functionName: "balanceOf", args: [vault]},
            {address: vault, abi: vaultAbi, functionName: "getPolicy", args: [agent]},
            {address: vault, abi: vaultAbi, functionName: "remainingDailyCap", args: [agent]},
            {address: vault, abi: vaultAbi, functionName: "allowedToken", args: [agent, CONTRACTS.usdc]},
            {address: vault, abi: vaultAbi, functionName: "owner", args: []},
          ],
        }),
        publicClient.getCode({address: agent}),
      ]);
      const [vaultBalance, policy, remainingDailyCap, tokenAllowed, vaultOwner] = results;

      return {
        vaultBalance: vaultBalance as bigint,
        policy: policy as Policy,
        remainingDailyCap: remainingDailyCap as bigint,
        tokenAllowed: tokenAllowed as boolean,
        agentDeployed: agentCode !== undefined && agentCode !== "0x",
        vaultOwner: vaultOwner as Address,
      };
    }),
  );
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

import {decodeEventLog, getAbiItem, type Hex} from "viem";
import {publicClient} from "./chain";
import {vaultAbi, CONTRACTS} from "./contracts";

export interface ProofResult {
  kind: "approved" | "blocked";
  amount: bigint;
  reason?: string;
  txHash?: Hex;
  source: "chain" | "snapshot"; // chain = live read from the vault receipt, snapshot = static fallback
}

/**
 * Real confirmed SpendArcVault events on Arc testnet - an approved spend and a
 * blocked spend against the same 5 USDC per-tx policy. Receipts are immutable,
 * so these hashes stay valid and are re-read live on every page load.
 */
export const PROOF_TX: Record<"approved" | "blocked", Hex> = {
  approved: "0xa12953915fba548cb16128bb53fa5c51c406f7d051a922db8dc0b2be3678ad5b",
  blocked: "0x892fa9cf430c86a1fa5266ca2ca1b9617694ce1579fa223e672bf67c652fc81b",
};

/** Known real values (read from the vault receipts above) - the honest fallback if the live read fails. */
const SNAPSHOT: Record<"approved" | "blocked", ProofResult> = {
  approved: {kind: "approved", amount: 1_500_000n, txHash: PROOF_TX.approved, source: "snapshot"},
  blocked: {kind: "blocked", amount: 6_000_000n, reason: "exceeds maxPerTx", txHash: PROOF_TX.blocked, source: "snapshot"},
};

const approvedEvent = getAbiItem({abi: vaultAbi, name: "AgentActionApproved"});
const blockedEvent = getAbiItem({abi: vaultAbi, name: "AgentActionBlocked"});

/** Live-fetch a proof tx's vault event via raw receipt (no viem formatter), decode the amount/reason. */
export async function fetchProof(kind: "approved" | "blocked", txHash: Hex = PROOF_TX[kind]): Promise<ProofResult> {
  const evt = kind === "approved" ? approvedEvent : blockedEvent;
  try {
    const receipt = (await publicClient.request({
      method: "eth_getTransactionReceipt",
      params: [txHash],
    })) as {logs?: {address: string; data: Hex; topics: [Hex, ...Hex[]]}[]} | null;
    if (!receipt?.logs) return SNAPSHOT[kind];
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== CONTRACTS.vault.toLowerCase()) continue;
      try {
        const dec = decodeEventLog({abi: [evt], data: log.data, topics: log.topics});
        if (dec.eventName === evt.name) {
          const args = dec.args as {amount: bigint; reason?: string};
          return {kind, amount: args.amount, reason: args.reason, txHash, source: "chain"};
        }
      } catch {
        /* not this event - keep scanning */
      }
    }
    return SNAPSHOT[kind];
  } catch {
    return SNAPSHOT[kind];
  }
}

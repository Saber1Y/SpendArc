import {decodeEventLog, getAbiItem, type Address, type Hex} from "viem";
import {publicClient} from "./chain";
import {vaultAbi} from "./contracts";

export interface ProofResult {
  kind: "approved" | "blocked";
  amount: bigint;
  reason?: string;
  txHash?: Hex;
  source: "chain" | "db" | "snapshot"; // chain = live read from the vault receipt, db = app decision record, snapshot = static fallback
}

/**
 * Static fallback receipts - two real SpendArcVault events (approved 1.5 USDC, blocked 6 USDC
 * vs a 5 USDC cap). These are immutable and stay valid; the live proof prefers the most recent
 * transactions from the app DB so the landing page always reflects the current demo run.
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

/**
 * Live-fetch a proof tx's vault event via raw receipt (no viem formatter), decode the amount/reason.
 * Works for any SpendArcVault - per-user vaults deployed by the factory share the same ABI.
 */
export async function fetchProof(kind: "approved" | "blocked", txHash: Hex = PROOF_TX[kind]): Promise<ProofResult> {
  const evt = kind === "approved" ? approvedEvent : blockedEvent;
  try {
    const receipt = (await publicClient.request({
      method: "eth_getTransactionReceipt",
      params: [txHash],
    })) as {logs?: {address: Address; data: Hex; topics: [Hex, ...Hex[]]}[]} | null;
    if (!receipt?.logs) return SNAPSHOT[kind];
    for (const log of receipt.logs) {
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

interface ProofTx {
  txHash: string | null;
  amountRaw: string | null;
  reason: string | null;
}

/**
 * Prefer the app's most recent real transactions (approved + blocked) for the live proof;
 * fall back to the static receipts when the DB is empty.
 */
export async function fetchLatestProofs(): Promise<{approved: ProofResult; blocked: ProofResult}> {
  try {
    const res = await fetch("/api/transactions/proof", {cache: "no-store"});
    const data = (await res.json()) as {approved?: ProofTx | null; blocked?: ProofTx | null};
    const approved: ProofResult = data.approved?.txHash
      ? await fetchProof("approved", data.approved.txHash as Hex)
      : await fetchProof("approved");
    const blocked: ProofResult = data.blocked?.txHash
      ? await fetchProof("blocked", data.blocked.txHash as Hex)
      : data.blocked?.amountRaw
        ? {kind: "blocked", amount: BigInt(data.blocked.amountRaw), reason: data.blocked.reason ?? undefined, source: "db"}
        : await fetchProof("blocked");
    return {approved, blocked};
  } catch {
    return {approved: await fetchProof("approved"), blocked: await fetchProof("blocked")};
  }
}

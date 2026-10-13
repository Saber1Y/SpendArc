"use client";

import {useCallback, useEffect, useState} from "react";
import {isAddress, type Address} from "viem";
import {CONTRACTS, vaultAbi} from "@/lib/contracts";
import {useVaultState, useApiAgents} from "@/lib/hooks";
import {isSameAddress, truncateAddress} from "@/lib/format";
import {useActiveAddress} from "@/lib/usePrivyWallet";
import {useOwnerWrite} from "@/lib/useOwnerWrite";

/** Parse a USD budget string (e.g. "2.5") into whole-USDC units, or null when blank/invalid. */
function parseBudgetUsdc(v: string): number | null {
  const n = Number(v);
  if (!isFinite(n) || n <= 0) return null;
  return n;
}

type ApiRecipient = {id: number; address: string; label: string; max_per_tx_usdc: number | null; daily_cap_usdc: number | null};

/**
 * Allowlist management. The on-chain vault is the single source of truth: every change is an
 * owner-signed `setAllowedService` transaction against the user's own vault. After it confirms we
 * call /api/allowlist/[agentId]/sync, which re-reads the vault and mirrors it into the server
 * policy store. The server store is never written directly, so the two fences can never drift
 * apart in a way that loosens policy.
 */
function RecipientSection({isOwner, agent, agentId, vault, refetch}: {
  isOwner: boolean;
  agent: Address;
  agentId: string;
  vault: Address;
  refetch: () => void;
}) {
  const [target, setTarget] = useState("");
  const [label, setLabel] = useState("");
  const [maxPerTx, setMaxPerTx] = useState("");
  const [dailyCap, setDailyCap] = useState("");
  const [apiRecipients, setApiRecipients] = useState<ApiRecipient[]>([]);
  const [error, setError] = useState("");
  const write = useOwnerWrite(refetch);

  const loadMirror = useCallback(() => {
    if (!agentId) return;
    fetch(`/api/allowlist/${agentId}`)
      .then((r) => r.json())
      .then((d) => setApiRecipients(d.recipients ?? []))
      .catch(() => {});
  }, [agentId]);

  useEffect(() => {
    loadMirror();
  }, [loadMirror]);

  /** Mirror the confirmed on-chain allowlist change into the server store. */
  const syncMirror = async (address: string, allowed: boolean, lbl: string, mpt: number | null, dc: number | null) => {
    try {
      await fetch(`/api/allowlist/${agentId}/sync`, {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({address, allowed, label: lbl, maxPerTxUsdc: mpt, dailyCapUsdc: dc}),
      });
    } catch {
      // The on-chain fence already enforces the change; the mirror will reconcile on next load.
    }
    loadMirror();
  };

  const addRecipient = async () => {
    if (!isAddress(target)) return;
    setError("");
    const mpt = parseBudgetUsdc(maxPerTx);
    const dc = parseBudgetUsdc(dailyCap);
    if (mpt != null && dc != null && mpt > dc) {
      setError("Per-tx budget cannot exceed the daily budget.");
      return;
    }
    const ok = await write.run({
      address: vault,
      abi: vaultAbi,
      functionName: "setAllowedService",
      args: [agent, target as Address, label || "service", BigInt(Math.round((mpt ?? 0) * 1e6)), BigInt(Math.round((dc ?? 0) * 1e6)), 0n, true],
    });
    if (ok) {
      await syncMirror(target, true, label || "service", mpt, dc);
      setTarget("");
      setLabel("");
      setMaxPerTx("");
      setDailyCap("");
    }
  };

  const removeRecipient = async (address: string, lbl: string) => {
    const ok = await write.run({
      address: vault,
      abi: vaultAbi,
      functionName: "setAllowedService",
      args: [agent, address as Address, lbl || "service", 0n, 0n, 0n, false],
    });
    if (ok) await syncMirror(address, false, lbl, null, null);
  };

  return (
    <div className="kpi-card p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-[13px] font-semibold text-text-primary">Allowed Recipients</div>
          <div className="text-[12px] text-text-muted mt-0.5">Services the agent may pay, enforced on-chain and mirrored to the policy fence</div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-3 text-[11px] font-medium text-text-muted uppercase tracking-wider">Address</th>
              <th className="text-left py-2 px-3 text-[11px] font-medium text-text-muted uppercase tracking-wider">Label</th>
              <th className="text-left py-2 px-3 text-[11px] font-medium text-text-muted uppercase tracking-wider">Per-Tx</th>
              <th className="text-left py-2 px-3 text-[11px] font-medium text-text-muted uppercase tracking-wider">Daily</th>
              {isOwner && <th className="text-right py-2 px-3 text-[11px] font-medium text-text-muted uppercase tracking-wider">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {apiRecipients.length === 0 ? (
              <tr>
                <td colSpan={isOwner ? 5 : 4} className="py-4 text-center text-[12px] text-text-muted">
                  No recipients allowlisted yet.
                </td>
              </tr>
            ) : (
              apiRecipients.map((r) => (
                <tr key={r.id} className="hover:bg-surface-hover/50">
                  <td className="py-2 px-3 font-mono text-text-primary text-[12px]">{truncateAddress(r.address as `0x${string}`)}</td>
                  <td className="py-2 px-3 text-text-muted text-[12px]">{r.label || "-"}</td>
                  <td className="py-2 px-3 text-text-muted text-[12px]">{r.max_per_tx_usdc != null ? `$${(r.max_per_tx_usdc / 1e6).toFixed(2)}` : "unlimited"}</td>
                  <td className="py-2 px-3 text-text-muted text-[12px]">{r.daily_cap_usdc != null ? `$${(r.daily_cap_usdc / 1e6).toFixed(2)}/day` : "unlimited"}</td>
                  {isOwner && (
                    <td className="py-2 px-3 text-right">
                      <button onClick={() => removeRecipient(r.address, r.label)} disabled={write.pending} className="text-[12px] text-state-blocked hover:underline disabled:opacity-50">
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isOwner ? (
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_110px_100px_100px_auto]">
          <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="0x..." spellCheck={false}
            className="rounded-lg border border-border bg-white px-3 py-2 text-[13px] text-text-primary font-mono outline-none focus:border-accent" />
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label"
            className="rounded-lg border border-border bg-white px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent" />
          <input value={maxPerTx} onChange={(e) => setMaxPerTx(e.target.value)} placeholder="$/tx" inputMode="decimal"
            className="rounded-lg border border-border bg-white px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent" />
          <input value={dailyCap} onChange={(e) => setDailyCap(e.target.value)} placeholder="$/day" inputMode="decimal"
            className="rounded-lg border border-border bg-white px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent" />
          <button onClick={addRecipient} disabled={!isAddress(target) || write.pending}
            className="rounded-lg bg-accent px-4 py-2 text-[12px] font-medium text-white hover:bg-accent-hover disabled:opacity-50">
            {write.pending ? "Signing..." : "Allow service"}
          </button>
        </div>
      ) : (
        <div className="mt-4 text-[12px] text-text-muted">Connect the vault owner wallet to manage the allowlist.</div>
      )}
      {(error || write.error) && <div className="text-[12px] text-state-blocked mt-2">{error || write.error}</div>}
    </div>
  );
}

export default function AllowlistPage() {
  const {agents} = useApiAgents();
  const agent = agents[0];
  const agentAddress = (agent?.address ?? "0x0000000000000000000000000000000000000000") as Address;
  const agentId = agent?.id ?? "";
  const vaultAddress = (agent?.vault_address as Address | undefined) ?? CONTRACTS.vault;
  const {data: state, refetch} = useVaultState(agentAddress, vaultAddress);
  const {address, isConnected} = useActiveAddress();
  const isOwner = isConnected && !!state && isSameAddress(address, state.vaultOwner);

  return (
    <div className="p-8 max-w-[1200px] mx-auto">
      <div className="mb-6" data-aos="fade-up">
        <h1 className="text-[20px] font-semibold text-text-primary tracking-tight">Allowlist</h1>
        <p className="text-[13px] text-text-muted mt-1">Services your agent may pay. Changes are signed on-chain and mirrored to the policy fence.</p>
      </div>

      {!isOwner && isConnected && (
        <div className="mb-6 rounded-lg border border-state-pending/30 bg-state-pending-light p-4 text-[12px] text-text-muted" data-aos="fade-up">
          Connect the vault owner wallet to manage the allowlist.
        </div>
      )}

      {!agentId ? (
        <div className="rounded-lg border border-border p-6 text-[13px] text-text-muted">Register an agent first to manage its allowlist.</div>
      ) : (
        <div className="space-y-6">
          <div data-aos="fade-up">
            <RecipientSection isOwner={isOwner} agent={agentAddress} agentId={agentId} vault={vaultAddress} refetch={refetch} />
          </div>
        </div>
      )}
    </div>
  );
}

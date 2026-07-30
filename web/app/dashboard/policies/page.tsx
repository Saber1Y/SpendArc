"use client";

import {useState} from "react";
import {parseUnits, type Address} from "viem";
import {useAccount} from "wagmi";
import {CONTRACTS, USDC_DECIMALS, vaultAbi} from "@/lib/contracts";
import {useVaultState} from "@/lib/hooks";
import {isSameAddress, formatUsdc, formatExpiry, truncateAddress} from "@/lib/format";
import {useOwnerWrite} from "@/lib/useOwnerWrite";
import {Field, TextInput, Toggle} from "@/components/ui/Input";

function PolicyStatus({active, expiry}: {active: boolean; expiry: bigint}) {
  const exp = formatExpiry(expiry);
  return (
    <div className="flex items-center gap-3">
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium ${
        active ? "bg-state-approved-light text-state-approved" : "bg-state-blocked-light text-state-blocked"
      }`}>
        <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-state-approved" : "bg-state-blocked"}`} />
        {active ? "Active" : "Revoked"}
      </span>
      <span className="text-[12px] text-text-muted">Expires {exp.label}</span>
    </div>
  );
}

function PolicyForm({agent, state, refetch}: {agent: Address; state: NonNullable<ReturnType<typeof useVaultState>["data"]>; refetch: () => void}) {
  const [editing, setEditing] = useState(false);
  const [maxPerTx, setMaxPerTx] = useState(formatUsdc(state.policy.maxPerTx));
  const [dailyCap, setDailyCap] = useState(formatUsdc(state.policy.dailyCap));
  const [days, setDays] = useState("30");
  const [active, setActive] = useState(state.policy.active);
  const write = useOwnerWrite(() => { refetch(); setEditing(false); });

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="rounded-lg border border-border px-4 py-2 text-[12px] font-medium text-text-secondary hover:bg-surface-hover transition-colors"
      >
        Edit Policy
      </button>
    );
  }

  const submit = () => {
    let mpt: bigint, dc: bigint;
    try {
      mpt = parseUnits(maxPerTx || "0", USDC_DECIMALS);
      dc = parseUnits(dailyCap || "0", USDC_DECIMALS);
    } catch { return; }
    const d = Number(days);
    const expiry = !d || d <= 0 ? 0n : BigInt(Math.floor(Date.now() / 1000) + d * 86400);
    write.run({
      address: CONTRACTS.vault,
      abi: vaultAbi,
      functionName: "setAgentPolicy",
      args: [agent, mpt, dc, expiry, active],
    });
  };

  return (
    <div className="space-y-4 p-4 rounded-lg border border-accent/20 bg-accent-light/30">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Per-tx cap (mUSD)">
          <TextInput inputMode="decimal" value={maxPerTx} onChange={(e) => setMaxPerTx(e.target.value)} />
        </Field>
        <Field label="Daily cap (mUSD)">
          <TextInput inputMode="decimal" value={dailyCap} onChange={(e) => setDailyCap(e.target.value)} />
        </Field>
        <Field label="Expiry (days from now)" hint="0 = never expires">
          <TextInput inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
        </Field>
        <Field label="Active">
          <Toggle checked={active} onChange={setActive} label={active ? "policy active" : "inactive"} />
        </Field>
      </div>
      {write.error && <div className="text-[12px] text-state-blocked">{write.error}</div>}
      <div className="flex items-center gap-3">
        <button onClick={submit} disabled={write.pending} className="rounded-lg bg-accent px-4 py-2 text-[12px] font-medium text-white hover:bg-accent-hover disabled:opacity-50">
          {write.pending ? "Saving..." : "Save Policy"}
        </button>
        <button onClick={() => setEditing(false)} disabled={write.pending} className="rounded-lg border border-border px-4 py-2 text-[12px] font-medium text-text-secondary hover:bg-surface-hover disabled:opacity-50">
          Cancel
        </button>
      </div>
      {write.pending && <div className="text-[12px] text-text-muted">Confirming on-chain...</div>}
    </div>
  );
}

function EmergencyRevoke({agent, isOwner, refetch}: {agent: Address; isOwner: boolean; refetch: () => void}) {
  const [confirming, setConfirming] = useState(false);
  const write = useOwnerWrite(() => { refetch(); setConfirming(false); });

  return (
    <div className="kpi-card p-5 border border-state-blocked/20">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[13px] font-semibold text-text-primary">Emergency Revoke</div>
          <div className="text-[12px] text-text-muted mt-0.5">
            Immediately disable the agent&apos;s ability to initiate new spending requests.
          </div>
        </div>
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            disabled={!isOwner || write.pending}
            className="rounded-lg border border-state-blocked/30 bg-state-blocked-light px-4 py-2 text-[12px] font-medium text-state-blocked hover:bg-state-blocked/10 disabled:opacity-50 transition-colors"
          >
            Revoke Agent
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => write.run({address: CONTRACTS.vault, abi: vaultAbi, functionName: "revokeAgent", args: [agent]})}
              disabled={write.pending}
              className="rounded-lg bg-state-blocked px-4 py-2 text-[12px] font-medium text-white hover:bg-state-blocked/90 disabled:opacity-50"
            >
              {write.pending ? "Revoking..." : "Confirm Revoke"}
            </button>
            <button onClick={() => setConfirming(false)} disabled={write.pending} className="rounded-lg border border-border px-4 py-2 text-[12px] font-medium text-text-secondary hover:bg-surface-hover disabled:opacity-50">
              Cancel
            </button>
          </div>
        )}
      </div>
      {write.error && <div className="text-[12px] text-state-blocked mt-3">{write.error}</div>}
    </div>
  );
}

export default function PoliciesPage() {
  const agent = "0xCc19a6CD4c18Ea52a0E49DAb62c5C0F22800fa2B" as const;
  const {data: state, loading, error, refetch} = useVaultState(agent);
  const {address, isConnected} = useAccount();
  const isOwner = isConnected && !!state && isSameAddress(address, state.vaultOwner);

  return (
    <div className="p-8 max-w-[1200px] mx-auto">
      <div className="mb-6">
        <h1 className="text-[20px] font-semibold text-text-primary tracking-tight">Policies</h1>
        <p className="text-[13px] text-text-muted mt-1">Spending policy configuration and enforcement rules</p>
      </div>

      <div className="space-y-6">
        {/* Policy Overview */}
        <div className="kpi-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-[13px] font-semibold text-text-primary">Spending Policy</div>
              <div className="text-[12px] text-text-muted mt-0.5">On-chain enforcement rules for agent spending</div>
            </div>
            {state && <PolicyStatus active={state.policy.active} expiry={state.policy.expiry} />}
          </div>

          {loading && !state ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 rounded-lg bg-surface-hover animate-pulse" />
              ))}
            </div>
          ) : error && !state ? (
            <div className="text-[12px] text-state-blocked">Failed to load policy. Please try again.</div>
          ) : state ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-surface-muted">
                  <div className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-1">Per-Tx Limit</div>
                  <div className="text-[18px] font-semibold text-text-primary tabular-nums">{formatUsdc(state.policy.maxPerTx)} <span className="text-[12px] text-text-muted font-normal">mUSD</span></div>
                </div>
                <div className="p-4 rounded-lg bg-surface-muted">
                  <div className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-1">Daily Limit</div>
                  <div className="text-[18px] font-semibold text-text-primary tabular-nums">{formatUsdc(state.policy.dailyCap)} <span className="text-[12px] text-text-muted font-normal">mUSD</span></div>
                </div>
                <div className="p-4 rounded-lg bg-surface-muted">
                  <div className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-1">Spent Today</div>
                  <div className="text-[18px] font-semibold text-text-primary tabular-nums">{formatUsdc(state.policy.spentToday)} <span className="text-[12px] text-text-muted font-normal">mUSD</span></div>
                </div>
                <div className="p-4 rounded-lg bg-surface-muted">
                  <div className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-1">Remaining</div>
                  <div className="text-[18px] font-semibold text-state-approved tabular-nums">{formatUsdc(state.remainingDailyCap)} <span className="text-[12px] text-text-muted font-normal">mUSD</span></div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border border-border">
                  <div className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-2">Allowlisted Recipients</div>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/10 text-[12px] text-accent font-medium">
                      {truncateAddress("0x7138931Fc8b4924090b08Ed00D74Ce750c52f937" as const)}
                    </span>
                  </div>
                </div>
                <div className="p-4 rounded-lg border border-border">
                  <div className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-2">Allowlisted Tokens</div>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/10 text-[12px] text-accent font-medium">
                      mUSD
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg border border-border">
                <div className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-2">Assigned Agent</div>
                <div className="text-[13px] font-mono text-text-primary">{truncateAddress(agent)}</div>
              </div>

              {isOwner && <PolicyForm agent={agent} state={state} refetch={refetch} />}
            </div>
          ) : null}
        </div>

        {/* Emergency Revoke */}
        {state && <EmergencyRevoke agent={agent} isOwner={isOwner} refetch={refetch} />}
      </div>
    </div>
  );
}

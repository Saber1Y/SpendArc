"use client";

import {useEffect, useState} from "react";
import {isAddress, type Address} from "viem";
import {CONTRACTS, vaultAbi} from "@/lib/contracts";
import {useVaultState, useApiAgents, useApiAllowlist} from "@/lib/hooks";
import {useActiveAddress, usePrivyWalletClient} from "@/lib/usePrivyWallet";
import {useRole, useMyAgent} from "@/lib/useRole";
import {isSameAddress, formatUsdc, formatExpiry, truncateAddress} from "@/lib/format";
import {useOwnerWrite} from "@/lib/useOwnerWrite";
import {waitForReceiptRaw} from "@/lib/txwait";
import {Field, TextInput, Toggle} from "@/components/ui/Input";
import {PageLoader} from "@/components/ui/PageLoader";
import {AgentOnboarding} from "@/components/dashboard/AgentOnboarding";
import {MAX_PER_TX_USDC, MAX_DAILY_CAP_USDC} from "@/lib/policyLimits";

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

function OnChainPolicyForm({agent, vault, state, refetch}: {agent: Address; vault: Address; state: NonNullable<ReturnType<typeof useVaultState>["data"]>; refetch: () => void}) {
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
        Edit On-Chain Policy
      </button>
    );
  }

  const submit = () => {
    const mpt = BigInt(Math.round(parseFloat(maxPerTx || "0") * 1_000_000));
    const dc = BigInt(Math.round(parseFloat(dailyCap || "0") * 1_000_000));
    if (mpt <= 0 || dc <= 0) return;
    const d = Number(days);
    const expiry = !d || d <= 0 ? 0n : BigInt(Math.floor(Date.now() / 1000) + d * 86400);
    write.run({
      address: vault,
      abi: vaultAbi,
      functionName: "setAgentPolicy",
      args: [agent, mpt, dc, expiry, active],
    });
  };

  return (
    <div className="space-y-4 p-4 rounded-lg border border-accent/20 bg-accent-light/30">
      <div className="text-[12px] font-medium text-text-primary mb-2">On-Chain Policy</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Per-tx cap (USDC)">
          <TextInput inputMode="decimal" value={maxPerTx} onChange={(e) => setMaxPerTx(e.target.value)} />
        </Field>
        <Field label="Daily cap (USDC)">
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
          {write.pending ? "Saving..." : "Save On-Chain Policy"}
        </button>
        <button onClick={() => setEditing(false)} disabled={write.pending} className="rounded-lg border border-border px-4 py-2 text-[12px] font-medium text-text-secondary hover:bg-surface-hover disabled:opacity-50">
          Cancel
        </button>
      </div>
      {write.pending && <div className="text-[12px] text-text-muted">Confirming on-chain...</div>}
    </div>
  );
}

function EmergencyRevoke({agent, vault, isOwner, refetch}: {agent: Address; vault: Address; isOwner: boolean; refetch: () => void}) {
  const [confirming, setConfirming] = useState(false);
  const write = useOwnerWrite(() => { refetch(); setConfirming(false); });

  return (
    <div className="kpi-card p-5 border border-state-blocked/20" data-aos="fade-up" data-aos-delay="150">
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
              onClick={() => write.run({address: vault, abi: vaultAbi, functionName: "revokeAgent", args: [agent]})}
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

function OwnerPolicies() {
  const {agents} = useApiAgents();
  const {address, isConnected} = useActiveAddress();
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const selected = agents.find((a) => a.id === selectedAgentId) ?? agents[0];
  const agentAddress = (selected?.address ?? "0x3F5b96A494061F7338Da529e3047809Ac6a7FB84") as Address;
  const agentId = selected?.id ?? "";
  const vault = (selected?.vault_address as Address | null) ?? CONTRACTS.vault;
  const {data: state, loading, error, refetch} = useVaultState(agentAddress, vault);
  const isOwner = isConnected && !!state && isSameAddress(address, state.vaultOwner);

  return (
    <div className="p-8 max-w-[1200px] mx-auto">
      <div className="mb-6" data-aos="fade-up">
        <h1 className="text-[20px] font-semibold text-text-primary tracking-tight">Policies</h1>
        <p className="text-[13px] text-text-muted mt-1">Spending policy configuration and enforcement rules</p>
      </div>

      <div className="space-y-6">
        <div className="kpi-card p-4 flex flex-wrap items-center gap-3" data-aos="fade-up">
          <span className="text-[12px] text-text-muted">Manage policy for:</span>
          <select
            value={selectedAgentId}
            onChange={(e) => setSelectedAgentId(e.target.value)}
            className="rounded-lg border border-border bg-white px-3 py-1.5 text-[13px] text-text-primary outline-none focus:border-accent"
          >
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name} ({a.id.slice(0, 12)}...)</option>
            ))}
          </select>
          {selected && (
            <span className="text-[11px] text-text-muted font-mono">
              agent {truncateAddress(selected.address as `0x${string}`)} on vault {truncateAddress(vault)}
            </span>
          )}
        </div>

        <div className="kpi-card p-6" data-aos="fade-up">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-[13px] font-semibold text-text-primary">On-Chain Spending Policy</div>
              <div className="text-[12px] text-text-muted mt-0.5">Enforced by SpendArcVault on Arc</div>
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
            <div className="text-[12px] text-state-blocked">
              Failed to load policy
              <button onClick={refetch} className="ml-3 underline hover:no-underline">Retry</button>
              <div className="text-[11px] text-state-blocked/70 mt-1 break-all">{error.message}</div>
            </div>
          ) : state ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-surface-muted">
                  <div className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-1">Per-Tx Limit</div>
                  <div className="text-[18px] font-semibold text-text-primary tabular-nums">{formatUsdc(state.policy.maxPerTx)} <span className="text-[12px] text-text-muted font-normal">USDC</span></div>
                </div>
                <div className="p-4 rounded-lg bg-surface-muted">
                  <div className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-1">Daily Limit</div>
                  <div className="text-[18px] font-semibold text-text-primary tabular-nums">{formatUsdc(state.policy.dailyCap)} <span className="text-[12px] text-text-muted font-normal">USDC</span></div>
                </div>
                <div className="p-4 rounded-lg bg-surface-muted">
                  <div className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-1">Spent Today</div>
                  <div className="text-[18px] font-semibold text-text-primary tabular-nums">{formatUsdc(state.policy.spentToday)} <span className="text-[12px] text-text-muted font-normal">USDC</span></div>
                </div>
                <div className="p-4 rounded-lg bg-surface-muted">
                  <div className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-1">Remaining</div>
                  <div className="text-[18px] font-semibold text-state-approved tabular-nums">{formatUsdc(state.remainingDailyCap)} <span className="text-[12px] text-text-muted font-normal">USDC</span></div>
                </div>
              </div>

              <div className="p-4 rounded-lg border border-border">
                <div className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-2">Assigned Agent</div>
                <div className="text-[13px] font-mono text-text-primary">{truncateAddress(agentAddress)}</div>
              </div>

              {isOwner && <OnChainPolicyForm agent={agentAddress} vault={vault} state={state} refetch={refetch} />}
            </div>
          ) : null}
        </div>

        <div className="kpi-card p-6" data-aos="fade-up" data-aos-delay="100">
          <div className="text-[13px] font-semibold text-text-primary mb-4">Server-Side Policy</div>
          <div className="text-[12px] text-text-muted mb-4">
            Configured via the API and evaluated before on-chain enforcement.
          </div>
          {agentId ? (
            <ApiPolicySection agentId={agentId} />
          ) : (
            <div className="text-[12px] text-text-muted">Create an agent first to configure server-side policies.</div>
          )}
        </div>

        {state && <EmergencyRevoke agent={agentAddress} vault={vault} isOwner={isOwner} refetch={refetch} />}
      </div>
    </div>
  );
}

function ApiPolicySection({agentId}: {agentId: string}) {
  const [editing, setEditing] = useState(false);
  const [maxPerTx, setMaxPerTx] = useState("5");
  const [dailyCap, setDailyCap] = useState("20");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [policy, setPolicy] = useState<{max_per_tx: number; daily_cap: number; active: number} | null>(null);

  const loadPolicy = async () => {
    try {
      const res = await fetch(`/api/policies/${agentId}`);
      if (res.ok) {
        const data = await res.json();
        setPolicy(data.policy);
        setMaxPerTx((data.policy.max_per_tx / 1_000_000).toString());
        setDailyCap((data.policy.daily_cap / 1_000_000).toString());
        setActive(!!data.policy.active);
      }
    } catch {}
  };

  useEffect(() => { loadPolicy(); }, []);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/policies/${agentId}`, {
        method: "PUT",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({maxPerTx, dailyCap, active}),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Save failed");
      } else {
        const data = await res.json();
        setPolicy(data.policy);
        setEditing(false);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div>
        {policy && (
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="p-3 rounded-lg bg-surface-muted">
              <div className="text-[11px] text-text-muted">Per-Tx Limit</div>
              <div className="text-[16px] font-semibold tabular-nums">{maxPerTx} USDC</div>
            </div>
            <div className="p-3 rounded-lg bg-surface-muted">
              <div className="text-[11px] text-text-muted">Daily Cap</div>
              <div className="text-[16px] font-semibold tabular-nums">{dailyCap} USDC</div>
            </div>
            <div className="p-3 rounded-lg bg-surface-muted">
              <div className="text-[11px] text-text-muted">Status</div>
              <div className="text-[16px] font-semibold tabular-nums">{active ? "Active" : "Inactive"}</div>
            </div>
          </div>
        )}
        <button
          onClick={() => setEditing(true)}
          className="rounded-lg border border-border px-4 py-2 text-[12px] font-medium text-text-secondary hover:bg-surface-hover"
        >
          Edit Server-Side Policy
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 rounded-lg border border-accent/20 bg-accent-light/30">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Per-tx cap (USDC)">
          <TextInput inputMode="decimal" value={maxPerTx} onChange={(e) => setMaxPerTx(e.target.value)} />
        </Field>
        <Field label="Daily cap (USDC)">
          <TextInput inputMode="decimal" value={dailyCap} onChange={(e) => setDailyCap(e.target.value)} />
        </Field>
        <Field label="Active">
          <Toggle checked={active} onChange={setActive} label={active ? "active" : "inactive"} />
        </Field>
      </div>
      {error && <div className="text-[12px] text-state-blocked">{error}</div>}
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="rounded-lg bg-accent px-4 py-2 text-[12px] font-medium text-white hover:bg-accent-hover disabled:opacity-50">
          {saving ? "Saving..." : "Save"}
        </button>
        <button onClick={() => setEditing(false)} disabled={saving} className="rounded-lg border border-border px-4 py-2 text-[12px] font-medium text-text-secondary hover:bg-surface-hover disabled:opacity-50">
          Cancel
        </button>
      </div>
    </div>
  );
}

function UserPolicyEditor({agentId, state, refetch}: {
  agentId: string;
  state: NonNullable<ReturnType<typeof useVaultState>["data"]>;
  refetch: () => void;
}) {
  const [maxPerTx, setMaxPerTx] = useState(formatUsdc(state.policy.maxPerTx));
  const [dailyCap, setDailyCap] = useState(formatUsdc(state.policy.dailyCap));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const {getClient} = usePrivyWalletClient();
  const {isConnected, address} = useActiveAddress();

  const applyPreset = (mpt: string, dc: string) => {
    setMaxPerTx(mpt);
    setDailyCap(dc);
    setError("");
    setSuccess("");
  };

  const save = async () => {
    const mpt = parseFloat(maxPerTx);
    const dc = parseFloat(dailyCap);
    if (!isFinite(mpt) || !isFinite(dc) || mpt <= 0 || dc <= 0) {
      setError("Enter positive numbers for both limits.");
      return;
    }
    if (mpt > MAX_PER_TX_USDC || dc > MAX_DAILY_CAP_USDC) {
      setError(`Limits are capped at ${MAX_PER_TX_USDC} USDC/tx and ${MAX_DAILY_CAP_USDC} USDC/day.`);
      return;
    }
    if (mpt > dc) {
      setError("Per-tx cap cannot exceed the daily cap.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/policies/${agentId}/update`, {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({maxPerTxUsdc: mpt, dailyCapUsdc: dc}),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? data.error ?? "Failed to update leash");
        return;
      }

      if (data.tx) {
        // Per-user vault: the visitor is the vault owner, so they sign the leash change.
        if (!isConnected || !address) {
          setError("Connect your wallet to sign the leash change - you own this vault.");
          return;
        }
        if (data.tx.to.toLowerCase() === "0x0000000000000000000000000000000000000000") {
          setError("Vault not configured yet.");
          return;
        }
        const client = await getClient();
        if (!client) {
          setError("No wallet connected - connect to sign the leash change.");
          return;
        }
        const hash = await client.sendTransaction({
          to: data.tx.to as Address,
          data: data.tx.data as `0x${string}`,
          chain: client.chain,
          account: client.account!,
        });
        const status = await waitForReceiptRaw(hash);
        if (status === "reverted") {
          setError("The leash update reverted on-chain.");
          return;
        }
        const sync = await fetch(`/api/policies/${agentId}/sync`, {
          method: "POST",
          headers: {"content-type": "application/json"},
          body: JSON.stringify({maxPerTxUsdc: mpt, dailyCapUsdc: dc}),
        });
        const syncData = await sync.json();
        if (!sync.ok) {
          setError(syncData.message ?? syncData.error ?? "On-chain update confirmed, but the server mirror could not sync.");
          refetch();
          return;
        }
        setSuccess(`Leash updated on-chain with your signature. Your AI agent's requests are now bound by the new limits.`);
        refetch();
        return;
      }

      // Shared vault (operator plane): server owner key signed the update already.
      setSuccess(`Leash updated on-chain${data.txHash ? " - tx confirmed" : ""}. Your AI agent's requests are now bound by the new limits.`);
      refetch();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg.includes("rejected") || msg.includes("denied") ? "Signature rejected in your wallet." : msg.slice(0, 300));
    } finally {
      setSaving(false);
    }
  };

  const presets = [
    {label: "Standard", mpt: "5", dc: "10"},
    {label: "Generous", mpt: "10", dc: "25"},
  ];

  return (
    <div className="space-y-4 p-4 rounded-lg border border-accent/20 bg-accent-light/30">
      <div className="text-[12px] font-medium text-text-primary mb-1">Adjust your leash</div>
      <div className="text-[11px] text-text-muted">
        Enforced on-chain by the SpendArc vault. Ceilings: {MAX_PER_TX_USDC} USDC/tx, {MAX_DAILY_CAP_USDC} USDC/day.
      </div>

      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <button
            key={p.label}
            onClick={() => applyPreset(p.mpt, p.dc)}
            className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors ${
              maxPerTx === p.mpt && dailyCap === p.dc
                ? "border-accent bg-accent/10 text-accent"
                : "border-border text-text-secondary hover:border-accent hover:text-text-primary"
            }`}
          >
            {p.label}: {p.mpt}/{p.dc} USDC
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Per-tx cap (USDC)">
          <TextInput inputMode="decimal" value={maxPerTx} onChange={(e) => setMaxPerTx(e.target.value)} />
        </Field>
        <Field label="Daily cap (USDC)">
          <TextInput inputMode="decimal" value={dailyCap} onChange={(e) => setDailyCap(e.target.value)} />
        </Field>
      </div>

      {error && <div className="text-[12px] text-state-blocked">{error}</div>}
      {success && <div className="text-[12px] text-state-approved">{success}</div>}

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="rounded-lg bg-accent px-4 py-2 text-[12px] font-medium text-white hover:bg-accent-hover disabled:opacity-50">
          {saving ? "Updating on-chain..." : "Save leash"}
        </button>
      </div>
      {saving && <div className="text-[12px] text-text-muted">You sign the leash update in your wallet - it is your vault...</div>}
    </div>
  );
}

function ServiceAllowlist({agentId}: {agentId: string}) {
  const {recipients, refetch} = useApiAllowlist(agentId);
  const [target, setTarget] = useState("");
  const [label, setLabel] = useState("");
  const [maxPerTxUsdc, setMaxPerTxUsdc] = useState("");
  const [dailyCapUsdc, setDailyCapUsdc] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const {getClient} = usePrivyWalletClient();
  const {isConnected, address} = useActiveAddress();

  const change = async (addr: string, allow: boolean, entryLabel: string, perTx?: number, daily?: number) => {
    if (!isAddress(addr)) {
      setError("Enter a valid address (0x...).");
      return;
    }
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/allowlist/${agentId}/update`, {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({address: addr, allowed: allow, label: entryLabel, maxPerTxUsdc: perTx, dailyCapUsdc: daily}),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? data.error ?? "Failed to update allowlist");
        return;
      }
      if (!data.tx || data.tx.to === "0x0000000000000000000000000000000000000000") {
        setError("Vault not configured yet.");
        return;
      }
      if (!isConnected || !address) {
        setError("Connect your wallet to sign the allowlist change - you own this vault.");
        return;
      }
      const client = await getClient();
      if (!client) {
        setError("No wallet connected - connect to sign the allowlist change.");
        return;
      }
      const hash = await client.sendTransaction({
        to: data.tx.to as Address,
        data: data.tx.data as `0x${string}`,
        chain: client.chain,
        account: client.account!,
      });
      const status = await waitForReceiptRaw(hash);
      if (status === "reverted") {
        setError("The allowlist update reverted on-chain.");
        return;
      }
      const sync = await fetch(`/api/allowlist/${agentId}/sync`, {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({address: addr, allowed: allow, label: entryLabel, maxPerTxUsdc: perTx, dailyCapUsdc: daily}),
      });
      const syncData = await sync.json();
      if (!sync.ok) {
        setError(syncData.message ?? syncData.error ?? "On-chain update confirmed, but the server mirror could not sync.");
        refetch();
        return;
      }
      setSuccess(
        allow
          ? perTx != null || daily != null
            ? "Service allowed with a per-service budget - the server fence caps what it can draw from the leash."
            : "Service allowed - your agent can now pay it within the leash."
          : "Service removed from the allowlist.",
      );
      setTarget("");
      setLabel("");
      setMaxPerTxUsdc("");
      setDailyCapUsdc("");
      refetch();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg.includes("rejected") || msg.includes("denied") ? "Signature rejected in your wallet." : msg.slice(0, 300));
    } finally {
      setBusy(false);
    }
  };

  const parseUsdc = (v: string): number | undefined => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };

  const self = recipients.find((r) => r.label === "self (owner)");
  const services = recipients.filter((r) => r.label !== "self (owner)");

  return (
    <div className="p-4 rounded-lg border border-border">
      <div className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-1">Service payments</div>
      <div className="text-[12px] text-text-muted mb-3">
        Allow an address (a SaaS, an API, a merchant) your agent may pay from your vault. You sign the change in your wallet - it is your
        vault. Payments to your own wallet are always allowed. Set an optional per-service budget to cap what that service can draw - the
        on-chain leash still backstops everything.
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={target}
          onChange={(e) => {
            setTarget(e.target.value);
            setError("");
            setSuccess("");
          }}
          placeholder="0x... service address"
          className="w-64 rounded-lg border border-border bg-white px-3 py-2 text-[12px] font-mono text-text-primary outline-none focus:border-accent"
        />
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (e.g. Analytics API)"
          className="w-44 rounded-lg border border-border bg-white px-3 py-2 text-[12px] text-text-primary outline-none focus:border-accent"
        />
        <input
          value={maxPerTxUsdc}
          onChange={(e) => setMaxPerTxUsdc(e.target.value)}
          placeholder="Budget / tx (USDC)"
          inputMode="decimal"
          className="w-36 rounded-lg border border-border bg-white px-3 py-2 text-[12px] text-text-primary outline-none focus:border-accent"
        />
        <input
          value={dailyCapUsdc}
          onChange={(e) => setDailyCapUsdc(e.target.value)}
          placeholder="Daily cap (USDC)"
          inputMode="decimal"
          className="w-36 rounded-lg border border-border bg-white px-3 py-2 text-[12px] text-text-primary outline-none focus:border-accent"
        />
        <button
          onClick={() =>
            change(target, true, label.trim() || "service", parseUsdc(maxPerTxUsdc), parseUsdc(dailyCapUsdc))
          }
          disabled={busy}
          className="rounded-lg bg-accent px-4 py-2 text-[12px] font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {busy ? "Signing..." : "Allow service"}
        </button>
      </div>

      {error && <div className="text-[12px] text-state-blocked mt-3">{error}</div>}
      {success && <div className="text-[12px] text-state-approved mt-3">{success}</div>}

      <div className="mt-4 space-y-1">
        {self && (
          <div className="flex items-center gap-2 text-[12px] text-text-muted">
            <span className="font-mono text-text-primary">{truncateAddress(self.address as `0x${string}`)}</span>
            <span>{self.label}</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-state-approved-light text-[11px] font-medium text-state-approved">
              always allowed
            </span>
          </div>
        )}
        {services.length === 0 ? (
          <div className="text-[12px] text-text-muted">No services allowed yet - the agent can only pay your own wallet.</div>
        ) : (
          services.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 text-[12px]">
              <span className="font-mono text-text-primary">{truncateAddress(r.address as `0x${string}`)}</span>
              <span className="text-text-muted">{r.label}</span>
              {(r.max_per_tx_usdc != null || r.daily_cap_usdc != null) && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-muted text-[11px] font-medium text-text-secondary">
                  {r.max_per_tx_usdc != null && <span>{formatUsdc(BigInt(r.max_per_tx_usdc))}/tx</span>}
                  {r.max_per_tx_usdc != null && r.daily_cap_usdc != null && <span>/</span>}
                  {r.daily_cap_usdc != null && <span>{formatUsdc(BigInt(r.daily_cap_usdc))}/day</span>}
                </span>
              )}
              <button
                onClick={() => change(r.address, false, r.label)}
                disabled={busy}
                className="rounded-md border border-state-blocked/30 px-2 py-1 text-[11px] font-medium text-state-blocked hover:bg-state-blocked/10 disabled:opacity-50"
              >
                Revoke
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function UserPolicyPage() {
  const {agent, loading} = useMyAgent();

  if (loading) {
    return <PageLoader label="Loading your policy..." fill />;
  }

  if (!agent) {
    return (
      <div className="p-8 max-w-[1200px] mx-auto">
        <AgentOnboarding />
      </div>
    );
  }

  return <UserPolicyWithAgent agentId={agent.id} agentAddress={agent.address as Address} vaultAddress={agent.vault_address} />;
}

function UserPolicyWithAgent({agentId, agentAddress, vaultAddress}: {agentId: string; agentAddress: Address; vaultAddress?: string | null}) {
  const {data: state, loading, error, refetch} = useVaultState(agentAddress, (vaultAddress as Address | undefined) ?? CONTRACTS.vault);

  return (
    <div className="p-8 max-w-[900px] mx-auto">
      <div className="mb-6" data-aos="fade-up">
        <h1 className="text-[20px] font-semibold text-text-primary tracking-tight">Policy</h1>
        <p className="text-[13px] text-text-muted mt-1">Your agent&apos;s spending leash, enforced on-chain by the SpendArc vault</p>
      </div>

      <div className="kpi-card p-6" data-aos="fade-up">
        <div className="text-[11px] font-medium uppercase tracking-wider text-text-secondary mb-4">On-Chain Spending Policy</div>
        {loading && !state ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 rounded-lg bg-surface-hover animate-pulse" />
            ))}
          </div>
        ) : error && !state ? (
          <div className="text-[12px] text-state-blocked">
            Failed to load policy
            <button onClick={refetch} className="ml-3 underline hover:no-underline">Retry</button>
            <div className="text-[11px] text-state-blocked/70 mt-1 break-all">{error.message}</div>
          </div>
        ) : state ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="p-4 rounded-lg bg-surface-muted">
                <div className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-1">Per-Tx Limit</div>
                <div className="text-[18px] font-semibold text-text-primary tabular-nums">{formatUsdc(state.policy.maxPerTx)} <span className="text-[12px] text-text-muted font-normal">USDC</span></div>
              </div>
              <div className="p-4 rounded-lg bg-surface-muted">
                <div className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-1">Daily Limit</div>
                <div className="text-[18px] font-semibold text-text-primary tabular-nums">{formatUsdc(state.policy.dailyCap)} <span className="text-[12px] text-text-muted font-normal">USDC</span></div>
              </div>
              <div className="p-4 rounded-lg bg-surface-muted">
                <div className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-1">Spent Today</div>
                <div className="text-[18px] font-semibold text-text-primary tabular-nums">{formatUsdc(state.policy.spentToday)} <span className="text-[12px] text-text-muted font-normal">USDC</span></div>
              </div>
              <div className="p-4 rounded-lg bg-surface-muted">
                <div className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-1">Remaining</div>
                <div className="text-[18px] font-semibold text-state-approved tabular-nums">{formatUsdc(state.remainingDailyCap)} <span className="text-[12px] text-text-muted font-normal">USDC</span></div>
              </div>
            </div>

            <div className="space-y-4">
              <UserPolicyEditor agentId={agentId} state={state} refetch={refetch} />
              <ServiceAllowlist agentId={agentId} />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function PoliciesPage() {
  const {isOwner, loading} = useRole();

  if (loading) {
    return <PageLoader label="Resolving your role..." fill />;
  }

  return isOwner ? <OwnerPolicies /> : <UserPolicyPage />;
}

"use client";

import {useState} from "react";
import {isAddress, type Address} from "viem";
import {useAccount} from "wagmi";
import {DEMO, CONTRACTS, vaultAbi} from "@/lib/contracts";
import {useVaultState} from "@/lib/hooks";
import {isSameAddress, truncateAddress} from "@/lib/format";
import {useOwnerWrite} from "@/lib/useOwnerWrite";
import {Field, TextInput} from "@/components/ui/Input";

function RecipientSection({state, isOwner, agent, refetch}: {
  state: NonNullable<ReturnType<typeof useVaultState>["data"]> | undefined;
  isOwner: boolean;
  agent: Address;
  refetch: () => void;
}) {
  const [target, setTarget] = useState<string>(DEMO.vendor);
  const write = useOwnerWrite(refetch);

  const allowTarget = (allowed: boolean) => {
    if (!isAddress(target)) return;
    write.run({address: CONTRACTS.vault, abi: vaultAbi, functionName: "setAllowedTarget", args: [agent, target as Address, allowed]});
  };

  const recipients = state?.targetAllowed ? [{address: DEMO.vendor, label: "Demo Vendor", active: true}] : [];

  return (
    <div className="kpi-card p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-[13px] font-semibold text-text-primary">Allowed Recipients</div>
          <div className="text-[12px] text-text-muted mt-0.5">Addresses the agent is permitted to send payments to</div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-[11px] font-medium text-text-muted uppercase tracking-wider">Address</th>
              <th className="text-left py-3 px-4 text-[11px] font-medium text-text-muted uppercase tracking-wider">Label</th>
              <th className="text-left py-3 px-4 text-[11px] font-medium text-text-muted uppercase tracking-wider">Status</th>
              {isOwner && <th className="text-right py-3 px-4 text-[11px] font-medium text-text-muted uppercase tracking-wider">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {recipients.length === 0 ? (
              <tr>
                <td colSpan={isOwner ? 4 : 3} className="py-8 text-center text-[12px] text-text-muted">
                  No recipients allowlisted. Add a recipient below.
                </td>
              </tr>
            ) : (
              recipients.map((r) => (
                <tr key={r.address} className="hover:bg-surface-hover/50 transition-colors">
                  <td className="py-3 px-4 font-mono text-text-primary">{truncateAddress(r.address)}</td>
                  <td className="py-3 px-4 text-text-muted">{r.label}</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-state-approved-light text-[11px] font-medium text-state-approved">
                      <span className="h-1 w-1 rounded-full bg-state-approved" /> Active
                    </span>
                  </td>
                  {isOwner && (
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => allowTarget(false)}
                        disabled={write.pending}
                        className="text-[12px] text-state-blocked hover:underline disabled:opacity-50"
                      >
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

      {isOwner && (
        <div className="mt-5 pt-5 border-t border-border">
          <div className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-3">Add Recipient</div>
          <div className="flex gap-2">
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="0x..."
              className="flex-1 rounded-lg border border-border bg-white px-3 py-2 text-[13px] text-text-primary font-mono outline-none focus:border-accent"
              spellCheck={false}
            />
            <button
              onClick={() => allowTarget(true)}
              disabled={!isAddress(target) || write.pending}
              className="rounded-lg bg-accent px-4 py-2 text-[12px] font-medium text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
            >
              Add
            </button>
          </div>
          {write.error && <div className="text-[12px] text-state-blocked mt-2">{write.error}</div>}
        </div>
      )}
    </div>
  );
}

function TokenSection({state, isOwner, agent, refetch}: {
  state: NonNullable<ReturnType<typeof useVaultState>["data"]> | undefined;
  isOwner: boolean;
  agent: Address;
  refetch: () => void;
}) {
  const [token, setToken] = useState<string>(CONTRACTS.mockUSD);
  const write = useOwnerWrite(refetch);

  const allowToken = (allowed: boolean) => {
    if (!isAddress(token)) return;
    write.run({address: CONTRACTS.vault, abi: vaultAbi, functionName: "setAllowedToken", args: [agent, token as Address, allowed]});
  };

  const tokens = state?.tokenAllowed ? [{address: CONTRACTS.mockUSD, symbol: "mUSD", active: true}] : [];

  return (
    <div className="kpi-card p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-[13px] font-semibold text-text-primary">Allowed Tokens</div>
          <div className="text-[12px] text-text-muted mt-0.5">ERC-20 tokens the agent is permitted to spend</div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-[11px] font-medium text-text-muted uppercase tracking-wider">Symbol</th>
              <th className="text-left py-3 px-4 text-[11px] font-medium text-text-muted uppercase tracking-wider">Contract Address</th>
              <th className="text-left py-3 px-4 text-[11px] font-medium text-text-muted uppercase tracking-wider">Status</th>
              {isOwner && <th className="text-right py-3 px-4 text-[11px] font-medium text-text-muted uppercase tracking-wider">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tokens.length === 0 ? (
              <tr>
                <td colSpan={isOwner ? 4 : 3} className="py-8 text-center text-[12px] text-text-muted">
                  No tokens allowlisted. Add a token below.
                </td>
              </tr>
            ) : (
              tokens.map((t) => (
                <tr key={t.address} className="hover:bg-surface-hover/50 transition-colors">
                  <td className="py-3 px-4 font-medium text-text-primary">{t.symbol}</td>
                  <td className="py-3 px-4 font-mono text-text-muted">{truncateAddress(t.address)}</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-state-approved-light text-[11px] font-medium text-state-approved">
                      <span className="h-1 w-1 rounded-full bg-state-approved" /> Active
                    </span>
                  </td>
                  {isOwner && (
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => allowToken(false)}
                        disabled={write.pending}
                        className="text-[12px] text-state-blocked hover:underline disabled:opacity-50"
                      >
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

      {isOwner && (
        <div className="mt-5 pt-5 border-t border-border">
          <div className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-3">Add Token</div>
          <div className="flex gap-2">
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="0x..."
              className="flex-1 rounded-lg border border-border bg-white px-3 py-2 text-[13px] text-text-primary font-mono outline-none focus:border-accent"
              spellCheck={false}
            />
            <button
              onClick={() => allowToken(true)}
              disabled={!isAddress(token) || write.pending}
              className="rounded-lg bg-accent px-4 py-2 text-[12px] font-medium text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
            >
              Add
            </button>
          </div>
          {write.error && <div className="text-[12px] text-state-blocked mt-2">{write.error}</div>}
        </div>
      )}
    </div>
  );
}

export default function AllowlistPage() {
  const agent = DEMO.agent;
  const {data: state, loading, error, refetch} = useVaultState(agent);
  const {address, isConnected} = useAccount();
  const isOwner = isConnected && !!state && isSameAddress(address, state.vaultOwner);

  return (
    <div className="p-8 max-w-[1200px] mx-auto">
      <div className="mb-6">
        <h1 className="text-[20px] font-semibold text-text-primary tracking-tight">Allowlist</h1>
        <p className="text-[13px] text-text-muted mt-1">Access control management for agent spending</p>
      </div>

      {!isOwner && isConnected && (
        <div className="mb-6 rounded-lg border border-state-pending/30 bg-state-pending-light p-4 text-[12px] text-text-muted">
          Connect the vault owner wallet to manage allowlists.
        </div>
      )}

      <div className="space-y-6">
        <RecipientSection state={state} isOwner={isOwner} agent={agent} refetch={refetch} />
        <TokenSection state={state} isOwner={isOwner} agent={agent} refetch={refetch} />
      </div>
    </div>
  );
}

"use client";

import {useState} from "react";
import {useVaultState, useApiTransactions, useApiAgents, useApiAllowlist, txToAction} from "@/lib/hooks";
import {isSameAddress, formatUsdc, truncateAddress, truncateHash} from "@/lib/format";
import {explorerTx} from "@/lib/chain";
import {CONTRACTS, vaultAbi, usdcAbi} from "@/lib/contracts";
import {arcChain} from "@/lib/arc";
import {useActiveAddress, usePrivyWalletClient} from "@/lib/usePrivyWallet";
import {waitForReceiptRaw} from "@/lib/txwait";
import {TxChip} from "@/components/ui/Chip";
import {StateBadge} from "@/components/ui/StateBadge";
import {DailyCapMeter} from "@/components/dashboard/DailyCapMeter";
import {parseUnits} from "viem";

function KPICard({label, value, sub, accent, delay = 0}: {label: string; value: string | number; sub?: string; accent?: boolean; delay?: number}) {
  return (
    <div className="kpi-card p-5" data-aos="fade-up" data-aos-delay={delay}>
      <div className="text-[11px] font-medium uppercase tracking-wider text-text-secondary mb-2">{label}</div>
      <div className={`text-2xl font-semibold tracking-tight ${accent ? "text-accent" : "text-text-primary"}`}>
        {value}
      </div>
      {sub && <div className="text-[12px] text-text-muted mt-1">{sub}</div>}
    </div>
  );
}

function EmptyState({title, description}: {title: string; description: string}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="text-[13px] font-medium text-text-secondary mb-1">{title}</div>
      <div className="text-[12px] text-text-muted max-w-[280px]">{description}</div>
    </div>
  );
}

function PolicyHealthCard({state, recipientCount, tokenCount}: {
  state: ReturnType<typeof useVaultState>["data"];
  recipientCount: number;
  tokenCount: number;
}) {
  if (!state) return null;
  const {policy, remainingDailyCap} = state;
  const expiryDate = policy.expiry === 0n ? null : new Date(Number(policy.expiry) * 1000);
  const isExpired = expiryDate ? expiryDate < new Date() : false;

  return (
    <div className="kpi-card p-5">
      <div className="text-[11px] font-medium uppercase tracking-wider text-text-secondary mb-4">Policy Health</div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-text-muted">Per-transaction limit</span>
          <span className="text-[13px] font-medium text-text-primary tabular-nums">{formatUsdc(policy.maxPerTx)} USDC</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-text-muted">Daily spending limit</span>
          <span className="text-[13px] font-medium text-text-primary tabular-nums">{formatUsdc(policy.dailyCap)} USDC</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-text-muted">Remaining daily allowance</span>
          <span className="text-[13px] font-medium text-text-primary tabular-nums">{formatUsdc(remainingDailyCap)} USDC</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-text-muted">Policy expiry</span>
          <span className={`text-[13px] font-medium ${isExpired ? "text-state-blocked" : "text-text-primary"}`}>
            {expiryDate ? expiryDate.toLocaleDateString("en-US", {month: "short", day: "numeric", year: "numeric"}) : "Never"}
          </span>
        </div>
        <div className="border-t border-border my-2" />
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-text-muted">Allowlisted recipients</span>
          <span className="text-[13px] font-medium text-text-primary">{recipientCount}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-text-muted">Allowlisted tokens</span>
          <span className="text-[13px] font-medium text-text-primary">{tokenCount}</span>
        </div>
      </div>
      <div className="mt-4">
        <DailyCapMeter spent={policy.spentToday} cap={policy.dailyCap} remaining={remainingDailyCap} />
      </div>
    </div>
  );
}

function AgentHealthCard({state, loading, agent}: {state: ReturnType<typeof useVaultState>["data"]; loading: boolean; agent: string}) {
  return (
    <div className="kpi-card p-5">
      <div className="text-[11px] font-medium uppercase tracking-wider text-text-secondary mb-4">Agent Health</div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-text-muted">Agent wallet</span>
          <span className="text-[12px] font-medium text-text-primary font-mono">{truncateAddress(agent as `0x${string}`)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-text-muted">Authorization</span>
          {loading ? (
            <span className="text-[12px] text-text-muted">Loading...</span>
          ) : !state ? (
            <span className="inline-flex items-center gap-1 text-[12px] font-medium text-state-pending">
              <span className="h-1.5 w-1.5 rounded-full bg-state-pending" /> Unavailable
            </span>
          ) : state.policy.active ? (
            <span className="inline-flex items-center gap-1 text-[12px] font-medium text-state-approved">
              <span className="h-1.5 w-1.5 rounded-full bg-state-approved" /> Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[12px] font-medium text-state-blocked">
              <span className="h-1.5 w-1.5 rounded-full bg-state-blocked" /> Revoked
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-text-muted">Vault balance</span>
          <span className="text-[13px] font-medium text-text-primary tabular-nums">
            {state ? <>{formatUsdc(state.vaultBalance)} <span className="text-text-muted">USDC</span></> : "-"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-text-muted">Current allowance</span>
          <span className="text-[13px] font-medium text-text-primary tabular-nums">
            {state ? <>{formatUsdc(state.remainingDailyCap)} <span className="text-text-muted">USDC</span></> : "-"}
          </span>
        </div>
      </div>
    </div>
  );
}

function RecentActivity({transactions, loading}: {transactions: ReturnType<typeof useApiTransactions>["transactions"]; loading: boolean}) {
  const recent = transactions.slice(0, 5);

  if (loading && recent.length === 0) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
            <div className="h-5 w-16 rounded-full bg-surface-hover" />
            <div className="h-4 flex-1 bg-surface-hover rounded" />
            <div className="h-4 w-20 bg-surface-hover rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (recent.length === 0) {
    return <EmptyState title="No activity yet" description="Spending decisions will appear here as agents make requests." />;
  }

  return (
    <div className="divide-y divide-border">
      {recent.map((tx) => {
        const action = txToAction(tx);
        return (
          <div key={tx.id} className="flex items-center gap-4 py-3">
            <StateBadge kind={action.kind} />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium text-text-primary">
                {formatUsdc(action.amount)} USDC
                <span className="text-text-muted ml-1.5">to {truncateAddress(action.target)}</span>
              </div>
              <div className="text-[12px] text-text-muted mt-0.5">
                {action.kind === "blocked" ? action.reason ?? "Policy violation" : "Approved"}
              </div>
            </div>
            {tx.tx_hash && (
              <TxChip href={explorerTx(tx.tx_hash as `0x${string}`)} label={truncateHash(tx.tx_hash as `0x${string}`)} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function VaultFundCard({state, refetch}: {state: ReturnType<typeof useVaultState>["data"]; refetch: () => void}) {
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);
  const {address, isConnected} = useActiveAddress();
  const {getClient} = usePrivyWalletClient();

  const isOwner = isConnected && !!state && isSameAddress(address, state.vaultOwner);

  if (!state || !isConnected) return null;

  const doDeposit = async () => {
    if (!depositAmount || !address) return;
    setSending(true);
    setStatus("");
    try {
      const client = await getClient();
      if (!client) throw new Error("No wallet connected");
      const amount = parseUnits(depositAmount, 6);
      // Approve USDC transfer
      const approveHash = await client.writeContract({
        abi: usdcAbi,
        address: CONTRACTS.usdc,
        functionName: "approve",
        args: [CONTRACTS.vault, amount],
        chain: arcChain,
        account: address,
      });
      setStatus("Approving USDC...");
      await waitForReceiptRaw(approveHash);

      // Transfer USDC to vault
      const txHash = await client.writeContract({
        abi: usdcAbi,
        address: CONTRACTS.usdc,
        functionName: "transfer",
        args: [CONTRACTS.vault, amount],
        chain: arcChain,
        account: address,
      });
      setStatus(`Depositing... ${truncateHash(txHash)}`);
      await waitForReceiptRaw(txHash);

      setStatus("Deposit confirmed");
      setDepositAmount("");
      setTimeout(refetch, 1000);
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const doWithdraw = async () => {
    if (!withdrawAmount || !recipient || !address) return;
    setSending(true);
    setStatus("");
    try {
      const client = await getClient();
      if (!client) throw new Error("No wallet connected");
      const amount = parseUnits(withdrawAmount, 6);
      const txHash = await client.writeContract({
        abi: vaultAbi,
        address: CONTRACTS.vault,
        functionName: "withdrawTokens",
        args: [CONTRACTS.usdc, recipient as `0x${string}`, amount],
        chain: arcChain,
        account: address,
      });
      setStatus(`Withdrawing... ${truncateHash(txHash)}`);
      await waitForReceiptRaw(txHash);
      setStatus("Withdrawal confirmed");
      setWithdrawAmount("");
      setTimeout(refetch, 1000);
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="kpi-card p-5">
      <div className="text-[11px] font-medium uppercase tracking-wider text-text-secondary mb-3">Vault Funds</div>
      <div className="text-[13px] font-medium text-text-primary mb-4">
        Balance: {formatUsdc(state.vaultBalance)} USDC
      </div>

      <div className="space-y-3">
        <div>
          <div className="text-[12px] text-text-muted mb-1">Deposit USDC</div>
          <div className="flex gap-2">
            <input
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="0.00"
              type="number"
              min="0"
              step="0.01"
              className="flex-1 rounded-lg border border-border bg-white px-3 py-1.5 text-[13px] text-text-primary outline-none focus:border-accent"
            />
            <button
              onClick={doDeposit}
              disabled={!depositAmount || sending}
              className="rounded-lg bg-accent px-4 py-1.5 text-[13px] font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {sending ? "..." : "Deposit"}
            </button>
          </div>
        </div>

        {isOwner && (
          <div className="border-t border-border pt-3">
            <div className="text-[12px] text-text-muted mb-1">Withdraw USDC (owner only)</div>
            <div className="flex gap-2 mb-2">
              <input
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="0x recipient"
                className="flex-1 rounded-lg border border-border bg-white px-3 py-1.5 text-[13px] text-text-primary font-mono outline-none focus:border-accent"
                spellCheck={false}
              />
            </div>
            <div className="flex gap-2">
              <input
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="0.00"
                type="number"
                min="0"
                step="0.01"
                className="flex-1 rounded-lg border border-border bg-white px-3 py-1.5 text-[13px] text-text-primary outline-none focus:border-accent"
              />
              <button
                onClick={doWithdraw}
                disabled={!withdrawAmount || !recipient || sending}
                className="rounded-lg bg-state-blocked px-4 py-1.5 text-[13px] font-medium text-white hover:opacity-80 disabled:opacity-50"
              >
                {sending ? "..." : "Withdraw"}
              </button>
            </div>
          </div>
        )}
        {status && <div className="text-[12px] text-text-muted mt-1 break-all">{status}</div>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const agent = "0x3F5b96A494061F7338Da529e3047809Ac6a7FB84" as const;
  const {data: state, loading, error, refetch} = useVaultState(agent);
  const {transactions, loading: txLoading} = useApiTransactions();
  const {agents} = useApiAgents();
  const {recipients, tokens} = useApiAllowlist(agents[0]?.id);
  const {address, isConnected} = useActiveAddress();

  const isOwner = isConnected && !!state && isSameAddress(address, state.vaultOwner);
  const confirmedCount = transactions.filter((t) => t.execution_status === "CONFIRMED").length;
  const blockedCount = transactions.filter((t) => t.execution_status === "BLOCKED").length;
  const spentToday = state?.policy.spentToday ?? 0n;

  return (
    <div className="p-8 max-w-[1200px] mx-auto">
      <div className="mb-8" data-aos="fade-up">
        <h1 className="text-[24px] font-semibold text-text-primary tracking-tight">SpendArc</h1>
        <p className="text-[13px] text-text-muted mt-1">
          Control what autonomous agents can spend, where they can spend it, and how much they can spend.
        </p>
        <div className="flex items-center gap-4 mt-3">
          <span className="inline-flex items-center gap-1.5 text-[12px] text-text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-state-approved" />
            Arc Testnet
          </span>
          {isConnected && address && (
            <span className="text-[12px] text-text-muted">{truncateAddress(address)}</span>
          )}
          <span className="text-[12px] text-text-muted">
            Settlement: {state ? "Active" : "Pending"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <KPICard label="Total USDC Controlled" value={state ? `$${formatUsdc(state.vaultBalance)}` : "-"} sub="USDC in vault" accent />
        <KPICard label="Spent Today" value={state ? `$${formatUsdc(spentToday)}` : "-"} sub="USDC" delay={60} />
        <KPICard label="Remaining Daily" value={state ? `$${formatUsdc(state.remainingDailyCap)}` : "-"} sub="USDC" delay={120} />
        <KPICard label="Approved" value={confirmedCount} sub="transactions" delay={180} />
        <KPICard label="Blocked" value={blockedCount} sub="transactions" delay={240} />
        <KPICard
          label="Agent Status"
          value={loading ? "..." : !state ? "Unavailable" : state.policy.active ? "Active" : "Revoked"}
          sub={loading ? "Loading policy" : !state ? "On-chain read failed" : state.policy.active ? "Policy enforced" : "Needs attention"}
          delay={300}
        />
      </div>

      {error && !state && (
        <div className="flex items-center justify-between rounded-lg border border-state-pending/30 bg-state-pending-light px-4 py-3 mb-8" data-aos="fade-up">
          <div className="text-[12px] text-state-pending">
            Could not read on-chain vault state. This is a network issue, not a policy revocation.
            <span className="block text-[11px] text-state-pending/70 mt-0.5 break-all font-mono">{error.message}</span>
          </div>
          <button
            onClick={() => void refetch()}
            className="ml-4 shrink-0 rounded-lg border border-state-pending/40 px-3 py-1.5 text-[12px] font-medium text-state-pending hover:bg-state-pending/10 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="kpi-card p-5" data-aos="fade-up">
            <div className="text-[11px] font-medium uppercase tracking-wider text-text-secondary mb-4">Spending Analytics</div>
            {transactions.length === 0 ? (
              <EmptyState title="No spending data yet" description="Once the agent makes spending requests, analytics will appear here." />
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-state-approved" />
                    <span className="text-[12px] text-text-muted">{confirmedCount} approved</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-state-blocked" />
                    <span className="text-[12px] text-text-muted">{blockedCount} blocked</span>
                  </div>
                </div>
                <div className="h-32 flex items-end gap-1">
                  {transactions.slice(0, 20).reverse().map((tx, i) => (
                    <div
                      key={tx.id}
                      className={`flex-1 rounded-t ${tx.execution_status === "CONFIRMED" ? "bg-state-approved/30" : "bg-state-blocked/30"}`}
                      style={{height: `${Math.max(10, Number(tx.amount) / 100000)}%`}}
                    />
                  ))}
                </div>
                <div className="text-[11px] text-text-muted text-center">Recent spending decisions (newest right)</div>
              </div>
            )}
          </div>

          <div className="kpi-card" data-aos="fade-up" data-aos-delay="100">
            <div className="px-5 pt-5 pb-3">
              <div className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">Recent Activity</div>
            </div>
            <div className="px-5 pb-5">
              <RecentActivity transactions={transactions} loading={txLoading} />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div data-aos="fade-up" data-aos-delay="120">
            <PolicyHealthCard state={state} recipientCount={recipients.length} tokenCount={tokens.length} />
          </div>
          <div data-aos="fade-up" data-aos-delay="180">
            <AgentHealthCard state={state} loading={loading} agent={agent} />
          </div>
          <div data-aos="fade-up" data-aos-delay="240">
            <VaultFundCard state={state} refetch={refetch} />
          </div>
        </div>
      </div>
    </div>
  );
}

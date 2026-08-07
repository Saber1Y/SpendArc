"use client";

import {useState} from "react";
import {usePrivy} from "@privy-io/react-auth";
import {useApiAgents, useVaultState} from "@/lib/hooks";
import {useActiveAddress} from "@/lib/usePrivyWallet";
import {formatUsdc, truncateAddress, isSameAddress} from "@/lib/format";
import {explorerAddress} from "@/lib/chain";
import {TransactionHistoryCard} from "@/components/dashboard/TransactionTable";
import {DailyCapMeter} from "@/components/dashboard/DailyCapMeter";
import type {Address} from "viem";

function AgentCard({agent, state, loading, delay = 0}: {agent: {id: string; name: string; address: string}; state: ReturnType<typeof useVaultState>["data"]; loading: boolean; delay?: number}) {
  return (
    <div className="kpi-card p-6" data-aos="fade-up" data-aos-delay={delay}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="text-[13px] font-semibold text-text-primary">{agent.name}</div>
          <div className="text-[12px] text-text-muted mt-0.5">ID: {agent.id}</div>
        </div>
        {loading && !state ? (
          <div className="h-5 w-16 rounded-full bg-surface-hover animate-pulse" />
        ) : !state ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-state-pending-light text-[12px] font-medium text-state-pending">
            <span className="h-1.5 w-1.5 rounded-full bg-state-pending" /> Unavailable
          </span>
        ) : state.policy.active ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-state-approved-light text-[12px] font-medium text-state-approved">
            <span className="h-1.5 w-1.5 rounded-full bg-state-approved" /> Active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-state-blocked-light text-[12px] font-medium text-state-blocked">
            <span className="h-1.5 w-1.5 rounded-full bg-state-blocked" /> No Policy
          </span>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between py-2 border-b border-border">
          <span className="text-[12px] text-text-muted">Agent address</span>
          <a href={explorerAddress(agent.address as `0x${string}`)} target="_blank" rel="noopener noreferrer" className="text-[12px] font-mono text-accent hover:underline">
            {truncateAddress(agent.address as `0x${string}`)}
          </a>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-border">
          <span className="text-[12px] text-text-muted">Network</span>
          <span className="text-[12px] text-text-primary">Arc Testnet</span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-border">
          <span className="text-[12px] text-text-muted">Vault balance</span>
          <span className="text-[13px] font-medium text-text-primary tabular-nums">
            {loading && !state ? "-" : <>{formatUsdc(state?.vaultBalance ?? 0n)} USDC</>}
          </span>
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="text-[12px] text-text-muted">Policy authorization</span>
          {loading && !state ? (
            <span className="text-[12px] text-text-muted">-</span>
          ) : !state ? (
            <span className="inline-flex items-center gap-1 text-[12px] font-medium text-state-pending">
              <span className="h-1.5 w-1.5 rounded-full bg-state-pending" /> Unavailable
            </span>
          ) : state.policy.active ? (
            <span className="inline-flex items-center gap-1 text-[12px] font-medium text-state-approved">
              <span className="h-1.5 w-1.5 rounded-full bg-state-approved" /> Authorized
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[12px] font-medium text-state-blocked">
              <span className="h-1.5 w-1.5 rounded-full bg-state-blocked" /> Not authorized
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function VaultSummary({state, loading}: {state: ReturnType<typeof useVaultState>["data"]; loading: boolean}) {
  return (
    <div className="kpi-card p-6" data-aos="fade-up">
      <div className="text-[11px] font-medium uppercase tracking-wider text-text-secondary mb-4">Vault Summary</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 rounded-lg border border-accent/20 bg-accent-light/30">
          <div className="flex items-center gap-2 mb-3">
            <span className="h-2 w-2 rounded-full bg-accent" />
            <span className="text-[12px] font-medium text-text-primary">Vault Funds</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-text-muted">USDC balance</span>
              <span className="text-[13px] font-medium text-accent tabular-nums">
                {loading && !state ? "-" : <>{formatUsdc(state?.vaultBalance ?? 0n)} USDC</>}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-text-muted">Remaining daily cap</span>
              <span className="text-[13px] font-medium text-text-primary tabular-nums">
                {loading && !state ? "-" : <>{formatUsdc(state?.remainingDailyCap ?? 0n)} USDC</>}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-accent/20">
            <div className="text-[11px] text-text-muted">
              The agent can request spending. The vault enforces policy on-chain.
            </div>
          </div>
        </div>

        <div className="p-4 rounded-lg border border-border">
          <div className="flex items-center gap-2 mb-3">
            <span className="h-2 w-2 rounded-full bg-state-pending" />
            <span className="text-[12px] font-medium text-text-primary">Settlement</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-text-muted">Network</span>
              <span className="text-[12px] text-text-primary">Arc Testnet</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-text-muted">Token</span>
              <span className="text-[12px] text-text-primary">USDC</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateUserAgentCard({onCreated, hasAgent}: {onCreated: () => void; hasAgent?: boolean}) {
  const {login} = usePrivy();
  const {address, isConnected} = useActiveAddress();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [agentId, setAgentId] = useState("");
  const [registeredAddress, setRegisteredAddress] = useState("");
  const [maxPerTxUsdc, setMaxPerTxUsdc] = useState(1);
  const [dailyCapUsdc, setDailyCapUsdc] = useState(2);
  const [copied, setCopied] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);

  const register = async () => {
    if (!address || !name.trim()) return;
    setSaving(true);
    setError("");
    setApiKey("");
    setPromptCopied(false);
    try {
      const res = await fetch("/api/agents/user", {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({name: name.trim(), address}),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.message ?? d.error ?? "Failed to register");
      } else {
        setApiKey(d.apiKey);
        setAgentId(d.agent.id);
        setRegisteredAddress(d.agent.address);
        setMaxPerTxUsdc((d.policy?.maxPerTx ?? 5_000_000) / 1_000_000);
        setDailyCapUsdc((d.policy?.dailyCap ?? 10_000_000) / 1_000_000);
        setName("");
        onCreated();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  const handoffPrompt = apiKey
    ? `You are my autonomous spending agent on SpendArc.

Agent id: ${agentId}
API key: ${apiKey}
My wallet: ${registeredAddress}

Your leash (enforced on-chain by the SpendArc vault):
- ${maxPerTxUsdc} USDC per transaction
- ${dailyCapUsdc} USDC per day
- payments only to ${registeredAddress} (my wallet)

Work with the SpendArc API (base URL: ${baseUrl}):
1. Read your leash: GET ${baseUrl}/api/agents/me with header "Authorization: Bearer ${apiKey}"
2. Make a payment: POST ${baseUrl}/api/payments/request with JSON {"agentId": "${agentId}", "recipient": "${registeredAddress}", "amount": 0.5, "token": "USDC", "purpose": "agent test"} and the same Authorization header.

Task: introspect your leash first, then make a test payment of 0.5 USDC to my wallet, and report the outcome (approved with tx hash, or the block reason).`
    : "";

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(handoffPrompt);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 1500);
    } catch {
      setPromptCopied(false);
    }
  };

  return (
    <div className="kpi-card p-6" data-aos="fade-up">
      <div className="flex items-start justify-between mb-1">
        <div>
          <div className="text-[13px] font-semibold text-text-primary">Create your agent</div>
          <div className="text-[12px] text-text-muted mt-0.5">
            Your wallet address becomes an on-chain vault agent with a scoped spending leash.
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-light/60 text-[12px] font-medium text-accent shrink-0">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Booth demo
        </span>
      </div>

      {apiKey ? (
        <>
          <div className="mt-4 rounded-lg border border-accent/25 bg-accent-light/20 p-4">
            <div className="text-[12px] font-medium text-text-primary mb-1">Your agent is live - API key (shown once)</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md bg-surface px-3 py-2 text-[12px] font-mono text-text-primary break-all">{apiKey}</code>
              <button
                onClick={copyKey}
                className="shrink-0 rounded-md border border-border bg-white px-3 py-2 text-[12px] font-medium text-text-primary hover:border-accent"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="text-[11px] text-text-muted mt-2">
              Save it now - it is stored only as a hash. Send it as <code className="text-text-primary">Authorization: Bearer &lt;key&gt;</code> when
              requesting payments, and to <code className="text-text-primary">/api/agents/me</code> to read your leash.
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-border bg-white p-4">
            <div className="text-[12px] font-medium text-text-primary mb-1">Give this to your AI agent</div>
            <div className="text-[11px] text-text-muted mb-3">
              Paste this into your AI agent (opencode, ChatGPT, Claude, etc.) - it contains your key, leash, and endpoints. The agent will
              introspect its leash, then make a 0.5 USDC test payment to your wallet.
            </div>
            <pre className="rounded-md bg-surface-muted px-3 py-3 text-[11px] font-mono text-text-primary whitespace-pre-wrap break-words max-h-64 overflow-y-auto mb-3">
              {handoffPrompt}
            </pre>
            <button
              onClick={copyPrompt}
              className="rounded-md border border-border bg-white px-3 py-2 text-[12px] font-medium text-text-primary hover:border-accent"
            >
              {promptCopied ? "Prompt copied" : "Copy prompt"}
            </button>
          </div>
        </>
      ) : hasAgent ? (
        <div className="mt-4 rounded-lg border border-border bg-surface-muted/50 p-4">
          <div className="text-[12px] font-medium text-text-primary mb-1">Agent registered for this wallet</div>
          <div className="text-[11px] text-text-muted">
            Your API key was shown once at registration and is stored only as a hash. If you lost it, create a new agent with a new wallet
            address. Your agent, leash, and payment history are below.
          </div>
        </div>
      ) : (
        <div className="mt-4">
          {!isConnected || !address ? (
            <button
              onClick={() => login()}
              className="rounded-lg bg-accent px-5 py-2.5 text-[13px] font-medium text-white hover:bg-accent-hover"
            >
              Connect wallet
            </button>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[12px] text-text-muted">Connected:</span>
                <a href={explorerAddress(address as `0x${string}`)} target="_blank" rel="noopener noreferrer" className="text-[12px] font-mono text-accent hover:underline">
                  {truncateAddress(address as `0x${string}`)}
                </a>
              </div>
              <div className="flex gap-3 items-start">
                <div className="flex-1 space-y-2">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Agent name (e.g. My Spending Bot)"
                    className="w-full rounded-lg border border-border bg-white px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent"
                  />
                  <div className="text-[11px] text-text-muted">
                    Default leash: <span className="text-text-primary font-medium">5 USDC</span> per transaction,{" "}
                    <span className="text-text-primary font-medium">10 USDC</span> per day, payments only to your own address. Gas for
                    registration is paid by the vault owner.
                  </div>
                </div>
                <button
                  onClick={register}
                  disabled={!name.trim() || saving}
                  className="rounded-lg bg-accent px-5 py-2 text-[13px] font-medium text-white hover:bg-accent-hover disabled:opacity-50 shrink-0"
                >
                  {saving ? "Registering..." : "Register agent"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
      {error && <div className="text-[12px] text-state-blocked mt-3">{error}</div>}
    </div>
  );
}

export default function AgentsPage() {
  const {agents, loading: agentsLoading, refetch: refetchAgents} = useApiAgents();
  const {address, isConnected} = useActiveAddress();
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const firstAgent = agents[0];
  const myAgent = agents.find((a) => isSameAddress(a.address, address)) ?? null;
  const stateAgent = (myAgent?.address ?? firstAgent?.address ?? "0x3F5b96A494061F7338Da529e3047809Ac6a7FB84") as `0x${string}`;
  const {data: state, loading: vaultLoading} = useVaultState(stateAgent);
  const loading = agentsLoading || vaultLoading;
  const isOwner = isConnected && !!state && isSameAddress(address, state.vaultOwner);
  const historyAgentId = selectedAgentId || firstAgent?.id || "";

  if (isOwner) {
    return (
      <div className="p-8 max-w-[1200px] mx-auto">
        <div className="mb-6" data-aos="fade-up">
          <h1 className="text-[20px] font-semibold text-text-primary tracking-tight">Agents</h1>
          <p className="text-[13px] text-text-muted mt-1">Agent wallet management and authorization status</p>
        </div>

        <div className="space-y-6">
          <CreateUserAgentCard onCreated={refetchAgents} />
          {agents.length === 0 && !agentsLoading ? (
            null
          ) : (
            agents.map((agent, i) => (
              <AgentCard key={agent.id} agent={agent} state={state} loading={loading} delay={i * 100} />
            ))
          )}
          {firstAgent && <VaultSummary state={state} loading={loading} />}
          {agents.length > 0 && (
            <>
              <div className="kpi-card p-4 flex items-center gap-4" data-aos="fade-up">
                <span className="text-[12px] text-text-muted">Transaction history for:</span>
                <select
                  value={historyAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  className="rounded-lg border border-border bg-white px-3 py-1.5 text-[13px] text-text-primary outline-none focus:border-accent"
                >
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.id.slice(0, 12)}...)</option>
                  ))}
                </select>
              </div>
              {historyAgentId && <TransactionHistoryCard agentId={historyAgentId} />}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1200px] mx-auto">
      <div className="mb-6" data-aos="fade-up">
        <h1 className="text-[20px] font-semibold text-text-primary tracking-tight">My Agent</h1>
        <p className="text-[13px] text-text-muted mt-1">Your on-chain spending agent, its leash, and its payment history</p>
      </div>

      <div className="space-y-6">
        <CreateUserAgentCard onCreated={refetchAgents} hasAgent={!!myAgent} />
        {myAgent && state && (
          <>
            <div className="kpi-card p-6" data-aos="fade-up" data-aos-delay="50">
              <div className="text-[11px] font-medium uppercase tracking-wider text-text-secondary mb-4">Your spending leash</div>
              <DailyCapMeter spent={state.policy.spentToday} cap={state.policy.dailyCap} remaining={state.remainingDailyCap} />
              <div className="mt-4 pt-3 border-t border-border text-[11px] text-text-muted">
                Enforced on-chain by the SpendArc vault. Your AI agent can request up to the per-transaction and daily limits below.
              </div>
            </div>
            <AgentCard agent={myAgent} state={state} loading={loading} delay={100} />
            <TransactionHistoryCard agentId={myAgent.id} />
          </>
        )}
      </div>
    </div>
  );
}

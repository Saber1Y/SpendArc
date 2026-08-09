"use client";

import {useState, useEffect} from "react";
import {useVaultState} from "@/lib/hooks";
import {isSameAddress, truncateAddress} from "@/lib/format";
import {useActiveAddress} from "@/lib/usePrivyWallet";
import {useRole, useMyAgent} from "@/lib/useRole";
import {CONTRACTS} from "@/lib/contracts";
import {explorerAddress} from "@/lib/chain";
import {PageLoader} from "@/components/ui/PageLoader";

type Health = {label: string; ok: boolean; detail?: string}[];

function HealthIcon({ok}: {ok: boolean}) {
  return (
    <span
      className={`inline-block h-1.5 w-1.5 rounded-full ${ok ? "bg-state-approved" : "bg-state-blocked"}`}
    />
  );
}

function SettingsSection({title, children, delay = 0}: {title: string; children: React.ReactNode; delay?: number}) {
  return (
    <div className="kpi-card p-5" data-aos="fade-up" data-aos-delay={delay}>
      <div className="text-[11px] font-medium uppercase tracking-wider text-text-secondary mb-4">{title}</div>
      {children}
    </div>
  );
}

function CopyButton({value}: {value: string}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="text-[11px] text-accent hover:underline shrink-0"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function OwnerSettings() {
  const agent = "0x3F5b96A494061F7338Da529e3047809Ac6a7FB84" as const;
  const {data: state, loading} = useVaultState(agent, CONTRACTS.vault);
  const {address, isConnected} = useActiveAddress();
  const [health, setHealth] = useState<Health>([]);
  const [envVars, setEnvVars] = useState<Record<string, string>>({});

  useEffect(() => {
    const check = async () => {
      const results: Health = [];

      results.push({label: "Vault contract deployed", ok: !!state, detail: state ? CONTRACTS.vault : undefined});

      if (state) {
        results.push({
          label: "Vault owner set",
          ok: state.vaultOwner !== "0x0000000000000000000000000000000000000000",
          detail: truncateAddress(state.vaultOwner),
        });
      }

      results.push({label: "USDC configured", ok: CONTRACTS.usdc !== "0x0000000000000000000000000000000000000000"});

      try {
        const res = await fetch("/api/agents");
        if (res.ok) {
          const data = await res.json();
          results.push({label: "Agents API", ok: true, detail: `${data.agents?.length ?? 0} agents`});
        } else {
          results.push({label: "Agents API", ok: false, detail: `${res.status}`});
        }
      } catch (e) {
        results.push({label: "Agents API", ok: false, detail: (e as Error).message});
      }

      setHealth(results);
    };
    check();
  }, [state]);

  useEffect(() => {
    setEnvVars({
      NEXT_PUBLIC_VAULT_ADDRESS: CONTRACTS.vault,
      NEXT_PUBLIC_ARC_EXPLORER_URL: process.env.NEXT_PUBLIC_ARC_EXPLORER_URL || "https://testnet.arcscan.app",
    });
  }, []);

  const isOwner = isConnected && !!state && isSameAddress(address, state.vaultOwner);

  return (
    <div className="p-8 max-w-[900px] mx-auto">
      <div className="mb-6" data-aos="fade-up">
        <h1 className="text-[20px] font-semibold text-text-primary tracking-tight">Settings</h1>
        <p className="text-[13px] text-text-muted mt-1">System configuration and environment</p>
      </div>

      <div className="space-y-6">
        {/* Network */}
        <SettingsSection title="Network">
          <div className="space-y-2 text-[13px]">
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Chain</span>
              <span className="text-text-primary font-medium">Arc Testnet (5042002)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-muted">RPC</span>
              <span className="text-text-primary font-mono text-[12px] truncate max-w-[350px]">https://rpc.testnet.arc.network</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Explorer</span>
              <span className="text-text-primary font-mono text-[12px] truncate max-w-[350px]">https://testnet.arcscan.app</span>
            </div>
          </div>
        </SettingsSection>

        {/* Vault */}
        <SettingsSection title="Vault" delay={60}>
          <div className="space-y-2 text-[13px]">
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Address</span>
              <span className="flex items-center gap-2">
                <span className="text-text-primary font-mono text-[12px]">{truncateAddress(CONTRACTS.vault)}</span>
                <CopyButton value={CONTRACTS.vault} />
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Owner</span>
              <span className="flex items-center gap-2">
                <span className="text-text-primary font-mono text-[12px]">
                  {loading ? "..." : state ? truncateAddress(state.vaultOwner) : "-"}
                </span>
                {state && <CopyButton value={state.vaultOwner} />}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Explorer</span>
              <a
                href={explorerAddress(CONTRACTS.vault)}
                target="_blank"
                className="text-accent hover:underline text-[12px]"
              >
                View on Arcscan
              </a>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-muted">USDC Token</span>
              <span className="flex items-center gap-2">
                <span className="text-text-primary font-mono text-[12px]">{truncateAddress(CONTRACTS.usdc)}</span>
                <CopyButton value={CONTRACTS.usdc} />
              </span>
            </div>
          </div>
        </SettingsSection>

        {/* Connected Wallet */}
        <SettingsSection title="Wallet" delay={120}>
          {isConnected && address ? (
            <div className="space-y-2 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Connected</span>
                <span className="text-text-primary font-mono text-[12px]">{truncateAddress(address)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Role</span>
                <span className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${isOwner ? "bg-state-approved" : "bg-text-muted"}`} />
                  <span className="text-text-primary">{isOwner ? "Owner" : "Viewer"}</span>
                </span>
              </div>
            </div>
          ) : (
            <div className="text-[13px] text-text-muted">Connect your wallet to manage vault settings.</div>
          )}
        </SettingsSection>

        {/* Environment Variables */}
        <SettingsSection title="Environment" delay={180}>
          <div className="space-y-2 text-[13px]">
            {Object.entries(envVars).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-text-muted font-mono text-[12px]">{key}</span>
                <span className="flex items-center gap-2">
                  <span className="text-text-primary font-mono text-[12px] max-w-[300px] truncate">
                    {value ? (key.includes("PRIVATE") ? "••••••••" : value) : "Not set"}
                  </span>
                  {value && !key.includes("PRIVATE") && <CopyButton value={value} />}
                </span>
              </div>
            ))}
          </div>
        </SettingsSection>

        {/* Health Check */}
        <SettingsSection title="System Health" delay={240}>
          <div className="space-y-2">
            {health.length === 0 ? (
              <div className="text-[13px] text-text-muted">Checking...</div>
            ) : (
              health.map((h) => (
                <div key={h.label} className="flex items-center justify-between text-[13px]">
                  <span className="flex items-center gap-2">
                    <HealthIcon ok={h.ok} />
                    <span className={h.ok ? "text-text-primary" : "text-state-blocked"}>{h.label}</span>
                  </span>
                  {h.detail && <span className="text-text-muted font-mono text-[12px]">{h.detail}</span>}
                </div>
              ))
            )}
          </div>
        </SettingsSection>
      </div>
    </div>
  );
}

function UserSettings() {
  const {address, isConnected} = useActiveAddress();
  const {agent} = useMyAgent();

  return (
    <div className="p-8 max-w-[900px] mx-auto">
      <div className="mb-6" data-aos="fade-up">
        <h1 className="text-[20px] font-semibold text-text-primary tracking-tight">Settings</h1>
        <p className="text-[13px] text-text-muted mt-1">Your agent, wallet, and the network it runs on</p>
      </div>

      <div className="space-y-6">
        <SettingsSection title="Network">
          <div className="space-y-2 text-[13px]">
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Chain</span>
              <span className="text-text-primary font-medium">Arc Testnet (5042002)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-muted">RPC</span>
              <span className="text-text-primary font-mono text-[12px] truncate max-w-[350px]">https://rpc.testnet.arc.network</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Explorer</span>
              <span className="text-text-primary font-mono text-[12px] truncate max-w-[350px]">https://testnet.arcscan.app</span>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title="Wallet" delay={60}>
          {isConnected && address ? (
            <div className="space-y-2 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Connected</span>
                <span className="flex items-center gap-2">
                  <span className="text-text-primary font-mono text-[12px]">{truncateAddress(address)}</span>
                  <CopyButton value={address} />
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Role</span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-text-muted" />
                  <span className="text-text-primary">User</span>
                </span>
              </div>
            </div>
          ) : (
            <div className="text-[13px] text-text-muted">Connect your wallet to manage your agent.</div>
          )}
        </SettingsSection>

        <SettingsSection title="Agent" delay={120}>
          {agent ? (
            <div className="space-y-2 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Name</span>
                <span className="text-text-primary font-medium">{agent.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Agent ID</span>
                <span className="text-text-primary font-mono text-[12px]">{agent.id}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Agent address</span>
                <span className="flex items-center gap-2">
                  <a href={explorerAddress(agent.address as `0x${string}`)} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline text-[12px] font-mono">
                    {truncateAddress(agent.address as `0x${string}`)}
                  </a>
                  <CopyButton value={agent.address} />
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Vault</span>
                <span className="flex items-center gap-2">
                  <a href={explorerAddress(CONTRACTS.vault)} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline text-[12px] font-mono">
                    {truncateAddress(CONTRACTS.vault)}
                  </a>
                  <CopyButton value={CONTRACTS.vault} />
                </span>
              </div>
            </div>
          ) : (
            <div className="text-[13px] text-text-muted">No agent registered for this wallet yet. Register one on My Agent.</div>
          )}
        </SettingsSection>

        <SettingsSection title="Vault & Operator Settings" delay={180}>
          <div className="text-[12px] text-text-muted">
            Operator-only surfaces (funds management, global allowlists, audit log, deployment health) are not visible to users.
          </div>
        </SettingsSection>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const {isOwner, loading} = useRole();

  if (loading) {
    return <PageLoader label="Resolving your role..." fill />;
  }

  return isOwner ? <OwnerSettings /> : <UserSettings />;
}

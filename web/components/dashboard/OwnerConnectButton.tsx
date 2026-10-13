"use client";

import {useState} from "react";
import {usePrivy, useWallets} from "@privy-io/react-auth";
import {Chip} from "@/components/ui/Chip";
import {Dot} from "@/components/ui/Icons";
import {truncateAddress} from "@/lib/format";

/**
 * Sidebar account control. Connected: a single tidy card showing the wallet address (click to
 * copy) with a live status dot and a dedicated Disconnect button. Disconnected: a Connect Wallet
 * button. Both drive Privy's own auth, so this stays in sync with the embedded/injected wallet.
 */
export function OwnerConnectButton() {
  const {ready, authenticated, login, logout} = usePrivy();
  const {wallets} = useWallets();
  const [copied, setCopied] = useState(false);

  const address = authenticated ? wallets[0]?.address : undefined;

  const copy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable - ignore */
    }
  };

  if (address) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] p-2 pl-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
          <WalletIcon />
        </span>

        <button
          onClick={copy}
          title="Copy full address"
          className="group min-w-0 flex-1 text-left"
        >
          <span className="flex items-center gap-1.5">
            <Dot width={7} height={7} className="shrink-0 text-state-approved" />
            <span className="truncate font-mono text-[12.5px] text-white/85 group-hover:text-white">
              {truncateAddress(address)}
            </span>
          </span>
          <span className="block text-[10px] leading-none text-white/35 group-hover:text-white/50">
            {copied ? "Copied" : "Connected · copy"}
          </span>
        </button>

        <button
          onClick={() => logout()}
          disabled={!ready}
          title="Disconnect wallet"
          aria-label="Disconnect wallet"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/40 transition hover:bg-white/10 hover:text-white/90 disabled:opacity-50"
        >
          <LogoutIcon />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => login()}
      disabled={!ready}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2.5 text-[13px] font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
    >
      <WalletIcon />
      {ready ? "Connect Wallet" : "..."}
    </button>
  );
}

function WalletIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M3 9h18" />
      <circle cx="16.5" cy="13.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 17l5-5-5-5M20 12H9M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" />
    </svg>
  );
}

/** Small inline connection state chip used inside owner-only panels. */
export function ConnectionHint({isOwner, connected}: {isOwner: boolean; connected: boolean}) {
  if (!connected) return <Chip tone="outline">connect the owner wallet to edit</Chip>;
  if (!isOwner) return <Chip tone="blush">connected wallet isn&rsquo;t the vault owner</Chip>;
  return (
    <Chip tone="mint">
      <Dot width={9} height={9} /> owner connected
    </Chip>
  );
}

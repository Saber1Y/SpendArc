"use client";

import {useAccount} from "wagmi";
import {usePrivy} from "@privy-io/react-auth";
import {Chip} from "@/components/ui/Chip";
import {Dot} from "@/components/ui/Icons";
import {truncateAddress} from "@/lib/format";

export function OwnerConnectButton() {
  const {ready, login, logout} = usePrivy();
  const {address, isConnected} = useAccount();

  if (isConnected && address) {
    return (
      <button
        onClick={() => logout()}
        className="inline-flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-white/70 transition hover:bg-white/10 hover:text-white/90"
        title="Disconnect"
      >
        <Dot width={8} height={8} className="text-state-approved shrink-0" />
        <span className="truncate">{truncateAddress(address)}</span>
      </button>
    );
  }

  return (
    <button
      onClick={() => login()}
      disabled={!ready}
      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-[13px] font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
    >
      {ready ? "Connect Wallet" : "..."}
    </button>
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

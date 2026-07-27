"use client";

import {useAccount, useConnect, useDisconnect} from "wagmi";
import {Button} from "@/components/ui/Button";
import {Chip} from "@/components/ui/Chip";
import {Dot} from "@/components/ui/Icons";
import {truncateAddress} from "@/lib/format";

export function OwnerConnectButton() {
  const {address, isConnected} = useAccount();
  const {connect, connectors, isPending} = useConnect();
  const {disconnect} = useDisconnect();

  if (isConnected && address) {
    return (
      <button
        onClick={() => disconnect()}
        className="inline-flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-white/70 transition hover:bg-white/10 hover:text-white/90"
        title="Disconnect"
      >
        <Dot width={8} height={8} className="text-state-approved shrink-0" />
        <span className="truncate">{truncateAddress(address)}</span>
      </button>
    );
  }

  const injected = connectors[0];
  return (
    <button
      onClick={() => injected && connect({connector: injected})}
      disabled={isPending || !injected}
      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-[13px] font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
    >
      {isPending ? "Connecting..." : "Connect Wallet"}
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

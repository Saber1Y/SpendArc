"use client";

import {useCallback} from "react";
import {usePrivy, useWallets} from "@privy-io/react-auth";
import {createWalletClient, custom, type Address, type WalletClient} from "viem";
import {arcChain} from "./arc";
import {publicClient} from "./chain";

/**
 * Active wallet address from Privy - the single source of truth for wallet state.
 * Only reports a connected wallet once the Privy session is both resolved and authenticated,
 * so a restored-but-unauthenticated session can never masquerade as a connection.
 */
export function useActiveAddress() {
  const {ready, authenticated} = usePrivy();
  const {wallets} = useWallets();
  const wallet = wallets[0];
  const connected = ready && authenticated && !!wallet;
  return {
    address: connected ? (wallet.address as Address) : undefined,
    isConnected: connected,
  };
}

/** Build a viem wallet client from the connected Privy wallet for owner writes. */
export function usePrivyWalletClient() {
  const {ready, authenticated} = usePrivy();
  const {wallets} = useWallets();
  const wallet = wallets[0];
  const connected = ready && authenticated && !!wallet;

  const getClient = useCallback(async (): Promise<WalletClient | null> => {
    if (!connected || !wallet) return null;
    if (String(wallet.chainId) !== String(arcChain.id)) {
      await wallet.switchChain(arcChain.id);
    }
    const provider = await wallet.getEthereumProvider();
    return createWalletClient({
      account: wallet.address as Address,
      chain: arcChain,
      transport: custom(provider),
    });
  }, [connected, wallet]);

  return {getClient, address: wallet?.address as Address | undefined, hasWallet: connected};
}

/** Wait for an on-chain receipt via the Arc public client. */
export async function waitForReceipt(hash: `0x${string}`) {
  return publicClient.waitForTransactionReceipt({hash});
}

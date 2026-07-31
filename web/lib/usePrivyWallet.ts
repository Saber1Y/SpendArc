"use client";

import {useCallback} from "react";
import {useWallets} from "@privy-io/react-auth";
import {createWalletClient, custom, type Address, type WalletClient} from "viem";
import {arcChain} from "./arc";
import {publicClient} from "./chain";

/** Active wallet address from Privy - the single source of truth for wallet state. */
export function useActiveAddress() {
  const {wallets, ready} = useWallets();
  const wallet = wallets[0];
  return {
    address: wallet?.address as Address | undefined,
    isConnected: ready && !!wallet,
  };
}

/** Build a viem wallet client from the connected Privy wallet for owner writes. */
export function usePrivyWalletClient() {
  const {wallets} = useWallets();
  const wallet = wallets[0];

  const getClient = useCallback(async (): Promise<WalletClient | null> => {
    if (!wallet) return null;
    const provider = await wallet.getEthereumProvider();
    return createWalletClient({
      account: wallet.address as Address,
      chain: arcChain,
      transport: custom(provider),
    });
  }, [wallet]);

  return {getClient, address: wallet?.address as Address | undefined, hasWallet: !!wallet};
}

/** Wait for an on-chain receipt via the Arc public client. */
export async function waitForReceipt(hash: `0x${string}`) {
  return publicClient.waitForTransactionReceipt({hash});
}

"use client";

import {useActiveAddress} from "./usePrivyWallet";
import {useVaultState} from "./hooks";
import {isSameAddress, type Address} from "./format";

/** Demo agent (also the vault owner) - used as the read anchor for owner() + policy reads. */
const ROLE_ANCHOR = "0x3F5b96A494061F7338Da529e3047809Ac6a7FB84" as Address;

/**
 * Dashboard role. The vault owner sees the full operator control plane.
 * Everyone else is a booth visitor and sees only their own agent.
 */
export function useRole() {
  const {address, isConnected} = useActiveAddress();
  const {data: state, loading} = useVaultState(ROLE_ANCHOR);
  const isOwner = isConnected && !!state && isSameAddress(address, state.vaultOwner);
  return {isOwner, isConnected, address, loading};
}

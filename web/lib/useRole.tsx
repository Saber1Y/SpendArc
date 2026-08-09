"use client";

import {createContext, useContext} from "react";
import {useActiveAddress} from "./usePrivyWallet";
import {useVaultState, useApiAgents} from "./hooks";
import {isSameAddress, type Address} from "./format";
import {CONTRACTS} from "./contracts";

/** Demo agent (also the vault owner) - used as the read anchor for owner() + policy reads. */
const ROLE_ANCHOR = "0x3F5b96A494061F7338Da529e3047809Ac6a7FB84" as Address;

export interface RoleValue {
  isOwner: boolean;
  isConnected: boolean;
  address?: Address;
  loading: boolean;
}

/**
 * Dashboard role, resolved ONCE at the layout and shared with every page.
 * Previously each page called useVaultState(ROLE_ANCHOR) again, so a single
 * navigation did the full on-chain read twice (layout + page) and users sat
 * on "Resolving role..." twice. The provider guarantees one read total.
 *
 * The vault owner sees the full operator control plane. Everyone else is a
 * booth visitor and sees only their own agent.
 */
const RoleContext = createContext<RoleValue>({isOwner: false, isConnected: false, loading: true});

export function RoleProvider({children}: {children: React.ReactNode}) {
  const {address, isConnected} = useActiveAddress();
  const {data: state, loading} = useVaultState(ROLE_ANCHOR, CONTRACTS.vault);
  const isOwner = isConnected && !!state && isSameAddress(address, state.vaultOwner);
  return (
    <RoleContext.Provider value={{isOwner, isConnected, address, loading}}>{children}</RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}

/** The registered agent belonging to the connected wallet (visitor scope). */
export function useMyAgent() {
  const {address, isConnected} = useActiveAddress();
  const {agents, loading} = useApiAgents();
  const agent = isConnected && address ? (agents.find((a) => isSameAddress(a.address, address)) ?? null) : null;
  return {agent, loading, isConnected, address};
}

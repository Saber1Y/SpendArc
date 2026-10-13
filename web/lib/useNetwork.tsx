"use client";

import {useCallback, useSyncExternalStore} from "react";
import {NETWORK_COOKIE, getActiveNetworkKey, getNetwork, DEFAULT_NETWORK, type NetworkKey} from "./networks";

/**
 * The viewer's active network, backed by a cookie. Switching writes the cookie and reloads so every
 * module (chain config, contracts, wallet) re-evaluates for the chosen network. SSR uses the default
 * network; the client reconciles after hydration via useSyncExternalStore.
 */
export function useActiveNetwork() {
  const key = useSyncExternalStore<NetworkKey>(
    () => () => {},
    getActiveNetworkKey,
    () => DEFAULT_NETWORK,
  );

  const switchNetwork = useCallback((next: NetworkKey) => {
    if (next === getActiveNetworkKey()) return;
    document.cookie = `${NETWORK_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  }, []);

  return {networkKey: key, network: getNetwork(key), switchNetwork};
}

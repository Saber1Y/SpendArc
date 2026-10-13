import {defineChain, type Chain} from "viem";
import {arc, arcTestnet} from "viem/chains";

/**
 * Network presets shared by client and server. No secrets live here - executor keys are resolved
 * separately on the server by network (see serverChain.ts). The app can run against Arc mainnet or
 * testnet; the active network is chosen per viewer (a cookie) on the client and per agent on the
 * server (each agent is bound to the network it was created on).
 */
export type NetworkKey = "mainnet" | "testnet";

export interface NetworkConfig {
  key: NetworkKey;
  label: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
  usdc: `0x${string}`;
  factory: `0x${string}`;
  vault: `0x${string}`;
  testnet: boolean;
}

// Native USDC (ERC-20 interface) is the same fixed address on Arc mainnet and testnet.
const ARC_USDC = "0x3600000000000000000000000000000000000000" as const;

export const NETWORKS: Record<NetworkKey, NetworkConfig> = {
  mainnet: {
    key: "mainnet",
    label: "Arc Mainnet",
    chainId: 5042,
    rpcUrl: process.env.NEXT_PUBLIC_ARC_MAINNET_RPC_URL || "https://rpc.mainnet.arc.io",
    explorerUrl: "https://explorer.arc.io",
    usdc: ARC_USDC,
    factory: (process.env.NEXT_PUBLIC_MAINNET_FACTORY_ADDRESS || "0xd79850b02aFDeE63F9fcB0eB385eB6B1526dB7fb") as `0x${string}`,
    vault: (process.env.NEXT_PUBLIC_MAINNET_VAULT_ADDRESS || "0x8D80cEEe03C86de7d90478c5D7599004f375Ef6F") as `0x${string}`,
    testnet: false,
  },
  testnet: {
    key: "testnet",
    label: "Arc Testnet",
    chainId: 5042002,
    rpcUrl: process.env.NEXT_PUBLIC_ARC_TESTNET_RPC_URL || "https://rpc.testnet.arc.network",
    explorerUrl: "https://testnet.arcscan.app",
    usdc: ARC_USDC,
    factory: (process.env.NEXT_PUBLIC_TESTNET_FACTORY_ADDRESS || "0x084c2061384bffd6254d1423e35b53ea91aaed87") as `0x${string}`,
    vault: (process.env.NEXT_PUBLIC_TESTNET_VAULT_ADDRESS || "0x82b7a7a401a5a94a6b5f55ec6aff3c8017633b56") as `0x${string}`,
    testnet: true,
  },
};

/** Cookie the client sets to persist the viewer's chosen network; the server reads it per request. */
export const NETWORK_COOKIE = "spendarc_network";

/** Default network when nothing is selected. Follows NEXT_PUBLIC_ARC_CHAIN_ID, else mainnet. */
export const DEFAULT_NETWORK: NetworkKey = Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID) === NETWORKS.testnet.chainId ? "testnet" : "mainnet";

export function isNetworkKey(v: unknown): v is NetworkKey {
  return v === "mainnet" || v === "testnet";
}

export function getNetwork(key: NetworkKey | undefined | null): NetworkConfig {
  return NETWORKS[key && isNetworkKey(key) ? key : DEFAULT_NETWORK];
}

/** Map a chain id back to a network key (used when an agent stored only an address). */
export function networkKeyForChainId(chainId: number): NetworkKey {
  return chainId === NETWORKS.testnet.chainId ? "testnet" : "mainnet";
}

/**
 * The viewer's active network key. In the browser it comes from the cookie the Settings toggle
 * sets; on the server (SSR and module load) it falls back to the default. The Settings toggle sets
 * the cookie and reloads, so client modules re-evaluate ACTIVE_NETWORK for the chosen network.
 */
export function getActiveNetworkKey(): NetworkKey {
  if (typeof document !== "undefined") {
    const m = document.cookie.match(/(?:^|; )spendarc_network=([^;]+)/);
    if (m && isNetworkKey(m[1])) return m[1];
  }
  return DEFAULT_NETWORK;
}

export const ACTIVE_NETWORK: NetworkConfig = getNetwork(getActiveNetworkKey());

/** Build a viem Chain for a network, preferring the built-in Arc chains. */
export function chainFor(net: NetworkConfig): Chain {
  if (net.chainId === arc.id) return {...arc, rpcUrls: {default: {http: [net.rpcUrl]}}};
  if (net.chainId === arcTestnet.id) return {...arcTestnet, rpcUrls: {default: {http: [net.rpcUrl]}}};
  return defineChain({
    id: net.chainId,
    name: net.label,
    nativeCurrency: {name: "USDC", symbol: "USDC", decimals: 18},
    rpcUrls: {default: {http: [net.rpcUrl]}},
    blockExplorers: {default: {name: "Arc Explorer", url: net.explorerUrl}},
    testnet: net.testnet,
  });
}

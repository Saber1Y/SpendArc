import {defineChain, createPublicClient, createWalletClient, http} from "viem";
import {privateKeyToAccount} from "viem/accounts";

export const ARC_CHAIN_ID = Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID || "5042002");
export const ARC_RPC_URL = process.env.NEXT_PUBLIC_ARC_RPC_URL || "https://rpc.testnet.arc.network";
export const ARC_EXPLORER_URL = process.env.NEXT_PUBLIC_ARC_EXPLORER_URL || "https://testnet.arcscan.app";

export const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS || "0x3600000000000000000000000000000000000000") as `0x${string}`;

export const arcChain = defineChain({
  id: ARC_CHAIN_ID,
  name: "Arc Testnet",
  nativeCurrency: {name: "USDC", symbol: "USDC", decimals: 6},
  rpcUrls: {default: {http: [ARC_RPC_URL]}},
  blockExplorers: {default: {name: "ArcScan", url: ARC_EXPLORER_URL}},
  testnet: true,
});

export const arcPublicClient = createPublicClient({chain: arcChain, transport: http(ARC_RPC_URL)});

export const arcExplorerTx = (hash: string) => `${ARC_EXPLORER_URL}/tx/${hash}`;
export const arcExplorerAddress = (addr: string) => `${ARC_EXPLORER_URL}/address/${addr}`;

export function getArcWalletClient(privateKey: `0x${string}`) {
  const account = privateKeyToAccount(privateKey);
  return createWalletClient({account, chain: arcChain, transport: http(ARC_RPC_URL)});
}

import {defineChain, createPublicClient, createWalletClient, http} from "viem";
import {arc, arcTestnet} from "viem/chains";
import {privateKeyToAccount} from "viem/accounts";

export const ARC_CHAIN_ID = Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID || "5042");
export const ARC_RPC_URL = process.env.NEXT_PUBLIC_ARC_RPC_URL || "https://rpc.mainnet.arc.io";
export const ARC_EXPLORER_URL = process.env.NEXT_PUBLIC_ARC_EXPLORER_URL || "https://explorer.arc.io";

export const IS_MAINNET = ARC_CHAIN_ID === arc.id;

export const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS || "0x3600000000000000000000000000000000000000") as `0x${string}`;

/**
 * Arc chain definition. We prefer viem's built-in `arc`/`arcTestnet` (correct id, 18-decimal
 * native USDC, canonical explorer) and only fall back to a custom definition if the configured
 * chain id matches neither - driven entirely by env so the same build runs on testnet or mainnet.
 */
function resolveChain() {
  if (ARC_CHAIN_ID === arc.id) {
    return {...arc, rpcUrls: {default: {http: [ARC_RPC_URL]}}};
  }
  if (ARC_CHAIN_ID === arcTestnet.id) {
    return {...arcTestnet, rpcUrls: {default: {http: [ARC_RPC_URL]}}};
  }
  return defineChain({
    id: ARC_CHAIN_ID,
    name: "Arc",
    nativeCurrency: {name: "USDC", symbol: "USDC", decimals: 18},
    rpcUrls: {default: {http: [ARC_RPC_URL]}},
    blockExplorers: {default: {name: "Arc Explorer", url: ARC_EXPLORER_URL}},
    testnet: !IS_MAINNET,
  });
}

export const arcChain = resolveChain();

export const arcPublicClient = createPublicClient({chain: arcChain, transport: http(ARC_RPC_URL)});

export const arcExplorerTx = (hash: string) => `${ARC_EXPLORER_URL}/tx/${hash}`;
export const arcExplorerAddress = (addr: string) => `${ARC_EXPLORER_URL}/address/${addr}`;

export function getArcWalletClient(privateKey: `0x${string}`) {
  const account = privateKeyToAccount(privateKey);
  return createWalletClient({account, chain: arcChain, transport: http(ARC_RPC_URL)});
}

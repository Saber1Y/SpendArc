import {createPublicClient, createWalletClient, http} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {ACTIVE_NETWORK, chainFor} from "./networks";

/**
 * Active-network view of the Arc config, for client code. The active network is the viewer's
 * cookie-selected network (see networks.ts), defaulting to mainnet. Server code that must act on a
 * specific agent's network uses serverChain.ts instead of these module-level constants.
 */
export const ARC_CHAIN_ID = ACTIVE_NETWORK.chainId;
export const ARC_RPC_URL = ACTIVE_NETWORK.rpcUrl;
export const ARC_EXPLORER_URL = ACTIVE_NETWORK.explorerUrl;
export const IS_MAINNET = !ACTIVE_NETWORK.testnet;
export const USDC_ADDRESS = ACTIVE_NETWORK.usdc;

export const arcChain = chainFor(ACTIVE_NETWORK);

export const arcPublicClient = createPublicClient({chain: arcChain, transport: http(ARC_RPC_URL)});

export const arcExplorerTx = (hash: string) => `${ARC_EXPLORER_URL}/tx/${hash}`;
export const arcExplorerAddress = (addr: string) => `${ARC_EXPLORER_URL}/address/${addr}`;

export function getArcWalletClient(privateKey: `0x${string}`) {
  const account = privateKeyToAccount(privateKey);
  return createWalletClient({account, chain: arcChain, transport: http(ARC_RPC_URL)});
}

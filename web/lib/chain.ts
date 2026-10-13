import {createPublicClient, http} from "viem";
import {arcChain, ARC_EXPLORER_URL, CLIENT_RPC_URL} from "./arc";

export const publicClient = createPublicClient({chain: arcChain, transport: http(CLIENT_RPC_URL)});

export const explorerTx = (hash: string) => `${ARC_EXPLORER_URL}/tx/${hash}`;
export const explorerAddress = (addr: string) => `${ARC_EXPLORER_URL}/address/${addr}`;

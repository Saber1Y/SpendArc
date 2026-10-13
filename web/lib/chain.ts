import {createPublicClient, http} from "viem";
import {arcChain, ARC_EXPLORER_URL} from "./arc";

export const publicClient = createPublicClient({chain: arcChain, transport: http()});

export const explorerTx = (hash: string) => `${ARC_EXPLORER_URL}/tx/${hash}`;
export const explorerAddress = (addr: string) => `${ARC_EXPLORER_URL}/address/${addr}`;

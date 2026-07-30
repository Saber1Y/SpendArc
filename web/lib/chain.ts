import {createPublicClient, http} from "viem";
import {arcChain} from "./arc";

export const publicClient = createPublicClient({chain: arcChain, transport: http()});

export const explorerTx = (hash: string) => `https://testnet.arcscan.app/tx/${hash}`;
export const explorerAddress = (addr: string) => `https://testnet.arcscan.app/address/${addr}`;

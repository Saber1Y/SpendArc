"use client";

import {useState} from "react";
import type {Abi} from "viem";
import {arcChain} from "./arc";
import {usePrivyWalletClient} from "./usePrivyWallet";
import {waitForReceiptRaw} from "./txwait";

export type WriteArgs = {
  address: `0x${string}`;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
};

export type WriteStatus = {pending: boolean; error?: string; okKey?: number};

/**
 * Owner write with the backend confirmation pattern: submit → wait for raw receipt → READ BACK
 * (caller's refetch) to confirm the effect. Never uses a formatted waitForTransactionReceipt.
 */
export function useOwnerWrite(refetch: () => void) {
  const {getClient} = usePrivyWalletClient();
  const [status, setStatus] = useState<WriteStatus>({pending: false});

  const run = async (args: WriteArgs) => {
    setStatus({pending: true});
    try {
      const client = await getClient();
      if (!client) throw new Error("No wallet connected");
      const hash = await client.writeContract({
        ...args,
        chain: arcChain,
        account: client.account!,
      });
      const result = await waitForReceiptRaw(hash);
      if (result === "reverted") {
        setStatus({pending: false, error: "Transaction reverted on-chain"});
        return;
      }
      refetch(); // read-back the resulting state
      setStatus({pending: false, okKey: Date.now()});
    } catch (e) {
      const err = e as {shortMessage?: string; message?: string};
      setStatus({pending: false, error: err.shortMessage ?? err.message ?? "Transaction failed"});
    }
  };

  return {run, ...status};
}

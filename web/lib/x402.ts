import {createPublicClient, http, type Hex} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {wrapFetchWithPayment, x402Client, x402HTTPClient, type HTTPResourceResponse} from "@x402/fetch";
import {ExactEvmScheme, toClientEvmSigner} from "@x402/evm";
import {ARC_CHAIN_ID, ARC_RPC_URL, USDC_ADDRESS, arcChain} from "./arc";

type Caip2 = `${string}:${string}`;
/** CAIP-2 network id of the SpendArc settlement chain (Arc testnet by default). */
export const ARC_NETWORK: Caip2 = `eip155:${ARC_CHAIN_ID}`;

export interface PayX402Options {
  /** Per-request USDC ceiling enforced client-side before settlement. Defaults to $1. */
  maxAmountUsd?: number | string;
  /** Optional client-supplied key; replaying the same key + credential returns the original result instead of charging again. */
  idempotencyKey?: string;
  /** Arc RPC override. Defaults to the app's ARC_RPC_URL. */
  rpcUrl?: string;
  /** Additional request headers merged over `init.headers`. */
  headers?: Record<string, string>;
}

export interface PayX402Result extends HTTPResourceResponse {
  /** Settlement metadata: tx hash / receipt fields when the status is "settled". */
  settle?: HTTPResourceResponse["header"];
}

/**
 * Call an x402-protected endpoint and pay for it with the SpendArc executor key.
 *
 * The executor signs an EIP-3009 authorization that lets the facilitator pull USDC
 * on the SpendArc settlement chain (Arc testnet by default). Both the host's 402
 * PAYMENT-REQUIRED declaration and the `Idempotency-Key` header are handled by the
 * wrapped fetch; settlement is verified via the response's PAYMENT-RESPONSE decoding.
 *
 * No agentcash, no third-party wallet manager: the payment identity IS the SpendArc
 * executor account, derived from EXECUTOR_PRIVATE_KEY.
 */
export async function payX402(
  input: RequestInfo | URL,
  init: RequestInit = {},
  opts: PayX402Options = {},
): Promise<PayX402Result> {
  const key = process.env.EXECUTOR_PRIVATE_KEY;
  if (!key) throw new Error("EXECUTOR_PRIVATE_KEY not configured");

  const rpcUrl = opts.rpcUrl ?? ARC_RPC_URL;
  const account = privateKeyToAccount(key as Hex);
  const publicClient = createPublicClient({chain: arcChain, transport: http(rpcUrl)});
  const signer = toClientEvmSigner(account, publicClient);
  const scheme = new ExactEvmScheme(signer, {rpcUrl});

  const client = x402Client.fromConfig({
    schemes: [{network: ARC_NETWORK as Caip2, client: scheme}],
    spendControls: {
      maxAmountPerPayment: typeof opts.maxAmountUsd === "string" ? opts.maxAmountUsd : `$${opts.maxAmountUsd ?? 1}`,
      allowedAssets: [{network: ARC_NETWORK as Caip2, asset: USDC_ADDRESS}],
    },
  });

  const httpClient = new x402HTTPClient(client);
  const fetchWithPay = wrapFetchWithPayment(fetch, httpClient);

  const headers = new Headers(init.headers);
  if (opts.idempotencyKey) headers.set("Idempotency-Key", opts.idempotencyKey);
  for (const [name, value] of Object.entries(opts.headers ?? {})) headers.set(name, value);

  const response = await fetchWithPay(input, {...init, headers, cache: "no-store"});
  return {...(await httpClient.processResponse(response)), settle: httpClient.getPaymentSettleResponse((n) => response.headers.get(n))};
}
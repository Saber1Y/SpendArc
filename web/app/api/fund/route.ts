import {NextRequest, NextResponse} from "next/server";
import {isAddress, type Address} from "viem";
import {fundVisitorWallet, checkVaultBalance} from "@/lib/executor";
import {CONTRACTS} from "@/lib/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GAS_ETH_WEI = BigInt("50000000000000000"); // 0.05 ETH for vault txs
const USDC_BASE = 3_000_000n; // 3 USDC test funds for the visitor (temporary while operator refills)

/**
 * Testnet faucet: fund a visitor wallet with native gas (to create/deposit into its vault)
 * and USDC (to deposit as its own funds). Operator key signs both transfers. Arc testnet
 * only - not a production path.
 */
export async function POST(req: NextRequest) {
  let body: {address?: string};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const address = (body.address ?? "").trim() as Address;
  if (!isAddress(address)) {
    return NextResponse.json({error: "Valid address required"}, {status: 400});
  }

  const res = await fundVisitorWallet(address, GAS_ETH_WEI, USDC_BASE);
  if (!res.success) {
    return NextResponse.json(
      {error: "FUND_FAILED", message: res.error ?? "Failed to fund wallet"},
      {status: 502},
    );
  }

  return NextResponse.json({
    gasAmountEth: "0.05",
    usdcAmount: "3",
    gasTx: res.gasTx,
    usdcTx: res.usdcTx,
    note: "Testnet faucet - the operator key signs both transfers.",
  });
}

export async function GET() {
  const balance = await checkVaultBalance(CONTRACTS.vault);
  return NextResponse.json({gasAmountEth: "0.05", usdcAmount: "3", vaultUsdc: balance.toString()});
}

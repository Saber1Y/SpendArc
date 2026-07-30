import {NextResponse} from "next/server";
import {CONTRACTS} from "@/lib/contracts";

export const dynamic = "force-dynamic";

export async function GET() {
  const vaultConfigured = CONTRACTS.vault !== "0x0000000000000000000000000000000000000000";
  return NextResponse.json({
    status: "ok",
    vault: vaultConfigured ? CONTRACTS.vault : null,
    usdc: CONTRACTS.usdc,
  });
}

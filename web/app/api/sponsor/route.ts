import {NextResponse} from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({configured: false, message: "Sponsor endpoint is deprecated — SpendArc now uses Arc testnet without a paymaster."});
}

export async function POST() {
  return NextResponse.json({
    error: "deprecated",
    message: "The BOT Chain 4337 sponsor/paymaster endpoint has been removed. SpendArc now uses Arc testnet with a direct vault model — no paymaster needed.",
  }, {status: 501});
}

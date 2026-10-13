import {NextRequest, NextResponse} from "next/server";
import {getNetwork} from "@/lib/networks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Same-origin JSON-RPC proxy for the dashboard's on-chain reads. The browser talks to this route
 * instead of the public Arc RPC directly, which removes the intermittent "Failed to fetch" errors
 * (browser-to-public-RPC flakiness / rate limits) and keeps reads same-origin. The target RPC is
 * chosen by the `network` query param so it works for both mainnet and testnet. Server-side reads
 * (executor, verification) continue to hit the RPC directly via serverChain.ts.
 */
export async function POST(req: NextRequest) {
  const net = getNetwork(req.nextUrl.searchParams.get("network") as "mainnet" | "testnet" | null);
  const body = await req.text();

  let lastErr = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(net.rpcUrl, {
        method: "POST",
        headers: {"content-type": "application/json"},
        body,
        cache: "no-store",
      });
      const text = await r.text();
      return new NextResponse(text, {status: r.status, headers: {"content-type": "application/json"}});
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      await new Promise((res) => setTimeout(res, 300 * (attempt + 1)));
    }
  }
  return NextResponse.json(
    {jsonrpc: "2.0", id: null, error: {code: -32603, message: `upstream RPC unreachable: ${lastErr}`}},
    {status: 502},
  );
}

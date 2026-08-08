import {NextRequest, NextResponse} from "next/server";
import {listAllowlistEntries, addAllowlistEntry, removeAllowlistEntry} from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, {params}: {params: Promise<{agentId: string}>}) {
  const {agentId} = await params;
  const recipients = listAllowlistEntries(agentId, "recipient");
  const tokens = listAllowlistEntries(agentId, "token");
  return NextResponse.json({recipients, tokens});
}

export async function POST(req: NextRequest, {params}: {params: Promise<{agentId: string}>}) {
  const {agentId} = await params;
  try {
    const body = await req.json();
    const {type, address, label} = body;
    if (!type || !address) return NextResponse.json({error: "type and address required"}, {status: 400});
    const maxPerTxUsdc = typeof body.maxPerTxUsdc === "number" && body.maxPerTxUsdc > 0 ? Math.round(body.maxPerTxUsdc * 1_000_000) : null;
    const dailyCapUsdc = typeof body.dailyCapUsdc === "number" && body.dailyCapUsdc > 0 ? Math.round(body.dailyCapUsdc * 1_000_000) : null;
    if (maxPerTxUsdc != null && dailyCapUsdc != null && maxPerTxUsdc > dailyCapUsdc) {
      return NextResponse.json({error: "Per-service per-tx budget cannot exceed its daily budget"}, {status: 400});
    }
    const entry = addAllowlistEntry(agentId, type, address, label || "", maxPerTxUsdc, dailyCapUsdc);
    return NextResponse.json({entry}, {status: 201});
  } catch {
    return NextResponse.json({error: "invalid request"}, {status: 400});
  }
}

export async function DELETE(req: NextRequest, {params}: {params: Promise<{agentId: string}>}) {
  const {agentId} = await params;
  try {
    const body = await req.json();
    removeAllowlistEntry(body.id);
    return NextResponse.json({ok: true});
  } catch {
    return NextResponse.json({error: "invalid request"}, {status: 400});
  }
}

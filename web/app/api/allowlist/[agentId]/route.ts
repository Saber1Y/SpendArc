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
    const entry = addAllowlistEntry(agentId, type, address, label || "");
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

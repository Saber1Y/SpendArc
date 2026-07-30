import {NextRequest, NextResponse} from "next/server";
import {getPolicy, updatePolicy} from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, {params}: {params: Promise<{agentId: string}>}) {
  const {agentId} = await params;
  const policy = getPolicy(agentId);
  if (!policy) return NextResponse.json({error: "not found"}, {status: 404});
  return NextResponse.json({policy});
}

export async function PUT(req: NextRequest, {params}: {params: Promise<{agentId: string}>}) {
  const {agentId} = await params;
  try {
    const body = await req.json();
    const fields: Record<string, unknown> = {};
    if (body.maxPerTx !== undefined) fields.max_per_tx = Math.round(Number(body.maxPerTx) * 1e6);
    if (body.dailyCap !== undefined) fields.daily_cap = Math.round(Number(body.dailyCap) * 1e6);
    if (body.expiry !== undefined) fields.expiry = body.expiry;
    if (body.active !== undefined) fields.active = body.active ? 1 : 0;
    const policy = updatePolicy(agentId, fields);
    if (!policy) return NextResponse.json({error: "not found"}, {status: 404});
    return NextResponse.json({policy});
  } catch {
    return NextResponse.json({error: "invalid request"}, {status: 400});
  }
}

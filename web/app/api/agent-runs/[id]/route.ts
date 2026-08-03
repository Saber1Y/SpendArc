import {NextRequest, NextResponse} from "next/server";
import {getAgentRun, addAgentRunEvent, listAgentRunEvents, endAgentRun, updateAgentRun} from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const run = getAgentRun(id);
  if (!run) return NextResponse.json({error: "not found"}, {status: 404});
  const events = listAgentRunEvents(id);
  return NextResponse.json({run, events});
}

export async function POST(req: NextRequest, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const run = getAgentRun(id);
  if (!run) return NextResponse.json({error: "not found"}, {status: 404});
  try {
    const body = await req.json();
    const kind = body.kind ?? "info";
    const summary = body.summary ?? "";
    const txHash = body.txHash ?? null;

    if (summary === "" && !body.txHash) {
      return NextResponse.json({error: "summary required"}, {status: 400});
    }

    if (body.passed !== undefined || body.failed !== undefined) {
      const fields: {passed?: number; failed?: number} = {};
      if (body.passed !== undefined) fields.passed = body.passed;
      if (body.failed !== undefined) fields.failed = body.failed;
      updateAgentRun(id, fields);
    }

    const event = addAgentRunEvent(id, kind, summary, body.details ?? {}, txHash);
    return NextResponse.json({event}, {status: 201});
  } catch {
    return NextResponse.json({error: "invalid request"}, {status: 400});
  }
}

export async function PUT(req: NextRequest, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const run = getAgentRun(id);
  if (!run) return NextResponse.json({error: "not found"}, {status: 404});
  try {
    const body = await req.json();
    if (body.action === "end") {
      const ended = endAgentRun(id, body.status ?? "completed");
      addAgentRunEvent(id, "run_end", `Run ${body.status ?? "completed"}`, {});
      return NextResponse.json({run: ended});
    }
    return NextResponse.json({error: "unsupported action"}, {status: 400});
  } catch {
    return NextResponse.json({error: "invalid request"}, {status: 400});
  }
}

export async function PATCH(req: NextRequest, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const run = getAgentRun(id);
  if (!run) return NextResponse.json({error: "not found"}, {status: 404});
  try {
    const body = await req.json();
    const fields: {status?: string; spent?: number; passed?: number; failed?: number} = {};
    if (body.status !== undefined) fields.status = body.status;
    if (body.spent !== undefined) fields.spent = body.spent;
    if (body.passed !== undefined) fields.passed = body.passed;
    if (body.failed !== undefined) fields.failed = body.failed;
    const updated = updateAgentRun(id, fields);
    return NextResponse.json({run: updated});
  } catch {
    return NextResponse.json({error: "invalid request"}, {status: 400});
  }
}

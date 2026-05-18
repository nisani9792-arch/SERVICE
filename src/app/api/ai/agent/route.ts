import { NextRequest, NextResponse } from "next/server";
import { processAgentCommand } from "@/lib/ai-agent-processor";
import { requireRegisteredOperator } from "@/lib/api-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Multi-agent free-text command processor */
export async function POST(request: NextRequest) {
  const operator = await requireRegisteredOperator(request);
  if (operator instanceof NextResponse) return operator;

  try {
    const body = (await request.json()) as {
      text?: string;
      selectedTicketIds?: string[];
    };

    const text = String(body.text ?? "").trim();
    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const result = await processAgentCommand(text, {
      selectedTicketIds: Array.isArray(body.selectedTicketIds)
        ? body.selectedTicketIds.filter(Boolean).slice(0, 80)
        : [],
      operatorName: operator.displayName
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Agent processing failed",
        details: error instanceof Error ? error.message : "Unknown"
      },
      { status: 500 }
    );
  }
}

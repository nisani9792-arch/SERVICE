import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/neon";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json() as {
      subject?: string;
      body?: string;
      category?: string;
      priority?: number;
      aiSummary?: string;
      status?: string;
    };

    const effectiveStatus = body.category === "handled" ? "handled" : (body.status ?? undefined);

    const rows = await sql()`
      UPDATE tickets SET
        subject    = COALESCE(${body.subject ?? null}, subject),
        body       = COALESCE(${body.body ?? null}, body),
        category   = COALESCE(${body.category ?? null}, category),
        priority   = COALESCE(${body.priority ?? null}, priority),
        ai_summary = COALESCE(${body.aiSummary ?? null}, ai_summary),
        status     = COALESCE(${effectiveStatus ?? null}, status),
        updated_at = now()
      WHERE id = ${params.id}
      RETURNING id
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update ticket", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await sql()`DELETE FROM tickets WHERE id = ${params.id}`;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete ticket", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}

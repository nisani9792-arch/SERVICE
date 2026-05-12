import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/neon";

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json() as {
      ids: string[];
      category?: string;
      status?: string;
    };

    const ids = body.ids;
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids array is required" }, { status: 400 });
    }

    const category = body.category ?? null;
    const status = category === "handled" ? "handled" : (body.status ?? null);

    await sql()`
      UPDATE tickets SET
        category   = COALESCE(${category}, category),
        status     = COALESCE(${status}, status),
        updated_at = now()
      WHERE id = ANY(${ids})
    `;

    return NextResponse.json({ ok: true, updated: ids.length });
  } catch (error) {
    return NextResponse.json(
      { error: "Bulk update failed", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json() as { ids: string[] };
    const ids = body.ids;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids array is required" }, { status: 400 });
    }

    await sql()`DELETE FROM tickets WHERE id = ANY(${ids})`;
    return NextResponse.json({ ok: true, deleted: ids.length });
  } catch (error) {
    return NextResponse.json(
      { error: "Bulk delete failed", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}

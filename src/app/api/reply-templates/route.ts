import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/neon";
import { ensureReplyTemplatesTable } from "@/lib/reply-templates-schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureReplyTemplatesTable();
    const rows = await sql()`
      SELECT id, title, body, shortcut, created_at
      FROM reply_templates
      ORDER BY created_at DESC
    `;
    const items = rows.map((r) => ({
      id: String(r.id),
      title: String(r.title ?? ""),
      body: String(r.body ?? ""),
      shortcut: String(r.shortcut ?? ""),
      createdAt: String(r.created_at ?? "")
    }));
    return NextResponse.json({ items });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown";
    const hint = details.includes("DATABASE_URL")
      ? "הגדר DATABASE_URL ב-Render (Neon connection string)."
      : undefined;
    return NextResponse.json(
      { error: "list failed", details, hint },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureReplyTemplatesTable();
    const body = await request.json() as {
      title?: string;
      body?: string;
      shortcut?: string;
    };
    const title = String(body.title ?? "").trim() || "תבנית";
    const tplBody = String(body.body ?? "").trim();
    const shortcut = String(body.shortcut ?? "").trim();
    if (!tplBody) {
      return NextResponse.json({ error: "body is required" }, { status: 400 });
    }

    const rows = await sql()`
      INSERT INTO reply_templates (title, body, shortcut)
      VALUES (${title}, ${tplBody}, ${shortcut})
      RETURNING id, title, body, shortcut, created_at
    `;
    const r = rows[0];
    return NextResponse.json(
      {
        item: {
          id: String(r.id),
          title: String(r.title),
          body: String(r.body),
          shortcut: String(r.shortcut),
          createdAt: String(r.created_at)
        }
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "create failed", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureReplyTemplatesTable();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    await sql()`DELETE FROM reply_templates WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: "delete failed", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}

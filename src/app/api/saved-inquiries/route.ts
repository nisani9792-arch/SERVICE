import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/neon";
import type { SavedInquiry, SavedInquiryStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUSES: SavedInquiryStatus[] = ["open", "in_progress", "done"];

function rowToSavedInquiry(row: Record<string, unknown>): SavedInquiry {
  return {
    id: String(row.id),
    ticketId: row.ticket_id ? String(row.ticket_id) : null,
    title: String(row.title ?? ""),
    content: String(row.content ?? ""),
    note: String(row.note ?? ""),
    status: (String(row.status ?? "open") as SavedInquiryStatus) || "open",
    sourceEmail: String(row.source_email ?? ""),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

async function ensureSavedInquiriesSchema(): Promise<void> {
  await sql()`
    CREATE TABLE IF NOT EXISTS saved_inquiries (
      id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      ticket_id    TEXT,
      title        TEXT NOT NULL DEFAULT '',
      content      TEXT NOT NULL DEFAULT '',
      note         TEXT NOT NULL DEFAULT '',
      status       TEXT NOT NULL DEFAULT 'open',
      source_email TEXT NOT NULL DEFAULT '',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql()`CREATE INDEX IF NOT EXISTS idx_saved_inquiries_created_at ON saved_inquiries (created_at DESC)`;
  await sql()`CREATE INDEX IF NOT EXISTS idx_saved_inquiries_status ON saved_inquiries (status)`;
  await sql()`CREATE INDEX IF NOT EXISTS idx_saved_inquiries_ticket_id ON saved_inquiries (ticket_id)`;
}

export async function GET() {
  try {
    await ensureSavedInquiriesSchema();
    const rows = await sql()`
      SELECT id, ticket_id, title, content, note, status, source_email, created_at, updated_at
      FROM saved_inquiries
      ORDER BY created_at DESC
    `;
    return NextResponse.json({ items: rows.map((row) => rowToSavedInquiry(row as Record<string, unknown>)) });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch saved inquiries", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureSavedInquiriesSchema();
    const body = (await request.json()) as {
      ticketId?: string;
      title?: string;
      content?: string;
      note?: string;
      status?: SavedInquiryStatus;
      sourceEmail?: string;
    };

    const title = (body.title ?? "").trim();
    const content = (body.content ?? "").trim();
    if (!title || !content) {
      return NextResponse.json({ error: "title and content are required" }, { status: 400 });
    }

    const rows = await sql()`
      INSERT INTO saved_inquiries (ticket_id, title, content, note, status, source_email)
      VALUES (
        ${body.ticketId ?? null},
        ${title},
        ${content},
        ${(body.note ?? "").trim()},
        ${STATUSES.includes(body.status as SavedInquiryStatus) ? body.status : "open"},
        ${(body.sourceEmail ?? "").trim()}
      )
      RETURNING id, ticket_id, title, content, note, status, source_email, created_at, updated_at
    `;

    return NextResponse.json(rowToSavedInquiry(rows[0] as Record<string, unknown>), { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to save inquiry", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await ensureSavedInquiriesSchema();
    const body = (await request.json()) as {
      id?: string;
      title?: string;
      content?: string;
      note?: string;
      status?: SavedInquiryStatus;
    };

    if (!body.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const rows = await sql()`
      UPDATE saved_inquiries
      SET title = COALESCE(${body.title ?? null}, title),
          content = COALESCE(${body.content ?? null}, content),
          note = COALESCE(${body.note ?? null}, note),
          status = COALESCE(${STATUSES.includes(body.status as SavedInquiryStatus) ? body.status : null}, status),
          updated_at = now()
      WHERE id = ${body.id}
      RETURNING id, ticket_id, title, content, note, status, source_email, created_at, updated_at
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Saved inquiry not found" }, { status: 404 });
    }

    return NextResponse.json(rowToSavedInquiry(rows[0] as Record<string, unknown>));
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update saved inquiry", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureSavedInquiriesSchema();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await sql()`DELETE FROM saved_inquiries WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete saved inquiry", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}

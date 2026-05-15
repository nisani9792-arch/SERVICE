import { NextRequest, NextResponse } from "next/server";
import { listTicketAttachments } from "@/lib/ticket-attachments";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const items = await listTicketAttachments(params.id);
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to list attachments",
        details: error instanceof Error ? error.message : "Unknown"
      },
      { status: 500 }
    );
  }
}

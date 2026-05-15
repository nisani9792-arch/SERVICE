import { NextRequest, NextResponse } from "next/server";
import { getTicketAttachmentContent } from "@/lib/ticket-attachments";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string; attachmentId: string } }
) {
  try {
    const file = await getTicketAttachmentContent(params.id, params.attachmentId);
    if (!file) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(file.buffer), {
      status: 200,
      headers: {
        "Content-Type": file.contentType,
        "Content-Length": String(file.buffer.length),
        "Content-Disposition": `inline; filename="${encodeURIComponent(file.filename)}"`,
        "Cache-Control": "private, max-age=3600"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load attachment",
        details: error instanceof Error ? error.message : "Unknown"
      },
      { status: 500 }
    );
  }
}

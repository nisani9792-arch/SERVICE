import { NextRequest, NextResponse } from "next/server";
import { classifyTicketContent } from "@/lib/gemini";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      senderEmail?: string;
      subject?: string;
      content?: string;
    };

    const senderEmail = body.senderEmail?.trim() ?? "";
    const subject = body.subject?.trim() ?? "";
    const content = body.content?.trim() ?? "";

    if (!content) {
      return NextResponse.json(
        { error: "content is required" },
        { status: 400 }
      );
    }

    const classification = await classifyTicketContent(
      senderEmail,
      subject,
      content
    );
    return NextResponse.json(classification);
  } catch {
    return NextResponse.json(
      { error: "failed to classify content" },
      { status: 500 }
    );
  }
}

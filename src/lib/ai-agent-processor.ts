import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  countBatchTargets,
  createBatchJob,
  getBatchJob,
  runBatchJobChunk
} from "@/lib/ai-batch-runner";
import { classifyTicketContent } from "@/lib/gemini";
import { cleanMessageForAi } from "@/lib/message-filter";
import { sweepSpamHeuristicChunk } from "@/lib/spam-sweep";
import { sql } from "@/lib/neon";
import { rowToTicket } from "@/lib/ticket-row";
import { PENDING_TRIAGE_CATEGORY } from "@/lib/triage";
const MODEL_NAME = "gemini-1.5-flash";

export type AgentTaskType =
  | "reclassify_batch"
  | "spam_sweep"
  | "classify_text"
  | "search_tickets"
  | "summarize_selection";

export type AgentTask = {
  type: AgentTaskType;
  scope?: "spam" | "pending_triage" | "non_spam";
  limit?: number;
  ids?: string[];
  query?: string;
  subject?: string;
  body?: string;
  senderEmail?: string;
};

export type AgentActionResult = {
  agent: string;
  ok: boolean;
  message: string;
  data?: Record<string, unknown>;
};

export type AgentPipelineResult = {
  reply: string;
  tasks: AgentTask[];
  actions: AgentActionResult[];
  jobId?: string;
};

export type AgentContext = {
  selectedTicketIds?: string[];
  operatorName?: string;
};

function extractJsonBlock(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first === -1 || last === -1) return trimmed;
  return trimmed.slice(first, last + 1);
}

function heuristicTasks(text: string, ctx: AgentContext): AgentTask[] {
  const lower = text.toLowerCase();
  const tasks: AgentTask[] = [];

  if (/ספאם|spam/.test(lower) && /סרוק|נקה|העבר|סנן|sweep/.test(lower)) {
    tasks.push({ type: "spam_sweep", limit: 500 });
  } else if (
    /ספאם|spam/.test(lower) &&
    (/סווג|סיווג|reclassif|בדוק|סרוק/.test(lower) || /מחדש/.test(lower))
  ) {
    tasks.push({ type: "reclassify_batch", scope: "non_spam", limit: 500 });
  } else if (/ממתין|triage|סינון/.test(lower) && /סווג|סיווג|ai/.test(lower)) {
    tasks.push({ type: "reclassify_batch", scope: "pending_triage", limit: 100 });
  }

  if (ctx.selectedTicketIds?.length && /סווג|סיווג|ai|מיין/.test(lower)) {
    tasks.push({ type: "reclassify_batch", ids: ctx.selectedTicketIds.slice(0, 80) });
  }

  if (/חפש|מצא|search|#tk-/i.test(text)) {
    const qMatch = text.match(/(?:חפש|מצא|search)\s+(.+)/i);
    tasks.push({
      type: "search_tickets",
      query: qMatch?.[1]?.trim() || text.replace(/.*#tk-/i, "#TK-").trim(),
      limit: 15
    });
  }

  if (ctx.selectedTicketIds?.length && /סכם|summary|תקציר/.test(lower)) {
    tasks.push({ type: "summarize_selection", ids: ctx.selectedTicketIds.slice(0, 8) });
  }

  if (tasks.length === 0 && text.trim().length > 12) {
    tasks.push({ type: "classify_text", body: text, subject: "פניית משתמש" });
  }

  return tasks;
}

async function parseTasksWithLlm(text: string, ctx: AgentContext): Promise<AgentTask[]> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) return heuristicTasks(text, ctx);

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
  });

  const prompt = `
You are the router agent for Jusic CRM. Parse the operator command into 1-3 tasks (JSON only).

Allowed task types:
- reclassify_batch: { "type":"reclassify_batch", "scope":"spam"|"pending_triage", "limit": number } OR { "type":"reclassify_batch", "ids": ["uuid",...] }
- classify_text: { "type":"classify_text", "subject":"", "body":"", "senderEmail":"" }
- search_tickets: { "type":"search_tickets", "query":"", "limit": 15 }
- summarize_selection: { "type":"summarize_selection", "ids": ["uuid"] }

Context:
selectedTicketIds: ${JSON.stringify(ctx.selectedTicketIds ?? [])}
operator: ${ctx.operatorName ?? ""}

Operator command (Hebrew/English):
${text}

Return: {"tasks":[...]}
`;

  try {
    const response = await model.generateContent(prompt);
    const parsed = JSON.parse(extractJsonBlock(response.response.text())) as { tasks?: AgentTask[] };
    const tasks = Array.isArray(parsed.tasks) ? parsed.tasks.slice(0, 3) : [];
    return tasks.length ? tasks : heuristicTasks(text, ctx);
  } catch {
    return heuristicTasks(text, ctx);
  }
}

async function runSearchAgent(query: string, limit: number): Promise<AgentActionResult> {
  const like = `%${query.replace(/^#?tk-?/i, "").trim()}%`;
  const rows = await sql()`
    SELECT id, ticket_number, sender_email, sender_name, subject,
           left(body, 400) AS body, body_cleaned, category, priority, ai_summary,
           status, source, message_at, tags, assigned_to, closure_note,
           email_message_id, email_mailbox_uid, email_ingested_at, created_at, updated_at
    FROM tickets
    WHERE subject ILIKE ${like}
       OR sender_email ILIKE ${like}
       OR sender_name ILIKE ${like}
       OR ai_summary ILIKE ${like}
       OR CAST(ticket_number AS text) ILIKE ${like}
    ORDER BY COALESCE(message_at, created_at) DESC
    LIMIT ${Math.min(30, Math.max(1, limit))}
  `;

  const tickets = rows.map((r) => rowToTicket(r as Record<string, unknown>));
  return {
    agent: "search",
    ok: true,
    message: `נמצאו ${tickets.length} פניות`,
    data: { tickets, count: tickets.length }
  };
}

async function runClassifierAgent(task: AgentTask): Promise<AgentActionResult> {
  const body = cleanMessageForAi(task.body ?? "");
  const classification = await classifyTicketContent(
    task.senderEmail ?? "",
    task.subject ?? "פנייה",
    body
  );
  return {
    agent: "classifier",
    ok: true,
    message: `סיווג: ${classification.category} (עדיפות ${classification.priority})`,
    data: { classification }
  };
}

async function runSummarizeAgent(ids: string[]): Promise<AgentActionResult> {
  const rows = await sql()`
    SELECT subject, ai_summary, category, status, sender_email
    FROM tickets WHERE id = ANY(${ids}) LIMIT 8
  `;
  const lines = rows.map(
    (r, i) =>
      `${i + 1}. ${String((r as { subject: string }).subject)} — ${String((r as { category: string }).category)} (${String((r as { status: string }).status)})`
  );
  return {
    agent: "summarizer",
    ok: true,
    message: lines.length ? `תקציר ${lines.length} פניות` : "לא נמצאו פניות לסיכום",
    data: { lines, summary: lines.join("\n") }
  };
}

async function runSpamSweepAgent(task: AgentTask): Promise<AgentActionResult> {
  const limit = Math.min(500, task.limit ?? 200);
  let totalMoved = 0;
  let totalScanned = 0;
  let rounds = 0;
  const maxRounds = 40;

  while (rounds < maxRounds) {
    const chunk = await sweepSpamHeuristicChunk(limit);
    totalMoved += chunk.movedToSpam;
    totalScanned += chunk.scanned;
    rounds += 1;
    if (chunk.done || chunk.scanned === 0) break;
  }

  return {
    agent: "spam_sweep",
    ok: true,
    message: `הועברו ${totalMoved} פניות לספאם (נבדקו ${totalScanned})`,
    data: { movedToSpam: totalMoved, scanned: totalScanned, rounds }
  };
}

async function runBatchAgent(task: AgentTask): Promise<AgentActionResult & { jobId?: string }> {
  const ids = task.ids ?? [];
  const classifyScope = task.scope ?? "non_spam";
  const jobScope = ids.length > 0 ? "ids" : classifyScope;
  const limit = Math.min(500, task.limit ?? (ids.length || 200));
  const total = ids.length
    ? Math.min(ids.length, limit)
    : Math.min(limit, await countBatchTargets(classifyScope, []));

  if (total === 0) {
    return { agent: "batch", ok: true, message: "אין פניות לעיבוד", data: { total: 0 } };
  }

  const jobId = await createBatchJob(jobScope, total, 25, { ids, classifyScope });
  let job = (await getBatchJob(jobId))!;
  let chunkResults: Array<{ id: string; from: string; to: string; summary: string }> = [];
  let done = false;
  let guard = 0;

  while (!done && guard < 80) {
    const chunk = await runBatchJobChunk(jobId, {
      scope: classifyScope,
      ids,
      chunkSize: 25
    });
    job = chunk.job;
    chunkResults = chunkResults.concat(chunk.chunkResults);
    done = chunk.done;
    guard += 1;
  }

  return {
    agent: "batch",
    ok: job.status !== "failed",
    message: `סיווג הושלם: ${job.processed}/${job.total} פניות (${chunkResults.length} עודכנו בפעימה האחרונה)`,
    jobId,
    data: {
      jobId,
      total: job.total,
      processed: job.processed,
      status: job.status,
      updated: chunkResults.length
    }
  };
}

async function executeTask(task: AgentTask): Promise<AgentActionResult & { jobId?: string }> {
  switch (task.type) {
    case "reclassify_batch":
      return runBatchAgent(task);
    case "spam_sweep":
      return runSpamSweepAgent(task);
    case "classify_text":
      return runClassifierAgent(task);
    case "search_tickets":
      return runSearchAgent(task.query ?? "", task.limit ?? 15);
    case "summarize_selection":
      return runSummarizeAgent(task.ids ?? []);
    default:
      return { agent: "unknown", ok: false, message: "משימה לא נתמכת" };
  }
}

/** Multi-agent pipeline: router → parallel workers */
export async function processAgentCommand(
  text: string,
  ctx: AgentContext = {}
): Promise<AgentPipelineResult> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { reply: "כתוב פקודה — למשל: «סווג מחדש ספאם» או «חפש billing»", tasks: [], actions: [] };
  }

  const tasks = await parseTasksWithLlm(trimmed, ctx);
  const settled = await Promise.allSettled(tasks.map((task) => executeTask(task)));

  const actions: AgentActionResult[] = settled.map((result, index) => {
    if (result.status === "fulfilled") return result.value;
    return {
      agent: tasks[index]?.type ?? "error",
      ok: false,
      message: result.reason instanceof Error ? result.reason.message : "שגיאה"
    };
  });

  let jobId: string | undefined;
  for (const action of actions) {
    const maybeJob = (action as AgentActionResult & { jobId?: string }).jobId;
    if (maybeJob) jobId = maybeJob;
  }

  const replyParts = actions.map((a) => `• ${a.message}`).filter(Boolean);
  const reply =
    replyParts.length > 0
      ? replyParts.join("\n")
      : "לא זוהתה פעולה. נסה: «סווג ספאם», «סווג ממתין לסינון», או «חפש #TK-10042».";

  return { reply, tasks, actions, jobId };
}

export { PENDING_TRIAGE_CATEGORY };

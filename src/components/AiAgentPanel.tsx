"use client";

import { useState } from "react";
import { Bot, Loader2, Send } from "lucide-react";

export type AgentPanelResult = {
  reply: string;
  jobId?: string;
};

export interface AiAgentPanelProps {
  selectedCount: number;
  busy: boolean;
  onRun: (text: string) => Promise<AgentPanelResult | void>;
}

export function AiAgentPanel({ selectedCount, busy, onRun }: AiAgentPanelProps) {
  const [text, setText] = useState("");
  const [lastReply, setLastReply] = useState<string | null>(null);

  const submit = async () => {
    const command = text.trim();
    if (!command || busy) return;
    const result = await onRun(command);
    if (result?.reply) setLastReply(result.reply);
    setText("");
  };

  return (
    <section className="rounded-xl bg-gradient-to-bl from-primary-soft/30 to-white p-2">
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Bot className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 text-right">
          <h2 className="text-sm font-bold text-on-surface">סוכן AI</h2>
          <p className="text-[11px] text-on-surface-variant">
            פקודה חופשית — סיווג באצ&apos;, חיפוש, תקציר
            {selectedCount > 0 ? ` · ${selectedCount} נבחרו` : ""}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="sr-only" htmlFor="ai-agent-command">
          פקודה לסוכן
        </label>
        <textarea
          id="ai-agent-command"
          rows={2}
          value={text}
          disabled={busy}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder="לדוגמה: סווג מחדש ספאם · חפש billing · סכם את הנבחרות"
          className="crm-touch-input min-h-[3rem] flex-1 resize-none rounded-xl border border-outline/80 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary/50"
        />
        <button
          type="button"
          disabled={busy || !text.trim()}
          onClick={() => {
            void submit();
          }}
          className="crm-touch-target lux-button-primary w-full shrink-0 rounded-xl px-4 sm:w-auto"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          {busy ? "מעבד…" : "הרץ"}
        </button>
      </div>

      {lastReply ? (
        <p className="mt-2 whitespace-pre-wrap rounded-xl border border-outline/60 bg-white/90 px-3 py-2 text-xs leading-relaxed text-on-surface">
          {lastReply}
        </p>
      ) : null}
    </section>
  );
}

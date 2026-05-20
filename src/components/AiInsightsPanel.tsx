"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

type InsightsPayload = {
  generatedAt: string;
  totals: {
    activeTickets: number;
    answeredTickets: number;
    spamTickets: number;
    knowledgeEntries: number;
  };
  topCategories: Array<{ category: string; count: number }>;
  frequentTopics: Array<{ subject: string; count: number; sampleReply: string }>;
  hint: string;
};

export function AiInsightsPanel() {
  const [data, setData] = useState<InsightsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (backfill = false) => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/ai/insights${backfill ? "?backfill=1" : ""}`;
      const res = await fetch(url, { cache: "no-store", credentials: "same-origin" });
      if (!res.ok) throw new Error("טעינת תובנות נכשלה");
      setData((await res.json()) as InsightsPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
    const timer = window.setInterval(() => void load(false), 90_000);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <details className="rounded-2xl border border-violet-200/80 bg-violet-50/40">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-bold text-violet-950">
        <Sparkles className="size-4" />
        תובנות AI בזמן אמת
        {data ? (
          <span className="font-normal text-violet-900/80">
            · {data.totals.knowledgeEntries} תשובות שנלמדו
          </span>
        ) : null}
      </summary>
      <div className="border-t border-violet-200/60 px-3 py-2 text-xs">
        {loading && !data ? <p className="text-on-surface-variant">מנתח נתונים…</p> : null}
        {error ? <p className="text-danger">{error}</p> : null}
        {data ? (
          <div className="space-y-2">
            <p className="text-on-surface-variant">{data.hint}</p>
            <p>
              פעילות: {data.totals.activeTickets.toLocaleString("he-IL")} פניות ·{" "}
              {data.totals.answeredTickets.toLocaleString("he-IL")} נענו ·{" "}
              {data.totals.spamTickets.toLocaleString("he-IL")} בספאם
            </p>
            {data.frequentTopics.length > 0 ? (
              <ul className="space-y-1.5">
                {data.frequentTopics.slice(0, 4).map((topic) => (
                  <li key={topic.subject} className="rounded-xl bg-white/80 px-2 py-1.5">
                    <p className="font-semibold">{topic.subject}</p>
                    <p className="line-clamp-2 text-[11px] text-on-surface-variant">
                      {topic.sampleReply}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
            <button
              type="button"
              className="lux-button text-[11px]"
              onClick={() => void load(true)}
              disabled={loading}
            >
              {loading ? "מרענן…" : "רענון + למידה מפניות שנסגרו"}
            </button>
          </div>
        ) : null}
      </div>
    </details>
  );
}

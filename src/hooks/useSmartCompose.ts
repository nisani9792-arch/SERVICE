"use client";

import { useCallback, useEffect, useState } from "react";
import { runAgentCommand } from "@/lib/firebase";
import { useReplySuggestions, type ReplySuggestion } from "@/hooks/useReplySuggestions";

export type SmartComposeChip = {
  id: string;
  label: string;
  body: string;
  source: "ai" | "history" | "template";
};

function draftFromAgent(data: Record<string, unknown> | undefined): string | null {
  const draft = data?.draft as { body?: string } | undefined;
  if (draft?.body?.trim()) return draft.body.trim();
  const suggestions = data?.suggestions as Array<{ replyText?: string }> | undefined;
  const first = suggestions?.[0]?.replyText?.trim();
  return first || null;
}

export function useSmartCompose(ticketId: string | null) {
  const { suggestions, loading: historyLoading } = useReplySuggestions(ticketId);
  const [chips, setChips] = useState<SmartComposeChip[]>([]);
  const [loadingAi, setLoadingAi] = useState(false);

  const buildHistoryChips = useCallback((items: ReplySuggestion[]): SmartComposeChip[] => {
    return items.slice(0, 3).map((item) => ({
      id: `hist-${item.id}`,
      label: item.recurring ? "מענה חוזר" : item.matchReason.slice(0, 28) || "מהידע",
      body: item.replyText,
      source: "history" as const
    }));
  }, []);

  useEffect(() => {
    if (!ticketId) {
      setChips([]);
      return;
    }
    setChips(buildHistoryChips(suggestions));
  }, [ticketId, suggestions, buildHistoryChips]);

  const fetchAiDraft = useCallback(async () => {
    if (!ticketId) return;
    setLoadingAi(true);
    try {
      const result = await runAgentCommand("טיוטת מענה", [ticketId]);
      const draftAction = result.actions.find((a) => a.agent === "draft_reply" && a.ok);
      const body = draftFromAgent(draftAction?.data);
      if (!body) return;
      setChips((prev) => {
        const without = prev.filter((c) => c.id !== "ai-primary");
        return [
          {
            id: "ai-primary",
            label: "Smart Compose",
            body,
            source: "ai"
          },
          ...without
        ];
      });
    } catch {
      /* optional AI */
    } finally {
      setLoadingAi(false);
    }
  }, [ticketId]);

  useEffect(() => {
    if (!ticketId) return;
    void fetchAiDraft();
  }, [ticketId, fetchAiDraft]);

  return {
    chips,
    loading: historyLoading || loadingAi,
    refreshAiDraft: fetchAiDraft
  };
}

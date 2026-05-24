"use client";

import { useEffect, useState } from "react";

export type ReplySuggestion = {
  id: string;
  subject: string;
  inquirySnippet: string;
  replyText: string;
  matchReason: string;
  recurring: boolean;
};

export function useReplySuggestions(ticketId: string | null) {
  const [suggestions, setSuggestions] = useState<ReplySuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ticketId) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void fetch(`/api/tickets/${ticketId}/reply-suggestions`, {
      cache: "no-store",
      credentials: "same-origin"
    })
      .then(async (res) => {
        if (!res.ok) return { suggestions: [] as ReplySuggestion[] };
        return res.json() as Promise<{ suggestions: ReplySuggestion[] }>;
      })
      .then((data) => {
        if (!cancelled) setSuggestions(data.suggestions ?? []);
      })
      .catch(() => {
        if (!cancelled) setSuggestions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  const topSuggestion = suggestions[0] ?? null;
  const highConfidence = topSuggestion?.recurring === true;

  return { suggestions, topSuggestion, highConfidence, loading };
}

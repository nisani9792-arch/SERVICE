"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
import { fetchTicketPage } from "@/lib/firebase";
import { displayTicketDate } from "@/lib/ticket-row";
import { CategoryBadge } from "@/components/CategoryBadge";
import type { Ticket } from "@/lib/types";

export function CustomerTimeline({ email }: { email: string }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchTicketPage({ email, pageSize: 100, page: 1 });
      setTickets(res.items);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [email]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          <ArrowRight className="size-4 rotate-180" />
          חזרה ללוח הבקרה
        </Link>

        <header className="lux-card rounded-2xl p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <Mail className="size-6" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                פרופיל לקוח
              </p>
              <h1 className="text-xl font-semibold break-all">{email}</h1>
              <p className="text-sm text-on-surface-variant">
                {loading ? "טוען…" : `${tickets.length} פניות בהיסטוריה`}
              </p>
            </div>
          </div>
        </header>

        <ol className="relative space-y-4 border-s-2 border-outline/80 ps-6">
          {loading ? (
            <li className="text-on-surface-variant">טוען ציר זמן…</li>
          ) : tickets.length === 0 ? (
            <li className="text-on-surface-variant">לא נמצאו פניות עבור כתובת זו.</li>
          ) : (
            tickets.map((t) => {
              const when = displayTicketDate(t).toLocaleString("he-IL", {
                dateStyle: "medium",
                timeStyle: "short"
              });
              return (
                <li key={t.id} className="relative">
                  <span className="absolute -start-[31px] top-2 size-3 rounded-full border-2 border-primary bg-surface-high" />
                  <div className="lux-card rounded-2xl p-4">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-on-surface-variant">{when}</span>
                      <CategoryBadge category={t.category} />
                    </div>
                    <p className="font-semibold">{t.subject}</p>
                    <p className="mt-2 text-sm text-on-surface-variant line-clamp-4">
                      {t.aiSummary || t.body}
                    </p>
                    {t.tags.length > 0 ? (
                      <p className="mt-2 text-xs text-on-surface-variant">
                        תגיות: {t.tags.join(", ")}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })
          )}
        </ol>
      </div>
    </main>
  );
}

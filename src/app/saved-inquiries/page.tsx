"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Save, Trash2 } from "lucide-react";
import {
  deleteSavedInquiry,
  fetchSavedInquiries,
  updateSavedInquiry
} from "@/lib/firebase";
import type { SavedInquiry, SavedInquiryStatus } from "@/lib/types";

const STATUS_LABELS: Record<SavedInquiryStatus, string> = {
  open: "לביצוע",
  in_progress: "בעבודה",
  done: "בוצע"
};

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export default function SavedInquiriesPage() {
  const [items, setItems] = useState<SavedInquiry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const totalOpen = useMemo(
    () => items.filter((item) => item.status !== "done").length,
    [items]
  );

  const refresh = async () => {
    setIsLoading(true);
    try {
      setItems(await fetchSavedInquiries());
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const updateItem = async (id: string, input: Partial<SavedInquiry>) => {
    setSavingId(id);
    try {
      await updateSavedInquiry(id, input);
      await refresh();
    } finally {
      setSavingId(null);
    }
  };

  const removeItem = async (id: string) => {
    if (!window.confirm("למחוק את הפריט מהרשימה?")) return;
    await deleteSavedInquiry(id);
    await refresh();
  };

  const downloadCsv = () => {
    const rows = [
      ["סטטוס", "כותרת", "תוכן", "הערה", "אימייל מקור", "תאריך"],
      ...items.map((item) => [
        STATUS_LABELS[item.status],
        item.title,
        item.content,
        item.note,
        item.sourceEmail,
        new Date(item.createdAt).toLocaleString("he-IL")
      ])
    ];
    const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `jusic-saved-inquiries-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen px-3 py-3 text-[13px] text-on-surface sm:px-4" dir="rtl">
      <div className="mx-auto max-w-6xl space-y-3">
        <header className="lux-card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-3">
          <div>
            <p className="text-[11px] font-semibold text-primary">Jusic CRM</p>
            <h1 className="text-xl font-black">פניות שמורות לביצוע ותובנות</h1>
            <p className="text-xs text-on-surface-variant">
              {items.length.toLocaleString("he-IL")} פריטים · {totalOpen.toLocaleString("he-IL")} פתוחים
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={downloadCsv} className="lux-button">
              <Download className="size-4" />
              הורדת רשימה
            </button>
            <Link href="/" className="lux-button-primary">
              חזרה לשולחן העבודה
            </Link>
          </div>
        </header>

        {isLoading ? (
          <div className="lux-card rounded-2xl p-8 text-center text-on-surface-variant">
            טוען רשימה…
          </div>
        ) : items.length === 0 ? (
          <div className="lux-card rounded-2xl p-8 text-center text-on-surface-variant">
            עדיין אין פניות שמורות. מתוך פנייה לחץ “שמירת הפנייה”.
          </div>
        ) : (
          <section className="grid gap-2 md:grid-cols-2">
            {items.map((item) => (
              <article key={item.id} className="lux-card rounded-2xl p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <select
                    className="rounded-full border border-outline bg-white px-3 py-1 text-xs font-semibold"
                    value={item.status}
                    onChange={(event) =>
                      void updateItem(item.id, {
                        status: event.target.value as SavedInquiryStatus
                      })
                    }
                  >
                    <option value="open">לביצוע</option>
                    <option value="in_progress">בעבודה</option>
                    <option value="done">בוצע</option>
                  </select>
                  <span className="text-[11px] text-on-surface-variant">
                    {new Date(item.createdAt).toLocaleString("he-IL")}
                  </span>
                </div>

                <label className="block text-[11px] font-semibold text-on-surface-variant">
                  נושא
                  <input
                    className="mt-1 w-full rounded-xl border border-outline bg-white px-3 py-2 text-sm font-bold outline-none focus:border-primary"
                    value={item.title}
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((candidate) =>
                          candidate.id === item.id
                            ? { ...candidate, title: event.target.value }
                            : candidate
                        )
                      )
                    }
                  />
                </label>

                <label className="mt-2 block text-[11px] font-semibold text-on-surface-variant">
                  הטקסט המרכזי
                  <textarea
                    className="mt-1 h-28 w-full resize-none rounded-xl border border-outline bg-white px-3 py-2 text-sm outline-none focus:border-primary"
                    value={item.content}
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((candidate) =>
                          candidate.id === item.id
                            ? { ...candidate, content: event.target.value }
                            : candidate
                        )
                      )
                    }
                  />
                </label>

                <label className="mt-2 block text-[11px] font-semibold text-on-surface-variant">
                  הערה / תובנה
                  <textarea
                    className="mt-1 h-20 w-full resize-none rounded-xl border border-outline bg-white px-3 py-2 text-sm outline-none focus:border-primary"
                    value={item.note}
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((candidate) =>
                          candidate.id === item.id
                            ? { ...candidate, note: event.target.value }
                            : candidate
                        )
                      )
                    }
                  />
                </label>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] text-on-surface-variant">
                    מקור: {item.sourceEmail || "לא ידוע"}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="lux-button"
                      disabled={savingId === item.id}
                      onClick={() =>
                        void updateItem(item.id, {
                          title: item.title,
                          content: item.content,
                          note: item.note,
                          status: item.status
                        })
                      }
                    >
                      <Save className="size-4" />
                      {savingId === item.id ? "שומר..." : "שמירה"}
                    </button>
                    <button
                      type="button"
                      className="lux-button text-danger"
                      onClick={() => void removeItem(item.id)}
                    >
                      <Trash2 className="size-4" />
                      מחיקה
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

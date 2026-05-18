"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Download, FileText, Trash2 } from "lucide-react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  deleteSavedInquiry,
  fetchSavedInquiries,
  updateSavedInquiry
} from "@/lib/firebase";
import {
  downloadAllSavedInquiriesAsFile,
  downloadSavedInquiryAsFile
} from "@/lib/saved-inquiry-document";
import type { SavedInquiry, SavedInquiryStatus } from "@/lib/types";

const STATUS_LABELS: Record<SavedInquiryStatus, string> = {
  open: "לביצוע",
  in_progress: "בעבודה",
  done: "בוצע"
};

type Draft = {
  content: string;
  note: string;
  status: SavedInquiryStatus;
};

type SaveState = "idle" | "pending" | "saving" | "saved" | "error";

export default function SavedInquiriesPage() {
  const [items, setItems] = useState<SavedInquiry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const skipAutosaveRef = useRef(false);
  const loadedDocIdRef = useRef<string | null>(null);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId]
  );

  const totalOpen = useMemo(
    () => items.filter((item) => item.status !== "done").length,
    [items]
  );

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const next = await fetchSavedInquiries();
      setItems(next);
      if (next.length === 0) {
        setSelectedId(null);
        setDraft(null);
        return;
      }
      setSelectedId((current) => {
        if (current && next.some((item) => item.id === current)) return current;
        return next[0]?.id ?? null;
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!selectedId) {
      setDraft(null);
      loadedDocIdRef.current = null;
      return;
    }
    if (loadedDocIdRef.current === selectedId) return;

    const item = items.find((candidate) => candidate.id === selectedId);
    if (!item) return;

    loadedDocIdRef.current = selectedId;
    skipAutosaveRef.current = true;
    setDraft({
      content: item.content,
      note: item.note,
      status: item.status
    });
    setSaveState("idle");
    const timer = window.setTimeout(() => {
      skipAutosaveRef.current = false;
    }, 0);
    return () => clearTimeout(timer);
  }, [selectedId, items]);

  const debouncedDraft = useDebouncedValue(draft, 650);

  const persistDraft = useCallback(
    async (id: string, payload: Draft) => {
      setSaveState("saving");
      try {
        await updateSavedInquiry(id, {
          content: payload.content,
          note: payload.note,
          status: payload.status
        });
        setItems((current) =>
          current.map((item) =>
            item.id === id
              ? {
                  ...item,
                  content: payload.content,
                  note: payload.note,
                  status: payload.status,
                  updatedAt: new Date().toISOString()
                }
              : item
          )
        );
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    },
    []
  );

  useEffect(() => {
    if (!selectedId || !debouncedDraft || skipAutosaveRef.current) return;
    const item = items.find((candidate) => candidate.id === selectedId);
    if (!item) return;

    const unchanged =
      item.content === debouncedDraft.content &&
      item.note === debouncedDraft.note &&
      item.status === debouncedDraft.status;
    if (unchanged) {
      setSaveState("idle");
      return;
    }

    void persistDraft(selectedId, debouncedDraft);
  }, [debouncedDraft, selectedId, items, persistDraft]);

  const removeItem = async (id: string) => {
    if (!window.confirm("למחוק את המסמך מהרשימה?")) return;
    await deleteSavedInquiry(id);
    await refresh();
  };

  const saveLabel =
    saveState === "saving"
      ? "שומר…"
      : saveState === "saved"
        ? "נשמר"
        : saveState === "error"
          ? "שגיאת שמירה"
          : saveState === "pending"
            ? "יש שינויים…"
            : "";

  return (
    <main className="min-h-screen bg-surface-container/40 text-[13px] text-on-surface" dir="rtl">
      <div className="mx-auto flex min-h-screen max-w-[96rem] flex-col">
        <header className="shrink-0 border-b border-outline/60 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold text-primary">Jusic CRM</p>
              <h1 className="text-xl font-black">פניות שמורות — מסמכים לעריכה</h1>
              <p className="text-xs text-on-surface-variant">
                {items.length.toLocaleString("he-IL")} מסמכים · {totalOpen.toLocaleString("he-IL")} פתוחים
                {saveLabel ? ` · ${saveLabel}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={items.length === 0}
                onClick={() => downloadAllSavedInquiriesAsFile(items)}
                className="lux-button"
              >
                <Download className="size-4" />
                הורדת כל המסמכים
              </button>
              <Link href="/" className="lux-button-primary">
                חזרה לשולחן העבודה
              </Link>
            </div>
          </div>
        </header>

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center p-12 text-on-surface-variant">
            טוען מסמכים…
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-12">
            <div className="max-w-md rounded-2xl border border-outline/70 bg-white p-8 text-center shadow-sm">
              <FileText className="mx-auto mb-3 size-10 text-primary/60" />
              <p className="font-semibold">עדיין אין פניות שמורות</p>
              <p className="mt-1 text-sm text-on-surface-variant">
                מתוך פנייה בשולחן העבודה לחץ &quot;שמירת הפנייה&quot; — יישמרו נושא, מייל וטקסט הפנייה במסמך
                אחד.
              </p>
              <Link href="/" className="lux-button-primary mt-4 inline-flex">
                לשולחן העבודה
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            <aside className="shrink-0 border-b border-outline/60 bg-white/90 lg:w-72 lg:border-b-0 lg:border-l">
              <p className="px-3 py-2 text-[11px] font-bold text-on-surface-variant">רשימת מסמכים</p>
              <ul className="max-h-48 overflow-y-auto lg:max-h-[calc(100vh-5.5rem)]">
                {items.map((item) => {
                  const active = item.id === selectedId;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        className={`w-full border-b border-outline/40 px-3 py-2.5 text-right transition ${
                          active ? "bg-primary-soft/50" : "hover:bg-surface-container/80"
                        }`}
                      >
                        <p className="line-clamp-2 text-sm font-bold leading-snug">{item.title}</p>
                        <p className="mt-0.5 text-[10px] text-on-surface-variant">
                          {item.sourceEmail || "ללא מייל"} ·{" "}
                          {new Date(item.createdAt).toLocaleDateString("he-IL")}
                        </p>
                        <span className="mt-1 inline-block rounded-full bg-surface-container px-2 py-0.5 text-[10px] font-semibold">
                          {STATUS_LABELS[item.status]}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </aside>

            {selected && draft ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#e8e6e3] p-4 sm:p-8">
                <div className="mx-auto flex w-full max-w-[210mm] flex-col gap-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-outline/50 bg-white/90 px-3 py-2 shadow-sm">
                    <select
                      className="rounded-lg border border-outline bg-white px-3 py-1.5 text-xs font-semibold"
                      value={draft.status}
                      onChange={(event) => {
                        setSaveState("pending");
                        setDraft((current) =>
                          current
                            ? { ...current, status: event.target.value as SavedInquiryStatus }
                            : current
                        );
                      }}
                    >
                      <option value="open">לביצוע</option>
                      <option value="in_progress">בעבודה</option>
                      <option value="done">בוצע</option>
                    </select>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="lux-button text-xs"
                        onClick={() =>
                          downloadSavedInquiryAsFile({
                            ...selected,
                            content: draft.content,
                            note: draft.note,
                            status: draft.status
                          })
                        }
                      >
                        <Download className="size-3.5" />
                        הורדת מסמך
                      </button>
                      <button
                        type="button"
                        className="lux-button text-xs text-danger"
                        onClick={() => void removeItem(selected.id)}
                      >
                        <Trash2 className="size-3.5" />
                        מחיקה
                      </button>
                    </div>
                  </div>

                  <article className="min-h-[70vh] rounded-sm border border-outline/30 bg-white px-8 py-10 shadow-[0_2px_24px_rgba(0,0,0,0.12)] sm:px-12 sm:py-14">
                    <header className="mb-8 border-b border-outline/40 pb-4">
                      <h2 className="font-serif text-2xl font-bold leading-tight text-on-surface">
                        {selected.title}
                      </h2>
                      <p className="mt-2 text-xs text-on-surface-variant">
                        נשמר: {new Date(selected.createdAt).toLocaleString("he-IL")}
                        {selected.sourceEmail ? ` · ${selected.sourceEmail}` : ""}
                      </p>
                    </header>

                    <label className="block">
                      <span className="sr-only">תוכן המסמך</span>
                      <textarea
                        className="min-h-[320px] w-full resize-y border-0 bg-transparent font-serif text-[15px] leading-[1.85] text-on-surface outline-none focus:ring-0"
                        value={draft.content}
                        spellCheck
                        onChange={(event) => {
                          setSaveState("pending");
                          setDraft((current) =>
                            current ? { ...current, content: event.target.value } : current
                          );
                        }}
                        placeholder="כתובת מייל, נושא וטקסט הפנייה…"
                      />
                    </label>

                    <section className="mt-10 border-t border-dashed border-outline/50 pt-8">
                      <h3 className="mb-3 font-serif text-lg font-bold text-on-surface">תובנות ידניות</h3>
                      <textarea
                        className="min-h-[140px] w-full resize-y rounded-lg border border-outline/40 bg-surface-container/30 px-4 py-3 font-serif text-[14px] leading-relaxed outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                        value={draft.note}
                        placeholder="הוסף כאן תובנות, המשך טיפול, החלטות…"
                        onChange={(event) => {
                          setSaveState("pending");
                          setDraft((current) =>
                            current ? { ...current, note: event.target.value } : current
                          );
                        }}
                      />
                    </section>
                  </article>

                  <p className="text-center text-[11px] text-on-surface-variant">
                    השינויים נשמרים אוטומטית בזמן העריכה
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}

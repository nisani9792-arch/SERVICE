"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ClipboardCopy, Plus, Trash2, X } from "lucide-react";
import type { ReplyTemplate } from "@/lib/types";

interface ReplyTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert?: (text: string) => void;
}

export function ReplyTemplatesModal({ isOpen, onClose, onInsert }: ReplyTemplatesModalProps) {
  const [items, setItems] = useState<ReplyTemplate[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [shortcut, setShortcut] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reply-templates", { cache: "no-store" });
      if (!res.ok) throw new Error("failed");
      const data = (await res.json()) as { items: ReplyTemplate[] };
      setItems(data.items);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) void load();
  }, [isOpen, load]);

  if (!isOpen) return null;

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!body.trim()) return;
    await fetch("/api/reply-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, shortcut })
    });
    setTitle("");
    setBody("");
    setShortcut("");
    await load();
  };

  const onDelete = async (id: string) => {
    if (!window.confirm("למחוק תבנית זו?")) return;
    await fetch(`/api/reply-templates?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await load();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div className="lux-card flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">תבניות תשובה מהירה</h2>
          <button type="button" onClick={onClose} className="lux-button p-2">
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={onCreate} className="mb-4 space-y-2 rounded-2xl border border-outline/70 bg-surface-container/50 p-3">
          <input
            className="w-full rounded-xl border border-outline bg-white px-3 py-2 text-sm"
            placeholder="כותרת"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            className="w-full rounded-xl border border-outline bg-white px-3 py-2 text-sm"
            placeholder="קיצור (אופציונלי)"
            value={shortcut}
            onChange={(e) => setShortcut(e.target.value)}
          />
          <textarea
            className="h-24 w-full resize-none rounded-xl border border-outline bg-white px-3 py-2 text-sm"
            placeholder="טקסט התבנית"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
          />
          <button type="submit" className="lux-button-primary inline-flex items-center gap-1 text-sm">
            <Plus className="size-4" />
            שמור תבנית
          </button>
        </form>

        <div className="min-h-0 flex-1 overflow-y-auto space-y-2">
          {loading ? (
            <p className="text-sm text-on-surface-variant">טוען…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-on-surface-variant">אין תבניות עדיין</p>
          ) : (
            items.map((tpl) => (
              <div
                key={tpl.id}
                className="flex flex-col gap-2 rounded-2xl border border-outline/60 bg-white/90 p-3 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{tpl.title || "ללא כותרת"}</p>
                    {tpl.shortcut ? (
                      <p className="text-xs text-on-surface-variant">/{tpl.shortcut}</p>
                    ) : null}
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="md3-icon-btn"
                      title="העתק"
                      onClick={() => {
                        void navigator.clipboard.writeText(tpl.body);
                      }}
                    >
                      <ClipboardCopy className="size-4" />
                    </button>
                    {onInsert ? (
                      <button
                        type="button"
                        className="md3-toolbar-btn px-2 py-1 text-[11px]"
                        onClick={() => onInsert(tpl.body)}
                      >
                        הדבק
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="md3-icon-btn text-danger"
                      title="מחק"
                      onClick={() => void onDelete(tpl.id)}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-xs text-on-surface-variant">{tpl.body}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

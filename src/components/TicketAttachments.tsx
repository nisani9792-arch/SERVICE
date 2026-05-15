"use client";

import { useEffect, useState } from "react";
import { Film, ImageIcon, Paperclip } from "lucide-react";
import type { TicketAttachmentMeta } from "@/lib/types";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface TicketAttachmentsProps {
  ticketId: string;
}

export function TicketAttachments({ ticketId }: TicketAttachmentsProps) {
  const [items, setItems] = useState<TicketAttachmentMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void (async () => {
      try {
        const res = await fetch(`/api/tickets/${ticketId}/attachments`, { cache: "no-store" });
        if (!res.ok) {
          throw new Error("Failed to load attachments");
        }
        const data = (await res.json()) as { items: TicketAttachmentMeta[] };
        if (!cancelled) {
          setItems(data.items ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "שגיאה בטעינת קבצים");
          setItems([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  if (isLoading) {
    return <p className="mt-2 text-[11px] text-on-surface-variant">טוען קבצים מצורפים…</p>;
  }

  if (error) return null;
  if (items.length === 0) return null;

  const images = items.filter((item) => item.contentType.startsWith("image/"));
  const videos = items.filter((item) => item.contentType.startsWith("video/"));

  return (
    <section className="mt-3 rounded-xl border border-outline/70 bg-surface-container/50 p-3">
      <h3 className="mb-2 inline-flex items-center gap-1 text-xs font-bold text-on-surface">
        <Paperclip className="size-3.5" />
        קבצים מצורפים ({items.length})
      </h3>

      {images.length > 0 ? (
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {images.map((item) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group overflow-hidden rounded-lg border border-outline/70 bg-white"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt={item.filename}
                className="aspect-video w-full object-cover transition group-hover:opacity-90"
                loading="lazy"
              />
              <p className="truncate px-2 py-1 text-[10px] text-on-surface-variant">
                <ImageIcon className="mr-0.5 inline size-3" />
                {item.filename} · {formatSize(item.sizeBytes)}
              </p>
            </a>
          ))}
        </div>
      ) : null}

      {videos.length > 0 ? (
        <div className="space-y-2">
          {videos.map((item) => (
            <div key={item.id} className="overflow-hidden rounded-lg border border-outline/70 bg-white">
              <video src={item.url} controls preload="metadata" className="max-h-64 w-full bg-black" />
              <p className="truncate px-2 py-1 text-[10px] text-on-surface-variant">
                <Film className="mr-0.5 inline size-3" />
                {item.filename} · {formatSize(item.sizeBytes)}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

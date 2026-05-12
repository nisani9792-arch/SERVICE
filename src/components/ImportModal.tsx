"use client";

import Papa from "papaparse";
import { ChangeEvent, useMemo, useState } from "react";
import { UploadCloud, X } from "lucide-react";
import { createTicketsBulk } from "@/lib/firebase";
import { ClassifiedImportRecord, ImportRecordInput } from "@/lib/types";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const normalizeRecord = (raw: Record<string, unknown>): ImportRecordInput => {
  return {
    senderEmail: String(raw.senderEmail ?? raw.email ?? "").trim(),
    senderName: String(raw.senderName ?? raw.name ?? "").trim(),
    subject: String(raw.subject ?? raw.title ?? "").trim(),
    body: String(raw.body ?? raw.content ?? raw.message ?? "").trim()
  };
};

const parseCsv = async (file: File): Promise<ImportRecordInput[]> => {
  const text = await file.text();
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => resolve(result.data.map(normalizeRecord)),
      error: () => reject(new Error("CSV parsing failed"))
    });
  });
};

const parseJson = async (file: File): Promise<ImportRecordInput[]> => {
  const text = await file.text();
  const parsed = JSON.parse(text);
  if (Array.isArray(parsed)) {
    return parsed.map((item) =>
      normalizeRecord((item as Record<string, unknown>) ?? {})
    );
  }
  if (typeof parsed === "object" && parsed !== null && Array.isArray(parsed.records)) {
    return parsed.records.map((item: Record<string, unknown>) => normalizeRecord(item));
  }
  throw new Error("JSON format is not supported");
};

export function ImportModal({ isOpen, onClose }: ImportModalProps) {
  const [records, setRecords] = useState<ImportRecordInput[]>([]);
  const [fileName, setFileName] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [chunkSize, setChunkSize] = useState(30);
  const validRecords = useMemo(
    () =>
      records.filter(
        (record) => record.senderEmail && record.subject && record.body
      ),
    [records]
  );

  if (!isOpen) {
    return null;
  }

  const reset = () => {
    setRecords([]);
    setFileName("");
    setError("");
    setIsImporting(false);
    setProgress({ current: 0, total: 0 });
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) {
      return;
    }
    setError("");
    setFileName(selected.name);

    try {
      const parsed = selected.name.toLowerCase().endsWith(".csv")
        ? await parseCsv(selected)
        : await parseJson(selected);
      setRecords(parsed);
    } catch {
      setError("קריאת הקובץ נכשלה. ודא שמדובר ב-CSV/JSON תקין.");
      setRecords([]);
    }
  };

  const onImport = async () => {
    if (validRecords.length === 0) {
      setError("לא נמצאו רשומות תקינות לייבוא.");
      return;
    }

    setError("");
    setIsImporting(true);
    setProgress({ current: 0, total: validRecords.length });

    try {
      for (let offset = 0; offset < validRecords.length; offset += chunkSize) {
        const chunk = validRecords.slice(offset, offset + chunkSize);
        const classifyResponse = await fetch("/api/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ records: chunk })
        });

        if (!classifyResponse.ok) {
          throw new Error("Import API failed");
        }

        const payload = (await classifyResponse.json()) as {
          records: ClassifiedImportRecord[];
        };

        await createTicketsBulk(payload.records);
        setProgress({
          current: Math.min(offset + chunk.length, validRecords.length),
          total: validRecords.length
        });
      }

      handleClose();
    } catch {
      setError("תהליך הייבוא נכשל. נסה שוב בעוד רגע.");
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div className="lux-card w-full max-w-xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">ייבוא פניות</h2>
          <button onClick={handleClose} className="lux-button p-2">
            <X className="size-4" />
          </button>
        </div>

        <label className="mb-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-outline bg-surface-container px-4 py-8 text-center">
          <UploadCloud className="size-7 text-on-surface-variant" />
          <span className="text-sm">בחר קובץ CSV או JSON לייבוא</span>
          <span className="text-xs text-on-surface-variant">{fileName || "לא נבחר קובץ"}</span>
          <input
            type="file"
            accept=".csv,.json,application/json,text/csv"
            className="hidden"
            onChange={onFileChange}
          />
        </label>

        <p className="mb-2 text-sm text-on-surface-variant">
          רשומות תקינות: {validRecords.length}
        </p>

        <div className="mb-3">
          <label className="mb-1 block text-xs text-on-surface-variant">
            גודל באצ&apos; ייבוא
          </label>
          <select
            className="w-full rounded-lg border border-outline bg-white px-3 py-2 text-sm outline-none focus:border-primary"
            value={chunkSize}
            onChange={(event) => setChunkSize(Number(event.target.value))}
            disabled={isImporting}
          >
            {[10, 20, 30, 50, 100].map((value) => (
              <option key={value} value={value}>
                {value} רשומות בכל באצ&apos;
              </option>
            ))}
          </select>
        </div>

        {progress.total > 0 ? (
          <div className="mb-3">
            <div className="mb-1 h-2 w-full overflow-hidden rounded-full bg-surface-container">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
            <p className="text-xs text-on-surface-variant">
              {progress.current}/{progress.total} הושלמו
            </p>
          </div>
        ) : null}

        {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <button onClick={handleClose} className="lux-button" disabled={isImporting}>
            סגור
          </button>
          <button
            onClick={onImport}
            className="lux-button-primary"
            disabled={isImporting || validRecords.length === 0}
          >
            {isImporting ? "מייבא..." : "התחל ייבוא"}
          </button>
        </div>
      </div>
    </div>
  );
}

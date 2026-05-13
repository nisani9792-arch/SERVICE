"use client";

import Papa from "papaparse";
import { ChangeEvent, useMemo, useState } from "react";
import { UploadCloud, X } from "lucide-react";
import { createTicketsBulk, importHistoricalRecords } from "@/lib/firebase";
import { isMboxFile, parseMbox } from "@/lib/mbox";
import type { ClassifiedImportRecord, HistoricalTicketJson, ImportRecordInput } from "@/lib/types";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const normalizeRecord = (raw: Record<string, unknown>): ImportRecordInput => {
  return {
    senderEmail: String(raw.senderEmail ?? raw.email ?? raw.from ?? "").trim(),
    senderName: String(raw.senderName ?? raw.name ?? raw.sender_name ?? raw.fromName ?? "").trim(),
    subject: String(raw.subject ?? raw.title ?? "").trim(),
    body: String(raw.body ?? raw.content ?? raw.message ?? raw.text ?? raw.summary ?? "").trim()
  };
};

const isHistoricalRow = (raw: Record<string, unknown>) => {
  const email = String(raw.email ?? "").trim();
  const hasHistoricalKeys =
    "sender_name" in raw || ("summary" in raw && !("body" in raw && String(raw.body ?? "").trim()));
  return Boolean(email && hasHistoricalKeys);
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

const parseJson = async (
  file: File
): Promise<{ mode: "classic" | "historical"; classic: ImportRecordInput[]; historical: HistoricalTicketJson[] }> => {
  const text = await file.text();
  const parsed = JSON.parse(text);
  let rows: Record<string, unknown>[] = [];
  if (Array.isArray(parsed)) {
    rows = parsed as Record<string, unknown>[];
  } else if (
    typeof parsed === "object" &&
    parsed !== null &&
    Array.isArray((parsed as { records?: unknown }).records)
  ) {
    rows = (parsed as { records: Record<string, unknown>[] }).records;
  } else {
    throw new Error("JSON format is not supported");
  }

  if (rows.length > 0 && rows.every((item) => isHistoricalRow(item))) {
    const historical: HistoricalTicketJson[] = rows.map((item) => ({
      date: item.date != null ? String(item.date) : undefined,
      sender_name: item.sender_name != null ? String(item.sender_name) : undefined,
      email: String(item.email ?? "").trim(),
      subject: item.subject != null ? String(item.subject) : undefined,
      summary: item.summary != null ? String(item.summary) : undefined,
      category: item.category != null ? String(item.category) : undefined
    }));
    return { mode: "historical", classic: [], historical };
  }

  return { mode: "classic", classic: rows.map((item) => normalizeRecord(item)), historical: [] };
};

const truncateBody = (text: string, max = 12000): string => {
  if (text.length <= max) return text;
  return text.slice(0, max) + "\n\n[... התוכן קוצר אוטומטית בעת ייבוא ...]";
};

export function ImportModal({ isOpen, onClose }: ImportModalProps) {
  const [classicRecords, setClassicRecords] = useState<ImportRecordInput[]>([]);
  const [historicalRecords, setHistoricalRecords] = useState<HistoricalTicketJson[]>([]);
  const [importMode, setImportMode] = useState<"classic" | "historical">("classic");
  const [fileName, setFileName] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parseStatus, setParseStatus] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [chunkSize, setChunkSize] = useState(30);
  const [recipientFilter, setRecipientFilter] = useState("");
  const [excludeSender, setExcludeSender] = useState("");
  const [skipClassification, setSkipClassification] = useState(false);

  const validClassic = useMemo(
    () =>
      classicRecords.filter(
        (record) => record.senderEmail && record.subject && record.body
      ),
    [classicRecords]
  );

  const validHistorical = useMemo(
    () =>
      historicalRecords.filter((r) => {
        const sub = String(r.subject ?? "").trim();
        return Boolean(r.email && sub);
      }),
    [historicalRecords]
  );

  if (!isOpen) {
    return null;
  }

  const reset = () => {
    setClassicRecords([]);
    setHistoricalRecords([]);
    setImportMode("classic");
    setFileName("");
    setError("");
    setIsImporting(false);
    setIsParsing(false);
    setParseStatus("");
    setProgress({ current: 0, total: 0 });
  };

  const handleClose = () => {
    if (isImporting || isParsing) return;
    reset();
    onClose();
  };

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected) {
      return;
    }
    setError("");
    setFileName(selected.name);
    setClassicRecords([]);
    setHistoricalRecords([]);
    setImportMode("classic");
    setIsParsing(true);
    setParseStatus("קורא קובץ...");

    try {
      if (selected.name.toLowerCase().endsWith(".csv")) {
        const parsed = await parseCsv(selected);
        setClassicRecords(parsed);
        setImportMode("classic");
        setParseStatus(`נมצאו ${parsed.length.toLocaleString("he-IL")} רשומות בקובץ.`);
      } else if (isMboxFile(selected)) {
        setParseStatus("מנתח קובץ MBOX של Google Takeout...");
        const text = await selected.text();
        const messages = await parseMbox(text, {
          filterRecipient: recipientFilter || undefined,
          excludeSender: excludeSender || undefined,
          onProgress: (count) =>
            setParseStatus(`נותחו ${count.toLocaleString("he-IL")} הודעות...`)
        });
        const parsed = messages.map((m) => ({
          senderEmail: m.senderEmail,
          senderName: m.senderName,
          subject: m.subject || "(ללא נושא)",
          body: truncateBody(m.body || m.subject || "")
        }));
        setClassicRecords(parsed);
        setImportMode("classic");
        setParseStatus(`נמצאו ${parsed.length.toLocaleString("he-IL")} רשומות בקובץ.`);
      } else {
        const parsed = await parseJson(selected);
        if (parsed.mode === "historical") {
          setHistoricalRecords(parsed.historical);
          setImportMode("historical");
          setParseStatus(
            `זוהה ייבוא היסטורי: ${parsed.historical.length.toLocaleString("he-IL")} רשומות (ללא AI).`
          );
        } else {
          setClassicRecords(parsed.classic);
          setImportMode("classic");
          setParseStatus(`נמצאו ${parsed.classic.length.toLocaleString("he-IL")} רשומות בקובץ.`);
        }
      }
    } catch (parseError) {
      const message =
        parseError instanceof Error ? parseError.message : "Unknown error";
      setError(
        `קריאת הקובץ נכשלה: ${message}. ודא שמדובר ב-CSV, JSON או MBOX (Google Takeout) תקין.`
      );
      setClassicRecords([]);
      setHistoricalRecords([]);
      setParseStatus("");
    } finally {
      setIsParsing(false);
    }
  };

  const onImport = async () => {
    if (importMode === "historical") {
      if (validHistorical.length === 0) {
        setError("לא נמצאו רשומות תקינות לייבוא היסטורי.");
        return;
      }
      setError("");
      setIsImporting(true);
      setProgress({ current: 0, total: validHistorical.length });
      try {
        await importHistoricalRecords(validHistorical, 400, (done, total) =>
          setProgress({ current: done, total })
        );
        handleClose();
      } catch (importError) {
        const message =
          importError instanceof Error ? importError.message : "Unknown error";
        setError(`תהליך הייבוא נכשל: ${message}. נסה שוב בעוד רגע.`);
        setIsImporting(false);
      }
      return;
    }

    if (validClassic.length === 0) {
      setError("לא נמצאו רשומות תקינות לייבוא.");
      return;
    }

    setError("");
    setIsImporting(true);
    setProgress({ current: 0, total: validClassic.length });

    try {
      for (let offset = 0; offset < validClassic.length; offset += chunkSize) {
        const chunk = validClassic.slice(offset, offset + chunkSize);
        const classifyResponse = await fetch("/api/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            records: chunk,
            skipClassification
          })
        });

        if (!classifyResponse.ok) {
          throw new Error(`Import API failed (${classifyResponse.status})`);
        }

        const payload = (await classifyResponse.json()) as {
          records: ClassifiedImportRecord[];
        };

        await createTicketsBulk(payload.records);
        setProgress({
          current: Math.min(offset + chunk.length, validClassic.length),
          total: validClassic.length
        });
      }

      handleClose();
    } catch (importError) {
      const message =
        importError instanceof Error ? importError.message : "Unknown error";
      setError(`תהליך הייבוא נכשל: ${message}. נסה שוב בעוד רגע.`);
      setIsImporting(false);
    }
  };

  const isBusy = isParsing || isImporting;
  const readyCount = importMode === "historical" ? validHistorical.length : validClassic.length;
  const totalParsed =
    importMode === "historical" ? historicalRecords.length : classicRecords.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div className="lux-card w-full max-w-xl rounded-2xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">ייבוא פניות</h2>
          <button type="button" onClick={handleClose} className="lux-button p-2" disabled={isBusy}>
            <X className="size-4" />
          </button>
        </div>

        <p className="mb-3 text-xs text-on-surface-variant">
          תומך ב-CSV, JSON מובנה היסטורי, JSON קלאסי, וקבצי MBOX מ-Google Takeout. ייבוא היסטורי ללא AI ומהיר
          לכמויות גדולות.
        </p>

        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs text-on-surface-variant">
              סנן רק הודעות לכתובת (אופציונלי)
            </span>
            <input
              type="email"
              placeholder="support@jusic.com"
              value={recipientFilter}
              onChange={(event) => setRecipientFilter(event.target.value)}
              disabled={isBusy}
              className="w-full rounded-xl border border-outline bg-white px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-60"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-on-surface-variant">
              דלג על הודעות מכתובת זו (אופציונלי)
            </span>
            <input
              type="email"
              placeholder="me@jusic.com"
              value={excludeSender}
              onChange={(event) => setExcludeSender(event.target.value)}
              disabled={isBusy}
              className="w-full rounded-xl border border-outline bg-white px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-60"
            />
          </label>
        </div>

        <label className="mb-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-outline bg-surface-container px-4 py-8 text-center">
          <UploadCloud className="size-7 text-on-surface-variant" />
          <span className="text-sm">בחר קובץ CSV, JSON או MBOX לייבוא</span>
          <span className="text-xs text-on-surface-variant">
            {fileName || "לא נבחר קובץ"}
          </span>
          <input
            type="file"
            accept=".csv,.json,.mbox,.mbx,application/json,application/mbox,text/csv,text/plain"
            className="hidden"
            onChange={onFileChange}
            disabled={isBusy}
          />
        </label>

        {parseStatus ? (
          <p className="mb-2 text-xs text-on-surface-variant">{parseStatus}</p>
        ) : null}

        <p className="mb-2 text-sm text-on-surface-variant">
          רשומות תקינות: {readyCount.toLocaleString("he-IL")}
          {totalParsed > 0 && totalParsed !== readyCount
            ? ` (מתוך ${totalParsed.toLocaleString("he-IL")} בקובץ)`
            : null}
        </p>

        {importMode === "classic" ? (
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs text-on-surface-variant">
                גודל באצ&apos; ייבוא
              </span>
              <select
                className="w-full rounded-xl border border-outline bg-white px-3 py-2 text-sm outline-none focus:border-primary"
                value={chunkSize}
                onChange={(event) => setChunkSize(Number(event.target.value))}
                disabled={isBusy}
              >
                {[10, 20, 30, 50, 100].map((value) => (
                  <option key={value} value={value}>
                    {value} רשומות בכל באצ&apos;
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-end gap-2 rounded-xl border border-outline bg-white px-3 py-2 text-xs">
              <input
                type="checkbox"
                checked={skipClassification}
                onChange={(event) => setSkipClassification(event.target.checked)}
                disabled={isBusy}
                className="size-4 cursor-pointer accent-primary"
              />
              <span>ייבוא מהיר ללא AI (לכמויות גדולות)</span>
            </label>
          </div>
        ) : null}

        {progress.total > 0 ? (
          <div className="mb-3">
            <div className="mb-1 h-2 w-full overflow-hidden rounded-full bg-surface-container">
              <div
                className="h-full bg-primary transition-all"
                style={{
                  width: `${(progress.current / progress.total) * 100}%`
                }}
              />
            </div>
            <p className="text-xs text-on-surface-variant">
              {progress.current.toLocaleString("he-IL")}/
              {progress.total.toLocaleString("he-IL")} הושלמו
            </p>
          </div>
        ) : null}

        {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={handleClose} className="lux-button" disabled={isBusy}>
            סגור
          </button>
          <button
            type="button"
            onClick={onImport}
            className="lux-button-primary"
            disabled={isBusy || readyCount === 0}
          >
            {isImporting
              ? "מייבא..."
              : isParsing
                ? "מנתח..."
                : "התחל ייבוא"}
          </button>
        </div>
      </div>
    </div>
  );
}

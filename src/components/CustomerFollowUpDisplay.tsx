import { parseCustomerFollowUpBlocks } from "@/lib/customer-followup-text";

type CustomerFollowUpDisplayProps = {
  body: string;
  variant?: "dark" | "light";
  showHistory?: boolean;
};

export function CustomerFollowUpDisplay({
  body,
  variant = "dark",
  showHistory = false
}: CustomerFollowUpDisplayProps) {
  const blocks = parseCustomerFollowUpBlocks(body);
  if (blocks.length === 0) return null;

  const latest = blocks[blocks.length - 1];
  const isDark = variant === "dark";

  return (
    <div className="space-y-2">
      <div
        className={
          isDark
            ? "rounded-xl border border-amber-400/35 bg-amber-500/10 p-3"
            : "rounded-xl border border-amber-300 bg-amber-50 p-3"
        }
      >
        <p
          className={`mb-1.5 text-[11px] font-bold ${
            isDark ? "text-amber-200" : "text-amber-950"
          }`}
        >
          תשובת לקוח אחרונה
          {latest.when ? ` · ${latest.when}` : ""}
        </p>
        <p
          className={`whitespace-pre-wrap text-sm leading-relaxed ${
            isDark ? "text-amber-50" : "text-on-surface"
          }`}
        >
          {latest.text}
        </p>
      </div>

      {showHistory && blocks.length > 1 ? (
        <details className={isDark ? "text-xs text-white/60" : "text-xs text-on-surface-variant"}>
          <summary className="cursor-pointer font-semibold">
            תשובות לקוח קודמות ({blocks.length - 1})
          </summary>
          <div className="mt-2 space-y-2">
            {blocks.slice(0, -1).map((block, index) => (
              <div
                key={`${block.when}-${index}`}
                className={
                  isDark
                    ? "rounded-lg border border-white/10 bg-black/20 p-2"
                    : "rounded-lg border border-outline/60 bg-white p-2"
                }
              >
                {block.when ? (
                  <p className="mb-1 text-[10px] font-semibold opacity-80">{block.when}</p>
                ) : null}
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{block.text}</p>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

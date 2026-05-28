import { Search } from "lucide-react";
import { cn } from "@/lib/cn";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}

export function SearchBar({ value, onChange, compact }: SearchBarProps) {
  return (
    <label
      className={cn(
        "crm-search flex w-full items-center rounded-lg border border-slate-200 bg-white",
        compact ? "gap-1.5 px-2 py-1" : "gap-3 px-4 py-3"
      )}
    >
      <Search
        className={cn("shrink-0 text-indigo-500/80", compact ? "size-3.5" : "size-[1.125rem]")}
        aria-hidden
      />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "w-full bg-transparent font-medium outline-none placeholder:font-normal placeholder:text-slate-400",
          compact ? "text-[11px]" : "text-sm"
        )}
        placeholder={compact ? "חיפוש…" : "חיפוש: אימייל, נושא, תוכן…"}
        autoComplete="off"
      />
    </label>
  );
}

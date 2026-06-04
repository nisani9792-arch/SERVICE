"use client";

import { useEffect } from "react";
import { Command, Search } from "lucide-react";
import { cn } from "@/lib/cn";

export type GlobalCommandPaletteBindings = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
};

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
  commandPalette?: GlobalCommandPaletteBindings;
}

export function SearchBar({ value, onChange, compact, commandPalette }: SearchBarProps) {
  useEffect(() => {
    if (!commandPalette) return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        commandPalette.onOpenChange(!commandPalette.open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commandPalette]);

  const shellClass = cn(
    "gen-surface flex w-full items-center rounded-xl2 shadow-sm transition",
    compact ? "gap-1.5 px-2 py-1" : "gap-3 px-4 py-3",
    commandPalette && "cursor-pointer hover:shadow-glow-sm"
  );

  const icon = (
    <Search
      className={cn("shrink-0 text-primary/80", compact ? "size-3.5" : "size-[1.125rem]")}
      aria-hidden
    />
  );

  if (commandPalette) {
    return (
      <button
        type="button"
        onClick={() => commandPalette.onOpenChange(true)}
        className={shellClass}
      >
        {icon}
        <span
          className={cn(
            "flex-1 text-start font-medium text-on-surface-variant",
            compact ? "text-[11px]" : "text-sm"
          )}
        >
          {value.trim() ? value : compact ? "חיפוש או פקודה…" : "חיפוש פניות · ⌘K פקודות"}
        </span>
        <kbd
          className={cn(
            "hidden shrink-0 items-center gap-0.5 rounded-md bg-surface-container px-1.5 py-0.5 font-mono font-semibold text-on-surface-variant sm:inline-flex",
            compact ? "text-[8px]" : "text-[9px]"
          )}
        >
          <Command className="size-2.5" aria-hidden />
          K
        </kbd>
      </button>
    );
  }

  return (
    <label className={shellClass}>
      {icon}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "w-full bg-transparent font-medium outline-none placeholder:font-normal placeholder:text-on-surface-variant/70",
          compact ? "text-[11px]" : "text-sm"
        )}
        placeholder={compact ? "חיפוש…" : "חיפוש: אימייל, נושא, תוכן…"}
        autoComplete="off"
      />
    </label>
  );
}

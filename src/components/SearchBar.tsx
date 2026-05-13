import { Search } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <label className="crm-search flex w-full items-center gap-3 px-4 py-3">
      <Search className="size-[1.125rem] shrink-0 text-primary/70" aria-hidden />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-transparent text-sm font-medium outline-none placeholder:font-normal placeholder:text-on-surface-variant"
        placeholder="חיפוש חכם: אימייל, נושא, תוכן או שם פונה…"
        autoComplete="off"
      />
    </label>
  );
}

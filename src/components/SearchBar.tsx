import { Search } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <label className="lux-card flex w-full items-center gap-2 px-3 py-2">
      <Search className="size-4 text-on-surface-variant" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-transparent text-sm outline-none placeholder:text-on-surface-variant"
        placeholder="חיפוש לפי אימייל, נושא או מילת מפתח"
      />
    </label>
  );
}

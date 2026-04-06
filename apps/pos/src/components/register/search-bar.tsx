"use client";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export function SearchBar({ value, onChange }: Props) {
  return (
    <div className="relative">
      <input
        type="text"
        placeholder="Search..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-36 rounded-md border border-border bg-surface-raised pl-7 pr-2 text-[11px] text-text outline-none transition-colors placeholder:text-text-dim focus:w-48 focus:border-brand focus:ring-1 focus:ring-brand"
      />
      <svg className="absolute left-2 top-1.5 h-4 w-4 text-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </div>
  );
}

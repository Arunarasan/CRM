import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronsUpDown, Check, X, Search } from "lucide-react";

export interface Option {
  value: string;
  label: string;
  hint?: string;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  /** Text for the "clear selection" row; omit to hide it (e.g. for required fields). */
  clearLabel?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * A filterable dropdown (combobox) for long option lists — customers, projects, suppliers —
 * where a plain <select> forces the user to scroll through hundreds of rows. Click to open,
 * type to filter, click to pick. Closes on outside click / Escape.
 */
export default function SearchableSelect({
  value, onChange, options, placeholder = "Select…", clearLabel, disabled, className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value) || null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.hint?.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  const pick = (v: string) => { onChange(v); setOpen(false); setQuery(""); };

  return (
    <div ref={rootRef} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm flex items-center justify-between gap-2 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <span className={`truncate text-left ${selected ? "" : "text-muted-foreground"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {selected && clearLabel && (
            <X
              className="h-4 w-4 text-muted-foreground hover:text-foreground"
              onClick={(e) => { e.stopPropagation(); onChange(""); }}
            />
          )}
          <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
        </span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-md border bg-popover shadow-md">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to filter…"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {clearLabel && (
              <button
                type="button"
                onMouseDown={() => pick("")}
                className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
              >
                {clearLabel}
              </button>
            )}
            {filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onMouseDown={() => pick(o.value)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center justify-between gap-2"
              >
                <span className="min-w-0">
                  <span className="block truncate">{o.label}</span>
                  {o.hint && <span className="block truncate text-xs text-muted-foreground">{o.hint}</span>}
                </span>
                {o.value === value && <Check className="h-4 w-4 text-primary shrink-0" />}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">No matches.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

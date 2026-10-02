import { useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import type { ProductRef } from "@/types/boq";

// Spreadsheet-style cells for the combined Measurement & Quotation workspace. Each cell keeps its
// own draft while you type and only saves on blur / Enter, so typing never fights a server refresh.

const cellBase =
  "w-full h-8 rounded-md border border-transparent bg-transparent px-2 text-sm outline-none transition " +
  "hover:border-border focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/20 " +
  "disabled:cursor-not-allowed disabled:hover:border-transparent";

function toNum(s: string): number | null {
  const t = s.replace(/,/g, "").trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Enter commits and moves focus to the same column on the next row (like a spreadsheet). */
function handleKeys(e: React.KeyboardEvent<HTMLInputElement>, revert: () => void) {
  if (e.key === "Enter") {
    e.preventDefault();
    const el = e.currentTarget;
    const col = el.dataset.col;
    el.blur();
    if (col) {
      const all = Array.from(document.querySelectorAll<HTMLInputElement>(`input[data-col="${col}"]`));
      const next = all[all.indexOf(el) + 1];
      next?.focus();
      next?.select();
    }
  } else if (e.key === "Escape") {
    revert();
    e.currentTarget.blur();
  }
}

export function NumCell({
  value, onCommit, disabled, col, className = "", placeholder, onDraft,
}: {
  value?: number | null;
  onCommit: (v: number | null) => void;
  disabled?: boolean;
  /** Column key — Enter jumps to the next input with the same key. */
  col?: string;
  className?: string;
  placeholder?: string;
  /** Live draft value while typing (for instant line totals); undefined once the edit ends. */
  onDraft?: (v: number | null | undefined) => void;
}) {
  const shown = value == null ? "" : String(value);
  const [draft, setDraft] = useState(shown);
  const focused = useRef(false);
  // Only a value the user actually typed is saved. Until they type, a focused cell keeps following
  // the server — e.g. tabbing from Rate into Amount must show the new amount, not save the old one.
  const typed = useRef(false);
  useEffect(() => { if (!focused.current || !typed.current) setDraft(shown); }, [shown]);

  return (
    <input
      inputMode="decimal"
      data-col={col}
      disabled={disabled}
      placeholder={placeholder}
      className={`${cellBase} text-right tabular-nums ${className}`}
      value={draft}
      onFocus={(e) => { focused.current = true; typed.current = false; e.currentTarget.select(); }}
      onChange={(e) => { typed.current = true; setDraft(e.target.value); onDraft?.(toNum(e.target.value)); }}
      onBlur={() => {
        focused.current = false;
        const n = toNum(draft);
        if (typed.current && n !== (value ?? null)) onCommit(n);
        else setDraft(shown);
        typed.current = false;
        onDraft?.(undefined);
      }}
      onKeyDown={(e) => handleKeys(e, () => { setDraft(shown); onDraft?.(undefined); })}
    />
  );
}

export function TextCell({
  value, onCommit, disabled, col, className = "", placeholder, list,
}: {
  value?: string | null;
  onCommit: (v: string) => void;
  disabled?: boolean;
  col?: string;
  className?: string;
  placeholder?: string;
  /** Optional <datalist> id for suggestions. */
  list?: string;
}) {
  const shown = value ?? "";
  const [draft, setDraft] = useState(shown);
  const focused = useRef(false);
  // Only a value the user actually typed is saved. Until they type, a focused cell keeps following
  // the server — e.g. tabbing from Rate into Amount must show the new amount, not save the old one.
  const typed = useRef(false);
  useEffect(() => { if (!focused.current || !typed.current) setDraft(shown); }, [shown]);

  return (
    <input
      data-col={col}
      list={list}
      disabled={disabled}
      placeholder={placeholder}
      className={`${cellBase} ${className}`}
      value={draft}
      onFocus={() => { focused.current = true; typed.current = false; }}
      onChange={(e) => { typed.current = true; setDraft(e.target.value); }}
      onBlur={() => {
        focused.current = false;
        const t = draft.trim();
        if (typed.current && t !== shown.trim()) onCommit(t);
        else setDraft(shown);
        typed.current = false;
      }}
      onKeyDown={(e) => handleKeys(e, () => setDraft(shown))}
    />
  );
}

export function SelectCell({
  value, options, onCommit, disabled, className = "",
}: {
  value?: string | null;
  options: string[];
  onCommit: (v: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const opts = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <select
      disabled={disabled}
      className={`${cellBase} pr-1 ${className}`}
      value={value ?? ""}
      onChange={(e) => onCommit(e.target.value)}
    >
      {!value && <option value="">—</option>}
      {opts.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

/**
 * Type-ahead over the inventory catalog. Picking a product fills name/unit/rate; pressing Enter
 * on free text adds it as a custom (non-catalog) material.
 */
export function ProductSearch({
  autoFocus, onPick, onCustom, onCancel,
}: {
  autoFocus?: boolean;
  onPick: (p: ProductRef) => void;
  onCustom: (name: string) => void;
  onCancel: () => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ProductRef[]>([]);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    const t = setTimeout(() => {
      api.get(`/inventory/products?search=${encodeURIComponent(q.trim())}&size=8`)
        .then((res) => { setResults(res.data.content || []); setActive(-1); })
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="relative flex-1 min-w-0">
      <input
        autoFocus={autoFocus}
        className={`${cellBase} border-border bg-background`}
        placeholder="Search material or type a custom name, then Enter"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, -1)); }
          else if (e.key === "Enter") {
            e.preventDefault();
            if (active >= 0 && results[active]) onPick(results[active]);
            else if (q.trim()) onCustom(q.trim());
          } else if (e.key === "Escape") onCancel();
        }}
      />
      {results.length > 0 && (
        <div className="absolute z-30 mt-1 w-full max-h-64 overflow-auto rounded-md border bg-popover shadow-lg">
          {results.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onPick(p); }}
              className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 hover:bg-muted ${i === active ? "bg-muted" : ""}`}
            >
              <span className="truncate">
                {p.name}
                {p.brand && <span className="text-muted-foreground"> · {p.brand}</span>}
              </span>
              <span className="text-xs text-muted-foreground shrink-0">
                {p.sellingPrice ?? p.price ?? "—"}{p.unit ? ` / ${p.unit}` : ""}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

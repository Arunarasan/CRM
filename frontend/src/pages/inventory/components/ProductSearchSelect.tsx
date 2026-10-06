import { useEffect, useState } from "react";
import { Plus, SearchX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { inventoryApi } from "@/api/inventoryApi";
import type { Product } from "@/types/inventory";

interface ProductSearchSelectProps {
  value: Product | null;
  onChange: (product: Product | null) => void;
  placeholder?: string;
  /** Offer "Add “…” as a new material" in the list; called with what was typed. */
  onCreateNew?: (name: string) => void;
  /** What's typed in the search box (a line can show "not picked yet" from it). */
  onTextChange?: (text: string) => void;
  /** Red border — e.g. something was typed but no material was picked. */
  invalid?: boolean;
}

/** Debounced name/SKU/barcode search dropdown, matching the pattern already used by boq/components/MaterialPicker.tsx. */
export default function ProductSearchSelect({ value, onChange, placeholder, onCreateNew, onTextChange, invalid }: ProductSearchSelectProps) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const t = setTimeout(() => {
      inventoryApi.getProducts({ search, size: 15 })
        .then((res) => setResults(res.content || []))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [search, open]);

  const typed = search.trim();
  const exact = results.some((p) => p.name.trim().toLowerCase() === typed.toLowerCase());
  const pick = (p: Product) => { onChange(p); setOpen(false); setSearch(""); onTextChange?.(""); };

  if (value) {
    return (
      <div className="flex items-center justify-between border rounded-md px-3 py-2 bg-muted/30">
        <div className="text-sm min-w-0">
          <div className="font-medium truncate">{value.name}</div>
          <div className="text-xs text-muted-foreground">{[value.materialCode || value.sku, value.unit].filter(Boolean).join(" · ")}</div>
        </div>
        <button type="button" className="text-xs text-primary underline shrink-0 ml-2" onClick={() => { onChange(null); setSearch(""); onTextChange?.(""); }}>
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        placeholder={placeholder || "Search material (name, code, barcode)..."}
        value={search}
        aria-invalid={invalid || undefined}
        className={invalid ? "border-amber-400 focus-visible:ring-amber-300" : undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => { setSearch(e.target.value); onTextChange?.(e.target.value); setOpen(true); }}
        onKeyDown={(e) => {
          // Enter picks the top match — the quickest way to confirm what you typed.
          if (e.key === "Enter" && results.length > 0) { e.preventDefault(); pick(results[0]); }
        }}
      />
      {open && (results.length > 0 || typed) && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto border rounded-md bg-popover shadow-md divide-y">
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              className="w-full text-left p-2 text-sm hover:bg-muted/40"
              onMouseDown={() => pick(p)}
            >
              <div className="font-medium">{p.name}</div>
              <div className="text-xs text-muted-foreground">{[p.materialCode || p.sku, p.unit].filter(Boolean).join(" · ")}</div>
            </button>
          ))}
          {results.length === 0 && typed && !loading && (
            <div className="flex items-center gap-2 p-2.5 text-xs text-muted-foreground">
              <SearchX className="h-3.5 w-3.5" /> No material matches “{typed}”.
            </div>
          )}
          {onCreateNew && typed && !exact && (
            <button
              type="button"
              className="flex w-full items-center gap-1.5 p-2.5 text-left text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
              onMouseDown={() => { setOpen(false); onCreateNew(typed); }}
            >
              <Plus className="h-4 w-4" /> Add “{typed}” as a new material
            </button>
          )}
        </div>
      )}
    </div>
  );
}

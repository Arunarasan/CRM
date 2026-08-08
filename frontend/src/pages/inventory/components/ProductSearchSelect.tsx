import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { inventoryApi } from "@/api/inventoryApi";
import type { Product } from "@/types/inventory";

interface ProductSearchSelectProps {
  value: Product | null;
  onChange: (product: Product | null) => void;
  placeholder?: string;
}

/** Debounced name/SKU/barcode search dropdown, matching the pattern already used by boq/components/MaterialPicker.tsx. */
export default function ProductSearchSelect({ value, onChange, placeholder }: ProductSearchSelectProps) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      inventoryApi.getProducts({ search, size: 15 })
        .then((res) => setResults(res.content || []))
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [search, open]);

  if (value) {
    return (
      <div className="flex items-center justify-between border rounded-md px-3 py-2 bg-muted/30">
        <div className="text-sm">
          <div className="font-medium">{value.name}</div>
          <div className="text-xs text-muted-foreground">{value.materialCode || value.sku} · {value.unit}</div>
        </div>
        <button type="button" className="text-xs text-primary underline" onClick={() => { onChange(null); setSearch(""); }}>
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
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => setSearch(e.target.value)}
      />
      {open && results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto border rounded-md bg-popover shadow-md divide-y">
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              className="w-full text-left p-2 text-sm hover:bg-muted/40"
              onMouseDown={() => { onChange(p); setOpen(false); }}
            >
              <div className="font-medium">{p.name}</div>
              <div className="text-xs text-muted-foreground">{p.materialCode || p.sku} · {p.unit}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

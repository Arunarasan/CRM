import { useEffect, useRef, useState } from "react";
import { Search, Loader2, X } from "lucide-react";
import api from "@/lib/api";

export interface CustomerLite {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
}

/**
 * Type-ahead over existing customers. Lets a form reuse a customer the system already knows
 * instead of re-keying their details. Emits the picked customer's id — the caller decides what
 * to do with it (e.g. fetch the full record and prefill).
 */
export default function ExistingCustomerSearch({
  onPick, placeholder,
}: {
  onPick: (customerId: number, customer?: CustomerLite) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<CustomerLite[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (!term) { setResults([]); setOpen(false); return; }
    const t = setTimeout(() => {
      setLoading(true);
      api.get(`/customers?search=${encodeURIComponent(term)}&size=6`)
        .then((res) => { setResults(res.data.content || []); setOpen(true); })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="relative" ref={boxRef}>
      <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          className="flex-1 h-10 bg-transparent text-sm outline-none"
          placeholder={placeholder || "Search existing customers by name, phone or email..."}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
        />
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {q && !loading && (
          <button type="button" aria-label="Clear" onClick={() => setQ("")}>
            <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-md border bg-card shadow-lg overflow-hidden">
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => { onPick(c.id, c); setQ(""); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-accent border-b last:border-0 transition-colors"
            >
              <div className="text-sm font-medium">{c.name}</div>
              <div className="text-xs text-muted-foreground">
                {[c.phone, c.email, [c.city, c.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ") || "—"}
              </div>
            </button>
          ))}
        </div>
      )}

      {open && !loading && q.trim() && results.length === 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-md border bg-card shadow-lg px-3 py-2 text-sm text-muted-foreground">
          No existing customers match “{q.trim()}”. Fill the form below to create a new one.
        </div>
      )}
    </div>
  );
}

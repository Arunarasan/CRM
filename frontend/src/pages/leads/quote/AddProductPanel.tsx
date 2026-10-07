import { useEffect, useMemo, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowLeft, Check, FolderOpen, FolderPlus, Loader2, Minus, PackagePlus, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UnitOptions } from "@/components/UnitOptions";
import { normalizeUnit } from "@/lib/units";
import type { InventoryCategory, Product } from "@/types/inventory";
import {
  ListHeading, NewCategoryForm, Thumb, type WebsiteProduct,
  colorsOf, photosOf, priceOf, useCatalogueSearch, websiteUnit,
} from "./productCells";
import { CATEGORY_TONE, PRODUCT_TONE } from "./quoteTones";

// "Add product": the one place products (and new categories) are added to the quote. A right-hand
// drawer on tablet / desktop, a full-height bottom sheet on phones. It stays open, so several
// products go in one after another: search → pick → Qty / Rate → Add.

const inr = (v?: number | null) =>
  "₹" + Number(v ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

export type NewRowDraft = {
  name: string; product?: Product; web?: WebsiteProduct; qty: number; unit: string; rate: number;
  /** Typed-in name: also save it to the catalogue. */
  saveForLater?: boolean;
  /** Picked a saved-from-quote item and changed its name / unit: change the saved item too. */
  updateSaved?: boolean;
};

type Picked =
  | { kind: "product"; p: Product }
  | { kind: "web"; w: WebsiteProduct }
  | { kind: "custom" };

export default function AddProductPanel({
  open, onClose, initialCategory, newCategory, categories, categoryIdOf, savedCategories,
  onSaveCategory, onAddCategory, onAdd,
}: {
  open: boolean;
  onClose: () => void;
  /** Category selected when the panel opens (else the last one on the quote). */
  initialCategory?: string;
  /** Open straight on "New category". */
  newCategory?: boolean;
  /** Categories already on the quote, in sheet order. */
  categories: string[];
  categoryIdOf: (name: string) => number | undefined;
  savedCategories: InventoryCategory[];
  onSaveCategory: (c: InventoryCategory) => void;
  onAddCategory: (name: string) => void;
  onAdd: (category: string, d: NewRowDraft) => Promise<unknown>;
}) {
  const [category, setCategory] = useState("");
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(-1);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("Nos");
  const [rate, setRate] = useState("");
  const [saveForLater, setSaveForLater] = useState(true);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<{ key: number; category: string; name: string; amount: number }[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const rateRef = useRef<HTMLInputElement>(null);

  // Fresh state each time the panel opens.
  useEffect(() => {
    if (!open) return;
    const start = initialCategory && categories.includes(initialCategory) ? initialCategory : categories[categories.length - 1] ?? "";
    setCategory(start);
    setCreating(!!newCategory || categories.length === 0);
    setQ(""); setPicked(null); setAdded([]); setActive(-1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const { results, webResults, loading } = useCatalogueSearch({
    categoryId: categoryIdOf(category), categoryName: category, q,
    enabled: open && !!category && !creating && !picked, withWebsite: true,
  });
  const total = results.length + webResults.length;
  useEffect(() => setActive(-1), [results, webResults]);

  const num = (v: string) => { const n = Number(v.replace(/,/g, "")); return Number.isFinite(n) ? n : 0; };
  const amount = Math.round(num(qty) * num(rate) * 100) / 100;
  const focus = (el: HTMLInputElement | null) => setTimeout(() => { el?.focus(); el?.select(); }, 30);

  const pickProduct = (p: Product) => {
    setPicked({ kind: "product", p }); setName(p.name); setQty("1");
    setUnit(normalizeUnit(p.unit) || "Nos"); setRate(priceOf(p) ? String(priceOf(p)) : "");
    focus(qtyRef.current);
  };
  const pickWeb = (w: WebsiteProduct) => {
    // Website products carry no price — the rate is typed in next.
    setPicked({ kind: "web", w }); setName(w.name); setQty("1"); setUnit(websiteUnit(w)); setRate("");
    focus(rateRef.current);
  };
  const pickCustom = () => {
    if (!q.trim()) return;
    setPicked({ kind: "custom" }); setName(q.trim()); setQty("1"); setUnit("Nos"); setRate("");
    focus(qtyRef.current);
  };
  const back = () => { setPicked(null); focus(searchRef.current); };

  const add = async () => {
    if (!picked || !name.trim() || busy) return;
    setBusy(true);
    try {
      await onAdd(category, {
        name: name.trim(),
        product: picked.kind === "product" ? picked.p : undefined,
        web: picked.kind === "web" ? picked.w : undefined,
        qty: num(qty) > 0 ? num(qty) : 1, unit: unit || "Nos", rate: num(rate),
        saveForLater: picked.kind === "custom" && saveForLater,
      });
      setAdded((l) => [{ key: Date.now(), category, name: name.trim(), amount }, ...l]);
      setPicked(null); setQ("");
      focus(searchRef.current);
    } finally { setBusy(false); }
  };
  const enterAdds = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); add(); }
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); back(); }
  };

  const addedTotal = useMemo(() => added.reduce((s, a) => s + a.amount, 0), [added]);
  const step = (d: number) => setQty((v) => String(Math.max(0, Math.round((num(v) + d) * 100) / 100) || 1));

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#00140C]/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => { e.preventDefault(); focus(searchRef.current); }}
          className="quote-neutral fixed z-50 flex flex-col bg-card text-foreground shadow-2xl outline-none
                     inset-x-0 bottom-0 h-[92dvh] rounded-t-2xl data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom
                     sm:inset-y-0 sm:right-0 sm:left-auto sm:h-auto sm:w-[460px] sm:max-w-[94vw] sm:rounded-none sm:data-[state=open]:slide-in-from-right-8">
          {/* Header */}
          <div className="shrink-0 border-b px-4 pt-3 pb-3 sm:pt-4">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-muted-foreground/25 sm:hidden" aria-hidden />
            <div className="flex items-center justify-between gap-2">
              <DialogPrimitive.Title className="flex items-center gap-2 text-base font-semibold">
                {creating
                  ? <><FolderPlus className={`h-5 w-5 ${CATEGORY_TONE.icon}`} /> New category</>
                  : <><PackagePlus className="h-5 w-5 text-[#1F5C3F]" /> Add products</>}
              </DialogPrimitive.Title>
              <DialogPrimitive.Close className="h-9 w-9 -mr-1.5 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close">
                <X className="h-5 w-5" />
              </DialogPrimitive.Close>
            </div>

            {/* Category: chips for the ones on the quote + New category */}
            <p className="mt-2 mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Add to category</p>
            <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none]" role="radiogroup" aria-label="Category">
              {categories.map((c) => {
                const on = c === category && !creating;
                return (
                  <button key={c} type="button" role="radio" aria-checked={on}
                    onClick={() => { setCategory(c); setCreating(false); setPicked(null); setQ(""); focus(searchRef.current); }}
                    className={`h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium transition-colors ${on
                      ? `${CATEGORY_TONE.chipOn} font-semibold`
                      : "bg-background hover:bg-muted"}`}>
                    {on ? <Check className="inline h-3.5 w-3.5 mr-1 -mt-0.5" /> : <FolderOpen className={`inline h-3.5 w-3.5 mr-1 -mt-0.5 ${CATEGORY_TONE.icon}`} />}{c}
                  </button>
                );
              })}
              <button type="button" onClick={() => { setCreating(true); setPicked(null); }}
                aria-pressed={creating}
                className={`h-9 shrink-0 rounded-full border-2 border-dashed px-3.5 text-sm font-medium transition-colors ${creating
                  ? "border-[#D97706] bg-[#FEF3C7] text-[#92400E]" : "border-[#F59E0B]/60 bg-[#FFFBEB] text-[#92400E] hover:bg-[#FEF3C7]"}`}>
                <FolderPlus className="inline h-4 w-4 mr-1 -mt-0.5" /> New category
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
            {creating ? (
              <div className="p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold">{categories.length === 0 ? "First, name a category" : "New category"}</p>
                  <p className="text-xs text-muted-foreground">Products on the quote are grouped by category, e.g. Curtains, Wallpaper, Blinds.</p>
                </div>
                <NewCategoryForm
                  categories={savedCategories}
                  used={categories}
                  onSaveCategory={onSaveCategory}
                  onCancel={categories.length > 0 ? () => setCreating(false) : undefined}
                  onAdd={(n) => {
                    onAddCategory(n);
                    setCategory(n); setCreating(false); setQ(""); setPicked(null);
                    focus(searchRef.current);
                  }}
                />
              </div>
            ) : picked ? (
              // ---- Quantity & price for the picked product ----
              <div className="p-4 space-y-4">
                <button type="button" onClick={back}
                  className="-ml-1 inline-flex h-8 items-center gap-1 rounded-md px-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
                  <ArrowLeft className="h-4 w-4" /> Back to search
                </button>
                <div className="flex items-start gap-3">
                  {picked.kind === "custom"
                    ? <span className="h-14 w-14 shrink-0 rounded-md border bg-muted/60 flex items-center justify-center"><PackagePlus className="h-6 w-6 text-muted-foreground" /></span>
                    : <Thumb url={picked.kind === "product" ? photosOf(picked.p)[0] : picked.w.image} size="h-14 w-14" />}
                  <div className="min-w-0 flex-1">
                    {picked.kind === "custom" ? (
                      <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={enterAdds} aria-label="Product name"
                        className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm font-semibold outline-none focus:border-ring focus:ring-2 focus:ring-ring/20" />
                    ) : (
                      <p className="font-semibold leading-snug">{name}</p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {picked.kind === "product" ? "From inventory" : picked.kind === "web" ? "From the website catalogue — type its rate" : "New item"}
                      {" "}· goes into <span className="font-medium text-foreground">{category}</span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">Quantity</span>
                    <span className="flex h-11 items-stretch overflow-hidden rounded-md border border-border bg-background focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
                      <button type="button" onClick={() => step(-1)} aria-label="Less" className="w-10 shrink-0 flex items-center justify-center text-muted-foreground hover:bg-muted"><Minus className="h-4 w-4" /></button>
                      <input ref={qtyRef} inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} onKeyDown={enterAdds}
                        onFocus={(e) => e.currentTarget.select()} aria-label="Quantity"
                        className="min-w-0 flex-1 bg-transparent text-center text-base tabular-nums outline-none" />
                      <button type="button" onClick={() => step(1)} aria-label="More" className="w-10 shrink-0 flex items-center justify-center text-muted-foreground hover:bg-muted"><Plus className="h-4 w-4" /></button>
                    </span>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">Unit</span>
                    <select value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="Unit"
                      className="h-11 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20">
                      <UnitOptions value={unit} />
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">Rate ₹ <span className="font-normal">per {unit || "unit"}</span></span>
                    <input ref={rateRef} inputMode="decimal" value={rate} placeholder="0" onChange={(e) => setRate(e.target.value)} onKeyDown={enterAdds}
                      onFocus={(e) => e.currentTarget.select()} aria-label="Rate"
                      className="h-11 w-full rounded-md border border-border bg-background px-3 text-right text-base tabular-nums outline-none focus:border-ring focus:ring-2 focus:ring-ring/20" />
                  </label>
                  <div>
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">Amount</span>
                    <span className="flex h-11 items-center justify-end rounded-md bg-muted/60 px-3 text-base font-semibold tabular-nums">{inr(amount)}</span>
                  </div>
                </div>

                {picked.kind === "custom" && (
                  <label className="flex items-start gap-2 rounded-md border bg-muted/30 p-2.5 text-xs cursor-pointer select-none">
                    <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary" checked={saveForLater} onChange={(e) => setSaveForLater(e.target.checked)} />
                    <span><span className="font-medium text-foreground">Save for future quotes</span>
                      <span className="block text-muted-foreground">It shows up in search next time{num(rate) > 0 ? `, at ${inr(num(rate))}/${unit || "Nos"}` : ""}.</span></span>
                  </label>
                )}
                {num(rate) === 0 && <p className="text-xs text-[#B45309]">No rate yet — you can also type it in the quote table later.</p>}
              </div>
            ) : (
              // ---- Search the catalogue ----
              <div className="pb-2">
                <div className="sticky top-0 z-20 bg-card px-4 pt-3 pb-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input ref={searchRef} value={q} aria-label="Search products"
                      placeholder={`Search ${category || "products"} or type a new item…`}
                      className="h-11 w-full rounded-md border border-border bg-background pl-9 pr-3 text-base sm:text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                      onChange={(e) => setQ(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, total - 1)); }
                        else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, -1)); }
                        else if (e.key === "Enter") {
                          e.preventDefault();
                          if (active >= 0 && active < results.length) pickProduct(results[active]);
                          else if (active >= results.length) pickWeb(webResults[active - results.length]);
                          else pickCustom();
                        }
                      }} />
                  </div>
                </div>

                {q.trim() && (
                  <button type="button" onClick={pickCustom}
                    className="mx-4 mb-2 flex w-[calc(100%-2rem)] items-center gap-3 rounded-lg border border-dashed px-3 py-2.5 text-left hover:border-primary hover:bg-muted/50">
                    <span className="h-9 w-9 shrink-0 rounded-md bg-muted flex items-center justify-center"><Plus className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">Add "{q.trim()}" as a new item</span>
                      <span className="block text-xs text-muted-foreground">Not in the catalogue — type its quantity and rate</span>
                    </span>
                  </button>
                )}

                {loading && results.length === 0 && (
                  <div className="px-4 py-3 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Searching…</div>
                )}
                {results.length > 0 && <ListHeading>Inventory</ListHeading>}
                {results.map((p, i) => (
                  <ResultRow key={p.id} active={i === active} onClick={() => pickProduct(p)}
                    thumb={photosOf(p)[0]} name={p.name}
                    badge={p.source === "QUOTE" ? "Saved from quote" : undefined}
                    meta={[p.brand, colorsOf(p).length > 1 ? `${colorsOf(p).length} colours` : colorsOf(p)[0]?.name].filter(Boolean).join(" · ")}
                    price={priceOf(p) ? `${inr(priceOf(p))}${p.unit ? ` / ${p.unit}` : ""}` : "No rate"} />
                ))}
                {webResults.length > 0 && <ListHeading>Website catalogue</ListHeading>}
                {webResults.map((w, i) => (
                  <ResultRow key={`w${w.id}`} active={results.length + i === active} onClick={() => pickWeb(w)}
                    thumb={w.image} name={w.name} meta={[w.sku, w.shortDescription].filter(Boolean).join(" · ")}
                    price={`per ${websiteUnit(w)}`} />
                ))}
                {!loading && total === 0 && !q.trim() && (
                  <div className="px-6 py-10 text-center">
                    <Search className="mx-auto mb-2 h-6 w-6 text-muted-foreground/60" />
                    <p className="text-sm font-medium">Find a product for {category}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Search by name or code — or type any name to add it as a new item.</p>
                  </div>
                )}
                {!loading && total === 0 && q.trim() && (
                  <p className="px-4 py-2 text-xs text-muted-foreground">Nothing in the catalogue matches "{q.trim()}".</p>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t bg-card px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {picked ? (
              <Button className={`h-11 w-full text-base ${PRODUCT_TONE.solid}`} disabled={!name.trim() || busy} onClick={add}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackagePlus className="h-4 w-4" />}
                Add to {category}{amount > 0 ? ` · ${inr(amount)}` : ""}
              </Button>
            ) : (
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1 text-sm" aria-live="polite">
                  {added.length > 0 ? (
                    <>
                      <span className="flex items-center gap-1.5 font-medium text-[#16805C]"><Check className="h-4 w-4" /> {added.length} added · {inr(addedTotal)}</span>
                      <span className="block truncate text-xs text-muted-foreground">Last: {added[0].name} → {added[0].category}</span>
                    </>
                  ) : creating ? (
                    <span className="text-xs text-muted-foreground">Tap a saved category, or type a new name and press Create. You'll add its products next.</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Pick a product, set quantity and rate, then add. The panel stays open for the next one.</span>
                  )}
                </div>
                <Button variant={added.length ? "default" : "outline"} className="h-10 shrink-0 px-5" onClick={onClose}>Done</Button>
              </div>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function ResultRow({ thumb, name, meta, price, badge, active, onClick }: {
  thumb?: string | null; name: string; meta?: string; price: string; badge?: string; active: boolean; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted ${active ? "bg-muted" : ""}`}>
      <Thumb url={thumb} size="h-11 w-11" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">{name}</span>
          {badge && <span className="shrink-0 rounded bg-[#FFFBEB] px-1 text-[10px] font-semibold leading-4 text-[#B45309]">{badge}</span>}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{meta || " "}</span>
        <span className="block text-xs tabular-nums text-muted-foreground sm:hidden">{price}</span>
      </span>
      <span className="hidden sm:block shrink-0 text-xs tabular-nums text-muted-foreground">{price}</span>
      <span className="shrink-0 h-8 w-8 rounded-full border flex items-center justify-center text-muted-foreground" aria-hidden><Plus className="h-4 w-4" /></span>
    </button>
  );
}

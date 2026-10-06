import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Crop, ImageIcon, ImagePlus, Loader2, Plus, Search, Trash2, X } from "lucide-react";
import api from "@/lib/api";
import { resolveFileUrl, uploadFile } from "@/lib/uploadFile";
import { compressImageFile } from "@/lib/imageProcessing";
import { inventoryApi } from "@/api/inventoryApi";
import ImageEditor from "@/components/ImageEditor";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { InventoryCategory, Product, ProductColor } from "@/types/inventory";
import { NumCell } from "./cells";
import { unitDef } from "@/lib/units";

// Building blocks for the Category → Product quote sheet: the category picker, the catalogue product
// picker, and the per-line photo / colour / discount cells.

const inr = (v?: number | null) =>
  "₹" + Number(v ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

const norm = (s?: string | null) => (s ?? "").trim().toLowerCase();

// ---------------------------------------------------------------------------
// Catalogue data
// ---------------------------------------------------------------------------

let categoriesCache: Promise<InventoryCategory[]> | null = null;

/** Saved inventory categories (loaded once per page visit) + a name → category lookup. */
export function useCategories() {
  const [list, setList] = useState<InventoryCategory[]>([]);
  useEffect(() => {
    categoriesCache ??= inventoryApi.getCategories().catch(() => { categoriesCache = null; return []; });
    let alive = true;
    categoriesCache.then((c) => alive && setList(c));
    return () => { alive = false; };
  }, []);
  const byName = useMemo(() => {
    const m = new Map<string, InventoryCategory>();
    list.forEach((c) => m.set(norm(c.name), c));
    return m;
  }, [list]);
  const add = (c: InventoryCategory) => {
    setList((l) => [...l, c]);
    categoriesCache = Promise.resolve([...list, c]);
  };
  return { list, byName, add };
}

// ---------------------------------------------------------------------------
// Website catalogue (the public site's categories & products) — offered next to inventory
// ---------------------------------------------------------------------------

export type WebsiteProduct = {
  id: number; name: string; slug: string; sku?: string | null; categorySlug?: string | null;
  shortDescription?: string | null; image?: string | null;
  specifications?: { label: string; value: string }[] | null;
};
export type WebsiteCategory = { id: number; name: string; slug: string };

let websiteCache: Promise<{ categories: WebsiteCategory[]; products: WebsiteProduct[] }> | null = null;
function loadWebsiteCatalog() {
  websiteCache ??= Promise.all([
    // The api client already unwraps { success, data } responses.
    api.get("/public/categories").then((r) => (Array.isArray(r.data) ? r.data : r.data?.data ?? []) as WebsiteCategory[]),
    api.get("/public/products").then((r) => (Array.isArray(r.data) ? r.data : r.data?.data ?? []) as WebsiteProduct[]),
  ]).then(([categories, products]) => ({ categories, products }))
    .catch(() => { websiteCache = null; return { categories: [], products: [] }; });
  return websiteCache;
}

export function useWebsiteCatalog() {
  const [data, setData] = useState<{ categories: WebsiteCategory[]; products: WebsiteProduct[] }>({ categories: [], products: [] });
  useEffect(() => {
    let alive = true;
    loadWebsiteCatalog().then((d) => alive && setData(d));
    return () => { alive = false; };
  }, []);
  return data;
}

/** Website "Sold by" → a quote unit. */
const WEB_UNITS: Record<string, string> = {
  sqft: "Sqft", sqm: "Sqm", pcs: "Nos", pc: "Nos", nos: "Nos", set: "Set", feet: "Rft", ft: "Rft", rft: "Rft",
  meter: "Mtr", metre: "Mtr", roll: "Roll", pair: "Pair", pack: "Pack", kg: "Kg",
};
export function websiteUnit(p: WebsiteProduct) {
  const v = p.specifications?.find((s) => norm(s.label) === "sold by")?.value;
  return (v && (WEB_UNITS[norm(v)] || unitDef(v)?.code)) || "Nos";
}

/** The catalogue products behind the sheet's lines — for their colour options and photos. */
export function useLineProducts(ids: number[]) {
  const [map, setMap] = useState<Record<number, Product>>({});
  const key = [...new Set(ids)].sort((a, b) => a - b).join(",");
  useEffect(() => {
    const missing = key ? key.split(",").map(Number).filter((id) => !map[id]) : [];
    if (missing.length === 0) return;
    api.get<Product[]>(`/inventory/products/lookup?ids=${missing.join(",")}`)
      .then((r) => setMap((m) => { const n = { ...m }; r.data.forEach((p) => { n[p.id] = p; }); return n; }))
      .catch(() => { /* colours just fall back to free text */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const remember = (p: Product) => setMap((m) => ({ ...m, [p.id]: p }));
  return { products: map, remember };
}

/** A product's colour options; an older product with only a single colour offers that one. */
export function colorsOf(p?: Product): ProductColor[] {
  if (!p) return [];
  if (p.colors && p.colors.length) return p.colors;
  return p.color ? [{ name: p.color }] : [];
}

/** Every photo of a product: main, gallery and colour photos (deduped). */
export function photosOf(p?: Product): string[] {
  if (!p) return [];
  const all = [p.imageUrl, ...(p.imageUrls || []), ...colorsOf(p).map((c) => c.imageUrl)];
  return [...new Set(all.filter((u): u is string => !!u))];
}

/** A short spec line used as the default description of a picked product. */
export function productSummary(p: Product): string | undefined {
  const parts = [p.brand, p.fabricComposition, p.pattern, p.fabricWidth && `${p.fabricWidth} wide`].filter(Boolean);
  return parts.length ? parts.join(" · ") : undefined;
}

export const priceOf = (p: Product) => Number(p.sellingPrice ?? p.price ?? 0);

// ---------------------------------------------------------------------------
// Add a category: a saved one, or a custom name (optionally saved to the catalogue)
// ---------------------------------------------------------------------------

const CATEGORY_LIST = "quote-category-names";

export function AddCategoryBar({ categories, used, onAdd, onSaveCategory, openSignal }: {
  /** Bumped by the page's "Add Item → New category" to open the bar. */
  openSignal?: number;
  categories: InventoryCategory[];
  /** Category names already on the sheet (not offered again). */
  used: string[];
  onAdd: (name: string) => void;
  onSaveCategory: (c: InventoryCategory) => void;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (openSignal) setOpen(true); }, [openSignal]);
  const [name, setName] = useState("");
  const [saveToCatalog, setSaveToCatalog] = useState(true);
  const [busy, setBusy] = useState(false);
  const usedSet = new Set(used.map(norm));
  const website = useWebsiteCatalog();
  // Inventory categories first, then the website's (same name only once).
  const all = useMemo(() => {
    const seen = new Set(categories.map((c) => norm(c.name)));
    const web = website.categories.filter((c) => !seen.has(norm(c.name)))
      .map((c) => ({ id: -c.id, name: c.name } as InventoryCategory));
    return [...categories, ...web];
  }, [categories, website.categories]);
  const options = all.filter((c) => !usedSet.has(norm(c.name)));
  const saved = all.find((c) => norm(c.name) === norm(name));
  const already = usedSet.has(norm(name));

  const submit = async (picked?: string) => {
    const n = (picked ?? name).trim();
    if (!n) return;
    if (usedSet.has(norm(n))) { toast.error(`"${n}" is already on the quote.`); return; }
    const match = all.find((c) => norm(c.name) === norm(n));
    if (!match && saveToCatalog) {
      setBusy(true);
      try {
        onSaveCategory(await inventoryApi.createCategory({ name: n }));
      } catch {
        toast.error("Couldn't save the category to the catalogue — added to this quote only.");
      } finally {
        setBusy(false);
      }
    }
    onAdd(match?.name ?? n);
    setName("");
    setOpen(false);
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-dashed p-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 flex items-center justify-center gap-1.5">
        <Plus className="h-4 w-4" /> Add category
      </button>
    );
  }

  return (
    <div id="quote-add-category" className="rounded-lg border border-dashed p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">New category</span>
        <Input autoFocus list={CATEGORY_LIST} placeholder="Pick a saved category or type a new name" className="h-9 flex-1 min-w-[14rem]"
          value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") setOpen(false); }} />
        <datalist id={CATEGORY_LIST}>
          {options.map((c) => <option key={c.id} value={c.name}>{c.parent?.name ? `in ${c.parent.name}` : ""}</option>)}
        </datalist>
        <Button size="sm" disabled={!name.trim() || already || busy} onClick={() => submit()}>
          {busy && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Add
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
      {name.trim() && !saved && !already && (
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
          <input type="checkbox" className="h-3.5 w-3.5 accent-primary" checked={saveToCatalog} onChange={(e) => setSaveToCatalog(e.target.checked)} />
          New category — also save it to the catalogue so it can be picked next time
        </label>
      )}
      {options.length > 0 && !name.trim() && (
        <div className="flex flex-wrap gap-1.5">
          {options.slice(0, 16).map((c) => (
            <button key={c.id} type="button" onClick={() => submit(c.name)}
              className="rounded-full border bg-background px-3 py-1 text-xs hover:border-primary hover:text-primary">
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add a product to a category: catalogue search (that category first), or a custom product
// ---------------------------------------------------------------------------

export function ProductPicker({
  categoryId, categoryName, onPick, onPickWebsite, onCustom, value, onValueChange, placeholder, inputClassName, inputRef, hideIcon,
}: {
  categoryId?: number;
  categoryName: string;
  onPick: (p: Product) => void;
  /** Website catalogue products are offered too when this is given. */
  onPickWebsite?: (p: WebsiteProduct) => void;
  onCustom: (name: string) => void;
  /** Controlled text (the table's new-item row keeps the picked name in the box). */
  value?: string;
  onValueChange?: (v: string) => void;
  placeholder?: string;
  inputClassName?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  hideIcon?: boolean;
}) {
  const [ownQ, setOwnQ] = useState("");
  const q = value ?? ownQ;
  const setQ = (v: string) => { if (onValueChange) onValueChange(v); else setOwnQ(v); };
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const website = useWebsiteCatalog();
  // Website products: this category's when nothing is typed, otherwise anything matching the text
  // (this category's first). Kept short so inventory stays the main list.
  const webResults = useMemo(() => {
    if (!onPickWebsite) return [];
    const cat = website.categories.find((c) => norm(c.name) === norm(categoryName)
      || norm(c.name).includes(norm(categoryName)) || norm(categoryName).includes(norm(c.name)));
    const t = norm(q);
    const inCat = (p: WebsiteProduct) => !!cat && p.categorySlug === cat.slug;
    const list = t
      ? website.products.filter((p) => norm(p.name).includes(t) || norm(p.sku).includes(t))
      : website.products.filter(inCat);
    return [...list].sort((a, b) => Number(inCat(b)) - Number(inCat(a))).slice(0, 8);
  }, [onPickWebsite, website, categoryName, q]);
  const total = results.length + webResults.length;

  useEffect(() => {
    if (!open) return;
    const search = q.trim();
    if (!categoryId && !search) { setResults([]); return; }
    const t = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ size: "20" });
      if (categoryId) params.set("categoryId", String(categoryId));
      if (search) params.set("search", search);
      api.get(`/inventory/products?${params}`)
        .then((res) => { setResults(res.data.content || []); setActive(-1); })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, search ? 250 : 0);
    return () => clearTimeout(t);
  }, [q, open, categoryId]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  // Controlled: the parent decides what the box shows after a pick; uncontrolled: it clears.
  const pick = (p: Product) => { onPick(p); if (value === undefined) setQ(""); setOpen(false); };
  const pickWeb = (p: WebsiteProduct) => { onPickWebsite?.(p); if (value === undefined) setQ(""); setOpen(false); };
  const pickActive = () => {
    if (active < results.length) pick(results[active]);
    else pickWeb(webResults[active - results.length]);
  };
  const custom = () => { if (q.trim()) { onCustom(q.trim()); if (value === undefined) setQ(""); setOpen(false); } };

  return (
    <div ref={boxRef} className="relative flex-1 min-w-0">
      <div className="relative">
        {!hideIcon && <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
        <Input
          ref={inputRef}
          className={inputClassName ?? "h-9 pl-8"}
          placeholder={placeholder ?? `Add a product to ${categoryName} — search, or type a custom name and press Enter`}
          value={q}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, total - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, -1)); }
            else if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey && open && (active >= 0 || q.trim()))) {
              if (e.key === "Enter") e.preventDefault();
              if (active >= 0 && active < total) pickActive(); else custom();
            } else if (e.key === "Escape") setOpen(false);
          }}
        />
      </div>
      {open && (loading || total > 0 || q.trim()) && (
        <div className="absolute z-30 mt-1 w-full max-h-96 overflow-auto rounded-md border bg-popover shadow-lg">
          {results.length > 0 && onPickWebsite && <ListHeading>Materials · inventory</ListHeading>}
          {loading && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading products…</div>
          )}
          {results.map((p, i) => (
            <button key={p.id} type="button" onMouseDown={(e) => { e.preventDefault(); pick(p); }}
              className={`w-full text-left px-2 py-1.5 text-sm flex items-center gap-2.5 hover:bg-muted ${i === active ? "bg-muted" : ""}`}>
              <Thumb url={photosOf(p)[0]} size="h-9 w-9" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate font-medium">{p.name}</span>
                  {p.source === "QUOTE" && (
                    <span className="shrink-0 rounded bg-amber-50 px-1 text-[10px] font-semibold leading-4 text-amber-700" title="Saved from an earlier quote">Saved from quote</span>
                  )}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {[p.brand, colorsOf(p).length > 1 ? `${colorsOf(p).length} colours` : colorsOf(p)[0]?.name].filter(Boolean).join(" · ") || " "}
                </span>
              </span>
              <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                {priceOf(p) ? inr(priceOf(p)) : "—"}{p.unit ? ` / ${p.unit}` : ""}
              </span>
            </button>
          ))}
          {webResults.length > 0 && (
            <>
              <ListHeading>Website catalogue</ListHeading>
              {webResults.map((p, i) => (
                <button key={`w${p.id}`} type="button" onMouseDown={(e) => { e.preventDefault(); pickWeb(p); }}
                  className={`w-full text-left px-2 py-1.5 text-sm flex items-center gap-2.5 hover:bg-muted ${results.length + i === active ? "bg-muted" : ""}`}>
                  <Thumb url={p.image} size="h-9 w-9" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{[p.sku, p.shortDescription].filter(Boolean).join(" · ") || " "}</span>
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">per {websiteUnit(p)}</span>
                </button>
              ))}
            </>
          )}
          {!loading && total === 0 && !q.trim() && (
            <div className="px-3 py-2 text-xs text-muted-foreground">No products saved in {categoryName} yet — type a name to add a custom one.</div>
          )}
          {q.trim() && (
            <button type="button" onMouseDown={(e) => { e.preventDefault(); custom(); }}
              className="w-full text-left px-3 py-2 text-sm border-t hover:bg-muted flex items-center gap-1.5 text-primary">
              <Plus className="h-4 w-4" /> Add “{q.trim()}” as a custom product
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const ListHeading = ({ children }: { children: React.ReactNode }) => (
  <div className="sticky top-0 z-10 border-b bg-muted/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
    {children}
  </div>
);

// ---------------------------------------------------------------------------
// Per-line cells
// ---------------------------------------------------------------------------

export function Thumb({ url, size = "h-11 w-11" }: { url?: string | null; size?: string }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [url]);
  return url && !broken ? (
    <img src={resolveFileUrl(url)} alt="" onError={() => setBroken(true)}
      className={`${size} shrink-0 rounded-md border object-cover bg-muted`} />
  ) : (
    <span className={`${size} shrink-0 rounded-md border bg-muted/60 flex items-center justify-center`}>
      <ImageIcon className="h-4 w-4 text-muted-foreground/60" />
    </span>
  );
}

/**
 * The line's photo, chosen while making the quote: take one with the camera, pick one from the
 * gallery, use one of the product's own photos, or remove it. Photos are shrunk before upload.
 */
export function ImageCell({ url, options, disabled, onChange, module = "QUOTATION", size }: {
  url?: string | null;
  /** Thumbnail size classes (default 44px). */
  size?: string;
  options: string[];
  disabled: boolean;
  onChange: (url: string | null) => void;
  /** Upload folder on the server. */
  module?: string;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  // A photo waiting in the crop/rotate editor (new pick, or the current photo being re-edited).
  const [editing, setEditing] = useState<File | null>(null);
  const upload = async (file: File) => {
    setBusy(true);
    try {
      const small = await compressImageFile(file, { maxDimension: 1200, quality: 0.8 });
      onChange((await uploadFile(small, module)).fileUrl);
    } catch {
      toast.error("Couldn't upload the photo.");
    } finally {
      setBusy(false);
    }
  };
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) setEditing(file);
  };
  // Pull the current photo back from storage so it can be cropped / rotated and re-uploaded.
  const editCurrent = async () => {
    if (!url) return;
    setBusy(true);
    try {
      // Our stored photos come through the API — the storage bucket sends no CORS headers, so the
      // browser can't read them directly. Other links are tried as-is.
      const src = resolveFileUrl(url);
      let blob: Blob;
      try {
        blob = (await api.get(`/uploads/image`, { params: { url: src }, responseType: "blob" })).data;
      } catch {
        const r = await fetch(src);
        if (!r.ok) throw new Error("fetch failed");
        blob = await r.blob();
      }
      setEditing(new File([blob], "photo", { type: blob.type || "image/jpeg" }));
    } catch {
      toast.error("Couldn't open this photo for editing.");
    } finally {
      setBusy(false);
    }
  };
  if (disabled) return <Thumb url={url} size={size} />;
  return (
    <>
      {/* capture opens the rear camera straight away on phones; the other input opens the gallery */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button type="button" className="relative rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30"
            title={url ? "Change photo" : "Add photo"} aria-label={url ? "Change photo" : "Add photo"}>
            <Thumb url={url} size={size} />
            {!url && !busy && (
              <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                <Plus className="h-3 w-3" />
              </span>
            )}
            {busy && <span className="absolute inset-0 flex items-center justify-center bg-background/70 rounded-md"><Loader2 className="h-4 w-4 animate-spin" /></span>}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64 p-2 space-y-2">
          <div className="grid grid-cols-2 gap-1.5">
            <Button size="sm" variant="outline" onClick={() => { setOpen(false); cameraRef.current?.click(); }}>
              <Camera className="h-3.5 w-3.5 mr-1" /> Take photo
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setOpen(false); galleryRef.current?.click(); }}>
              <ImagePlus className="h-3.5 w-3.5 mr-1" /> Gallery
            </Button>
          </div>
          {options.length > 0 && (
            <>
              <p className="px-0.5 text-[11px] text-muted-foreground">Product photos</p>
              <div className="grid grid-cols-4 gap-1.5">
                {options.map((o) => (
                  <button key={o} type="button" onClick={() => { setOpen(false); onChange(o); }}
                    className={`rounded-md ${o === url ? "ring-2 ring-primary" : ""}`}>
                    <Thumb url={o} size="h-12 w-12" />
                  </button>
                ))}
              </div>
            </>
          )}
          {url && (
            <Button size="sm" variant="outline" className="w-full" onClick={() => { setOpen(false); editCurrent(); }}>
              <Crop className="h-3.5 w-3.5 mr-1" /> Crop / edit photo
            </Button>
          )}
          {url && (
            <Button size="sm" variant="ghost" className="w-full text-destructive" onClick={() => { setOpen(false); onChange(null); }}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove photo
            </Button>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {editing && (
        <ImageEditor
          file={editing}
          fileName={editing.name}
          open
          onCancel={() => setEditing(null)}
          onSave={(f) => { setEditing(null); upload(f); }}
          defaultMaxDimension={1200}
          defaultQuality={0.8}
        />
      )}
    </>
  );
}

/** Colour as a table input box: type anything, or pick one of the product's colours. */
export function ColourBox({ value, colors, disabled, onChange, className = "", inputClassName = "" }: {
  value?: string | null;
  colors: ProductColor[];
  disabled: boolean;
  onChange: (name: string | null, color?: ProductColor) => void;
  className?: string;
  /** Extra classes for the input (e.g. a borderless table look). */
  inputClassName?: string;
}) {
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => setDraft(value ?? ""), [value]);
  const listId = useMemo(() => `colours-${Math.random().toString(36).slice(2)}`, []);
  const known = colors.find((c) => norm(c.name) === norm(draft));
  if (disabled) return <span className={`block truncate px-2 text-sm ${className}`}>{value || "—"}</span>;
  return (
    <span className={`relative block ${className}`}>
      {known?.hex && <span className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border" style={{ background: known.hex }} />}
      <input value={draft} list={colors.length ? listId : undefined} placeholder="Colour" aria-label="Colour"
        className={`h-8 w-full rounded-md border border-border bg-background ${known?.hex ? "pl-6" : "pl-2"} pr-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 ${inputClassName}`}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const t = draft.trim();
          if (t === (value ?? "")) return;
          onChange(t || null, colors.find((c) => norm(c.name) === norm(t)));
        }}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setDraft(value ?? ""); e.currentTarget.blur(); } }} />
      {colors.length > 0 && (
        <datalist id={listId}>{colors.map((c) => <option key={c.name} value={c.name} />)}</datalist>
      )}
    </span>
  );
}

/** Colour: one of the product's colours (with swatch), or any custom text. */
export function ColorCell({ value, colors, disabled, onChange }: {
  value?: string | null;
  colors: ProductColor[];
  disabled: boolean;
  onChange: (name: string | null, color?: ProductColor) => void;
}) {
  const known = colors.find((c) => norm(c.name) === norm(value));
  const [custom, setCustom] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => setDraft(value ?? ""), [value]);
  const swatch = known?.hex;

  if (disabled) {
    return value ? (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        {swatch && <Swatch hex={swatch} />}{value}
      </span>
    ) : null;
  }

  if (colors.length > 0 && !custom && (!value || known)) {
    return (
      <span className="inline-flex items-center gap-1">
        {swatch && <Swatch hex={swatch} />}
        <select value={known?.name ?? ""} aria-label="Colour"
          className="h-6 max-w-[6.5rem] rounded-md border border-transparent bg-transparent px-1 text-xs text-muted-foreground outline-none cursor-pointer hover:border-border hover:text-foreground focus:border-primary"
          onChange={(e) => {
            if (e.target.value === "__custom") { setCustom(true); return; }
            const c = colors.find((x) => x.name === e.target.value);
            onChange(c?.name ?? null, c);
          }}>
          <option value="">+ Colour</option>
          {colors.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          <option value="__custom">Other colour…</option>
        </select>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input value={draft} placeholder="+ Colour" aria-label="Colour"
        className="h-6 w-[4.5rem] focus:w-32 transition-[width] rounded-md border border-transparent bg-transparent px-1 text-xs outline-none placeholder:text-muted-foreground hover:border-border focus:border-primary focus:bg-background"
        autoFocus={custom}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { setCustom(false); if (draft.trim() !== (value ?? "")) onChange(draft.trim() || null); }}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setDraft(value ?? ""); setCustom(false); } }} />
      {colors.length > 0 && value && !known && (
        <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="Pick from colours"
          onClick={() => onChange(null)}><X className="h-3.5 w-3.5" /></button>
      )}
    </span>
  );
}

const Swatch = ({ hex }: { hex: string }) => (
  <span className="h-3.5 w-3.5 shrink-0 rounded-full border" style={{ background: hex }} />
);

/** Optional line discount: hidden behind "+ Discount" until used; % or ₹. */
export function DiscountCell({ type, value, amount, disabled, onChange, selectClassName = "" }: {
  /** Extra classes for the dropdown (e.g. a borderless table look). */
  selectClassName?: string;
  type?: "PERCENT" | "FLAT" | null;
  value?: number | null;
  amount?: number | null;
  disabled: boolean;
  onChange: (type: "PERCENT" | "FLAT" | null, value: number | null) => void;
}) {
  const v = Number(value ?? 0);
  const has = v > 0;
  const flat = type === "FLAT";
  const [custom, setCustom] = useState(false);
  if (disabled) {
    return <span className="block px-2 text-sm tabular-nums text-muted-foreground">{has ? (flat ? inr(v) : `${v}%`) : "0%"}</span>;
  }
  if (custom) {
    // Any other % or a flat ₹ amount.
    return (
      <div className="flex items-center gap-1">
        <button type="button" title="Switch % / ₹"
          onClick={() => onChange(flat ? "PERCENT" : "FLAT", has ? v : null)}
          className="h-8 w-7 shrink-0 rounded-md border border-border bg-background text-xs font-semibold">
          {flat ? "₹" : "%"}
        </button>
        <NumCell value={has ? v : null} placeholder="0" className="!border-border !bg-background"
          onCommit={(n) => { setCustom(false); onChange(n && n > 0 ? (type ?? "PERCENT") : null, n && n > 0 ? n : null); }} />
      </div>
    );
  }
  // A plain dropdown like the mockup: common % values, the current one, and "Other…".
  const presets = [0, 5, 10, 15, 20];
  const current = !has ? "P0" : flat ? `F${v}` : `P${v}`;
  const options = presets.map((p) => `P${p}`);
  if (!options.includes(current)) options.splice(1, 0, current);
  const label = (o: string) => (o.startsWith("F") ? inr(Number(o.slice(1))) : `${o.slice(1)}%`);
  return (
    <select value={current} aria-label="Discount" title={has ? `− ${inr(amount)}` : "No discount"}
      className={`h-8 w-full rounded-md border border-border bg-background px-2 text-sm tabular-nums outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 ${selectClassName}`}
      onChange={(e) => {
        const o = e.target.value;
        if (o === "other") { setCustom(true); return; }
        const n = Number(o.slice(1));
        if (o.startsWith("F")) return;
        onChange(n > 0 ? "PERCENT" : null, n > 0 ? n : null);
      }}>
      {options.map((o) => <option key={o} value={o}>{label(o)}</option>)}
      <option value="other">Other…</option>
    </select>
  );
}

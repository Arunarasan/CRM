import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, Copy, Hammer, Loader2, MapPin, MoreVertical, Package, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { boqApi } from "@/api/boqApi";
import {
  BOQ_UNITS,
  type Boq, type BoqItem, type BoqItemLabour, type BoqItemMaterial, type ProductRef,
} from "@/types/boq";
import type { Product, ProductColor } from "@/types/inventory";
import { NumCell, ProductSearch, SelectCell, TextCell } from "./cells";
import {
  AddCategoryBar, ColorCell, DiscountCell, ImageCell, ProductPicker,
  colorsOf, photosOf, priceOf, productSummary, useCategories, useLineProducts,
} from "./productCells";

// The quote sheet, organised Category → Product. Every line is edited in place, saved on blur, and
// the sheet is re-fetched after each save so server-calculated totals stay authoritative.

const inr = (v?: number | null) =>
  "₹" + Number(v ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const errMsg = (e: any, fallback: string) =>
  e?.response?.data?.message || (typeof e?.response?.data === "string" ? e.response.data : "") || fallback;

const AREA_UNITS = ["Sqft", "Sqm"];
const LABOUR_RATES_KEY = "boqLabourRates";
const LABOUR_TYPES_LIST = "boq-labour-types";
/** Lines saved without a category land here. */
const NO_CATEGORY = "Others";
/** boq_items.category is VARCHAR(50). */
const CATEGORY_MAX = 50;

function loadSavedRates(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(LABOUR_RATES_KEY) || "{}"); } catch { return {}; }
}
function rememberRate(workType?: string, rate?: number | null) {
  if (!workType || rate == null) return;
  try {
    const all = loadSavedRates();
    all[workType.trim().toLowerCase()] = rate;
    localStorage.setItem(LABOUR_RATES_KEY, JSON.stringify(all));
  } catch { /* storage unavailable — suggestions just won't persist */ }
}

const orderOf = (i: BoqItem) => [i.floorOrder ?? 0, i.roomOrder ?? 0, i.itemOrder ?? 0, i.id ?? 0];
function compareItems(a: BoqItem, b: BoqItem) {
  const x = orderOf(a), y = orderOf(b);
  for (let k = 0; k < x.length; k++) if (x[k] !== y[k]) return x[k] - y[k];
  return 0;
}

const categoryOf = (i: BoqItem) => (i.category || "").trim() || NO_CATEGORY;
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Price of a line before its own discount (older lines have no gross yet: amount + discount). */
const grossOf = (i: BoqItem) =>
  i.grossAmount != null && (Number(i.grossAmount) > 0 || Number(i.amount ?? 0) === 0)
    ? Number(i.grossAmount)
    : Number(i.amount ?? 0) + Number(i.discountAmount ?? 0);

/** Gross price that leaves `net` after the line's discount. */
function grossForNet(i: BoqItem, net: number) {
  const v = Number(i.discountValue ?? 0);
  if (v <= 0) return net;
  if (i.discountType === "FLAT") return net + v;
  return v >= 100 ? net : net / (1 - v / 100);
}

/** Payload for the full-replace item update — children are managed by their own endpoints. */
function itemPayload(item: BoqItem, patch: Partial<BoqItem>): Partial<BoqItem> {
  const { materials: _m, labours: _l, ...rest } = item;
  return { ...rest, ...patch };
}
function materialPayload(m: BoqItemMaterial, patch: Partial<BoqItemMaterial>): Partial<BoqItemMaterial> {
  return { ...m, product: m.product?.id ? { id: m.product.id } : undefined, ...patch };
}

type Group = { category: string; items: BoqItem[] };

export default function BoqSheet({
  boq, canEdit, onBoqChanged,
}: {
  boq: Boq;
  canEdit: boolean;
  onBoqChanged: (b: Boq) => void;
}) {
  const boqId = boq.id as number;
  const latest = useRef(boq);
  useEffect(() => { latest.current = boq; }, [boq]);

  // All saves run one after another: the item/material/labour updates are full-replace, so two
  // overlapping saves built from the same snapshot would undo each other.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const [pending, setPending] = useState(0);
  const [lastSaved, setLastSaved] = useState<number | null>(null);

  const save = (label: string, job: (cur: Boq) => Promise<unknown>) => {
    setPending((n) => n + 1);
    queue.current = queue.current
      .then(async () => {
        try {
          await job(latest.current);
          setLastSaved(Date.now());
        } catch (e) {
          toast.error(errMsg(e, `Could not ${label}.`));
        }
        try {
          const fresh = await boqApi.get(boqId);
          latest.current = fresh;
          onBoqChanged(fresh);
        } catch { /* keep current view; the next save refreshes */ }
      })
      .finally(() => setPending((n) => n - 1));
    return queue.current;
  };

  const findItem = (cur: Boq, id: number) => (cur.items || []).find((i) => i.id === id);

  const updateItem = (id: number, patch: Partial<BoqItem>) =>
    save("update the item", (cur) => {
      const it = findItem(cur, id);
      return it ? boqApi.updateItem(boqId, id, itemPayload(it, patch)) : Promise.resolve();
    });

  /** Size edit: keep area in step, and carry it into qty when qty was tracking the area. */
  const updateSize = (item: BoqItem, field: "length" | "width", v: number | null) => {
    const L = field === "length" ? v : item.length ?? null;
    const W = field === "width" ? v : item.width ?? null;
    const patch: Partial<BoqItem> = { [field]: v ?? undefined };
    if (L != null && W != null) {
      const area = Math.round(L * W * 100) / 100;
      const oldArea = item.length != null && item.width != null ? item.length * item.width : null;
      const qtyTracksArea = item.quantity == null || item.quantity === 0
        || (oldArea != null && Math.abs((item.quantity ?? 0) - oldArea) < 0.01)
        || (item.area != null && Math.abs((item.quantity ?? 0) - item.area) < 0.01);
      patch.area = area;
      if (AREA_UNITS.includes(item.unit || "") && qtyTracksArea) patch.quantity = area;
    }
    const res = updateItem(item.id as number, patch);
    if (patch.quantity != null && patch.quantity !== item.quantity) followQty(item, Number(item.quantity ?? 0), patch.quantity);
    return res;
  };

  const updateMaterial = (itemId: number, matId: number, patch: Partial<BoqItemMaterial>) =>
    save("update the material", (cur) => {
      const m = findItem(cur, itemId)?.materials?.find((x) => x.id === matId);
      return m ? boqApi.updateMaterial(boqId, itemId, matId, materialPayload(m, patch)) : Promise.resolve();
    });

  const updateLabour = (itemId: number, labId: number, patch: Partial<BoqItemLabour>) =>
    save("update the labour", (cur) => {
      const l = findItem(cur, itemId)?.labours?.find((x) => x.id === labId);
      if (!l) return Promise.resolve();
      const next = { ...l, ...patch };
      rememberRate(next.workType, next.rate);
      return boqApi.updateLabour(boqId, itemId, labId, next);
    });

  /**
   * "Type the price": scale the item's material + labour rates so the line's price before its own
   * discount adds up to the target. An item with no priced lines gets one material line carrying it.
   */
  const setItemGross = (item: BoqItem, target: number) => {
    const id = item.id as number;
    const round2 = (n: number) => Math.round(n * 100) / 100;
    target = round2(target);
    const current = grossOf(item);
    if (target < 0 || Math.abs(target - current) < 0.005) return;
    const mats = (item.materials || []).filter((m) => Number(m.sellingRate ?? 0) > 0 && Number(m.quantity ?? 0) > 0);
    const labs = (item.labours || []).filter((l) => Number(l.rate ?? 0) > 0 && Number(l.quantity ?? 0) > 0);
    if (current > 0 && mats.length + labs.length > 0) {
      // Scale every line, then put the rounding leftover on the last one so the item lands exactly
      // on the typed amount (lines with no rate keep contributing their fixed amount).
      const factor = target / current;
      const lines = [
        ...mats.map((m) => ({ kind: "m" as const, id: m.id as number, rate: Number(m.sellingRate),
          units: Number(m.quantity) * (1 + Number(m.wastePercent ?? 0) / 100) })),
        ...labs.map((l) => ({ kind: "l" as const, id: l.id as number, rate: Number(l.rate), units: Number(l.quantity) })),
      ];
      // One price line and the amount doesn't divide evenly by its quantity (₹2,500 for 3): a rate in
      // paise can't land on it, so store it as a lump sum — the typed amount is what the customer sees.
      if (lines.length === 1 && Math.abs(round2(target / lines[0].units) * lines[0].units - target) >= 0.005) {
        const x = lines[0];
        if (x.kind === "m") updateMaterial(id, x.id, { quantity: 1, wastePercent: 0, sellingRate: target });
        else updateLabour(id, x.id, { quantity: 1, rate: target });
        return;
      }
      const scaledSum = lines.reduce((s, x) => s + x.units * x.rate, 0);
      let remaining = target - (current - scaledSum);
      lines.forEach((x, i) => {
        const rate = i === lines.length - 1 ? round2(remaining / x.units) : round2(x.rate * factor);
        remaining -= round2(x.units * rate);
        if (x.kind === "m") updateMaterial(id, x.id, { sellingRate: rate });
        else updateLabour(id, x.id, { rate });
      });
      return;
    }
    const first = (item.materials || []).find((m) => Number(m.quantity ?? 0) > 0);
    if (first) {
      const units = Number(first.quantity) * (1 + Number(first.wastePercent ?? 0) / 100);
      const r = round2(target / units);
      updateMaterial(id, first.id as number, Math.abs(r * units - target) < 0.005
        ? { sellingRate: r }
        : { quantity: 1, wastePercent: 0, sellingRate: target });
      return;
    }
    const qty = Number(item.quantity ?? 0) > 0 ? Number(item.quantity) : 1;
    const r = round2(target / qty);
    const even = Math.abs(r * qty - target) < 0.005;
    save("set the amount", () => boqApi.addMaterial(boqId, id, {
      product: item.productId ? { id: item.productId } : undefined,
      materialName: item.itemName || "Item", quantity: even ? qty : 1, unit: item.unit, wastePercent: 0,
      sellingRate: even ? r : target,
    }));
  };

  /**
   * Quantity edit, invoice-style: material / labour lines that were following the item's quantity
   * follow the new one too, so Amount stays Rate × Qty.
   */
  const updateQty = (item: BoqItem, v: number | null) => {
    if (v == null || v === item.quantity) return;
    const old = Number(item.quantity ?? 0);
    updateItem(item.id as number, { quantity: v });
    followQty(item, old, v);
  };
  const followQty = (item: BoqItem, oldQty: number, newQty: number) => {
    const id = item.id as number;
    item.materials?.forEach((m) => {
      if (Math.abs(Number(m.quantity ?? 0) - oldQty) < 0.005) updateMaterial(id, m.id as number, { quantity: newQty });
    });
    item.labours?.forEach((l) => {
      if (Math.abs(Number(l.quantity ?? 0) - oldQty) < 0.005) updateLabour(id, l.id as number, { quantity: newQty });
    });
  };

  /** Add a line with its price in one go: Rate × Qty becomes one price line on it. */
  const addPricedItem = (it: Partial<BoqItem>, rate: number) =>
    save("add the product", async () => {
      const created = await boqApi.addItem(boqId, it);
      if (rate > 0 && created?.id) {
        await boqApi.addMaterial(boqId, created.id, {
          product: it.productId ? { id: it.productId } : undefined,
          materialName: it.itemName || "Item", quantity: it.quantity ?? 1, unit: it.unit, wastePercent: 0, sellingRate: rate,
        });
      }
    });

  // ---------------- Catalogue ----------------

  const { list: savedCategories, byName: categoryByName, add: rememberCategory } = useCategories();
  const productIds = useMemo(
    () => (boq.items || []).map((i) => i.productId).filter((x): x is number => x != null),
    [boq.items],
  );
  const { products, remember: rememberProduct } = useLineProducts(productIds);

  const addProduct = (category: string, p: Product) => {
    rememberProduct(p);
    const color = colorsOf(p)[0];
    addPricedItem({
      category, itemName: p.name, productId: p.id, description: productSummary(p),
      imageUrl: color?.imageUrl || photosOf(p)[0] || undefined, color: color?.name,
      quantity: 1, unit: p.unit || "Nos",
    }, priceOf(p));
  };
  const addCustomProduct = (category: string, name: string) =>
    addPricedItem({ category, itemName: name, quantity: 1, unit: "Nos" }, 0);

  const pickColor = (item: BoqItem, name: string | null, c?: ProductColor) =>
    updateItem(item.id as number, c?.imageUrl ? { color: name, imageUrl: c.imageUrl } : { color: name });

  // ---------------- Derived view data ----------------

  const items = useMemo(() => [...(boq.items || [])].sort(compareItems), [boq.items]);

  // Categories added on this screen that have no product yet.
  const [extraCategories, setExtraCategories] = useState<string[]>([]);

  const groups: Group[] = useMemo(() => {
    const out: Group[] = [];
    for (const it of items) {
      const c = categoryOf(it);
      let g = out.find((x) => sameName(x.category, c));
      if (!g) { g = { category: c, items: [] }; out.push(g); }
      g.items.push(it);
    }
    extraCategories.forEach((c) => { if (!out.some((g) => sameName(g.category, c))) out.push({ category: c, items: [] }); });
    return out;
  }, [items, extraCategories]);
  const categoryNames = groups.map((g) => g.category);

  // Labour types seen in this BOQ (latest rate wins) + rates remembered from earlier BOQs.
  const labourRates = useMemo(() => {
    const map: Record<string, { label: string; rate: number }> = {};
    Object.entries(loadSavedRates()).forEach(([k, rate]) => { map[k] = { label: k.replace(/\b\w/g, (c) => c.toUpperCase()), rate }; });
    items.forEach((it) => it.labours?.forEach((l) => {
      if (l.workType && l.rate != null) map[l.workType.trim().toLowerCase()] = { label: l.workType, rate: l.rate };
    }));
    return map;
  }, [items]);
  const rateFor = (workType: string) => labourRates[workType.trim().toLowerCase()]?.rate;

  // Cost breakdown (material / labour lines) is for whoever prices the work — hidden by default.
  const [showLines, setShowLines] = useState(() => {
    try { return localStorage.getItem("quoteShowBreakdown") === "1"; } catch { return false; }
  });
  useEffect(() => { try { localStorage.setItem("quoteShowBreakdown", showLines ? "1" : "0"); } catch { /* ignore */ } }, [showLines]);
  const [bulk, setBulk] = useState<null | { mode: "labour" } | { mode: "copy"; targets: number[] }>(null);

  // The tick on each item is the customer's choice: ticked items are in the quote and its total.
  const setIncluded = (list: BoqItem[], on: boolean) => list
    .filter((i) => (i.isActive !== false) !== on)
    .forEach((i) => save("update the quote", () => boqApi.toggleItemActive(boqId, i.id as number, on)));
  const includedCount = items.filter((i) => i.isActive !== false).length;

  const groupTotal = (list: BoqItem[]) =>
    list.filter((i) => i.isActive !== false).reduce((s, i) => s + Number(i.amount ?? 0), 0);

  // Category being renamed in place (double-click its name, or ⋮ → Rename).
  const [renaming, setRenaming] = useState<string | null>(null);
  const renameCategory = (g: Group, typed: string) => {
    setRenaming(null);
    const next = typed.trim().slice(0, CATEGORY_MAX);
    if (!next || next === g.category) return;
    if (categoryNames.some((c) => c !== g.category && sameName(c, next))) {
      toast.error(`"${next}" is already on the quote.`);
      return;
    }
    setExtraCategories((l) => l.map((c) => (c === g.category ? next : c)));
    g.items.forEach((i) => updateItem(i.id as number, { category: next }));
  };
  const removeCategory = (g: Group) => {
    if (g.items.length > 0
      && !window.confirm(`Remove "${g.category}" and its ${g.items.length} product${g.items.length === 1 ? "" : "s"}?`)) return;
    setExtraCategories((l) => l.filter((c) => c !== g.category));
    g.items.forEach((i) => save("delete the product", () => boqApi.deleteItem(boqId, i.id as number)));
  };

  // ---------------- Render ----------------

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {canEdit ? <SaveState pending={pending} lastSaved={lastSaved} /> : <span>Locked — view only</span>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {items.length > 0 && (
            <span className="text-xs font-medium text-muted-foreground">
              {includedCount} of {items.length} in quote
              {canEdit && includedCount < items.length && (
                <button type="button" className="ml-1.5 text-primary hover:underline" onClick={() => setIncluded(items, true)}>tick all</button>
              )}
            </span>
          )}
          {canEdit && showLines && items.length > 1 && (
            <Button size="sm" variant="outline" onClick={() => setBulk({ mode: "labour" })}>
              <Hammer className="h-3.5 w-3.5 mr-1" /> Add labour to items…
            </Button>
          )}
          <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer select-none">
            <input type="checkbox" className="h-3.5 w-3.5 accent-primary" checked={showLines} onChange={(e) => setShowLines(e.target.checked)} />
            Show cost breakdown
          </label>
        </div>
      </div>

      <datalist id={LABOUR_TYPES_LIST}>
        {Object.values(labourRates).map((r) => <option key={r.label} value={r.label}>{`₹${r.rate}`}</option>)}
      </datalist>

      {groups.length === 0 && (
        <p className="rounded-xl border text-sm text-muted-foreground p-6 text-center">
          No products yet. {canEdit ? "Add a category, then pick its products." : ""}
        </p>
      )}

      {groups.map((g) => {
        const on = g.items.filter((i) => i.isActive !== false).length;
        const saved = categoryByName.get(g.category.trim().toLowerCase());
        return (
          // No overflow-hidden here: the product picker's dropdown must be able to spill out.
          <div key={g.category} className="rounded-xl border">
            {/* Category header */}
            <div className="flex items-center gap-2 rounded-t-xl bg-primary/[0.06] px-3 py-2">
              <input type="checkbox" className="h-4 w-4 accent-primary" disabled={!canEdit || g.items.length === 0}
                title="Whole category in the quote" aria-label={`${g.category} in quote`}
                ref={(el) => { if (el) el.indeterminate = on > 0 && on < g.items.length; }}
                checked={g.items.length > 0 && on === g.items.length} onChange={() => setIncluded(g.items, on !== g.items.length)} />
              {renaming === g.category ? (
                <CategoryNameInput value={g.category}
                  onCommit={(v) => renameCategory(g, v)} onCancel={() => setRenaming(null)} />
              ) : (
                <span className="flex-1 min-w-0 truncate text-sm font-bold uppercase tracking-wide text-primary">
                  <span
                    className={canEdit ? "cursor-text rounded px-0.5 -mx-0.5 hover:bg-primary/10" : ""}
                    title={canEdit ? "Double-click to rename" : undefined}
                    onDoubleClick={() => canEdit && setRenaming(g.category)}>
                    {g.category}
                  </span>
                  <span className="ml-2 text-xs font-normal normal-case tracking-normal text-muted-foreground">
                    {g.items.length} product{g.items.length === 1 ? "" : "s"}
                  </span>
                </span>
              )}
              <span className="text-sm font-bold tabular-nums">{inr(groupTotal(g.items))}</span>
              {canEdit && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center" aria-label="Category actions">
                      <MoreVertical className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
                    <DropdownMenuItem onClick={() => setRenaming(g.category)}><Pencil className="h-4 w-4 mr-2" /> Rename</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => removeCategory(g)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" /> Remove category</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {g.items.length > 0 && (
              <div className={`hidden md:grid ${ROW} items-center border-t bg-muted/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground`}>
                <span title="In the quote">✓</span>
                <span />
                <span>Product</span>
                <span className="text-right">Qty</span>
                <span>Unit</span>
                <span className="text-right">Rate ₹</span>
                <span className="text-right">Discount</span>
                <span className="text-right">Amount ₹</span>
                <span />
              </div>
            )}

            <div className="divide-y border-t">
              {g.items.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  product={item.productId != null ? products[item.productId] : undefined}
                  categories={categoryNames}
                  canEdit={canEdit}
                  showLines={showLines}
                  onUpdate={(patch) => updateItem(item.id as number, patch)}
                  onQty={(v) => updateQty(item, v)}
                  onSize={(f, v) => updateSize(item, f, v)}
                  onSetGross={(v) => setItemGross(item, v)}
                  onSetAmount={(v) => setItemGross(item, grossForNet(item, v))}
                  onColor={(name, c) => pickColor(item, name, c)}
                  onUpdateMaterial={(mid, patch) => updateMaterial(item.id as number, mid, patch)}
                  onUpdateLabour={(lid, patch) => updateLabour(item.id as number, lid, patch)}
                  rateFor={rateFor}
                  onDeleteMaterial={(mid) => save("remove the material", () => boqApi.deleteMaterial(boqId, item.id as number, mid))}
                  onDeleteLabour={(lid) => save("remove the labour", () => boqApi.deleteLabour(boqId, item.id as number, lid))}
                  onAddMaterial={(m) => save("add the material", () => boqApi.addMaterial(boqId, item.id as number, m))}
                  onAddLabour={(l) => { rememberRate(l.workType, l.rate); return save("add the labour", () => boqApi.addLabour(boqId, item.id as number, l)); }}
                  onDelete={() => {
                    if (!window.confirm(`Remove "${item.itemName}"?`)) return;
                    save("delete the product", () => boqApi.deleteItem(boqId, item.id as number));
                  }}
                  onToggleActive={() => save("update the quote", () => boqApi.toggleItemActive(boqId, item.id as number, item.isActive === false))}
                  onCopyFrom={() => setBulk({ mode: "copy", targets: [item.id as number] })}
                />
              ))}
            </div>
            {canEdit && (
              <div className="flex items-center gap-2 rounded-b-xl px-3 py-2 border-t bg-muted/10">
                <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
                <ProductPicker
                  categoryId={saved?.id}
                  categoryName={g.category}
                  onPick={(p) => addProduct(g.category, p)}
                  onCustom={(name) => addCustomProduct(g.category, name)}
                />
              </div>
            )}
          </div>
        );
      })}

      {canEdit && (
        <AddCategoryBar
          categories={savedCategories}
          used={categoryNames}
          onSaveCategory={rememberCategory}
          onAdd={(name) => setExtraCategories((l) => [...l, name.slice(0, CATEGORY_MAX)])}
        />
      )}

      <BulkDialog
        state={bulk}
        items={items}
        rateFor={rateFor}
        onClose={() => setBulk(null)}
        onAddLabour={(workType, rate, targetIds) => {
          const targets = items.filter((i) => targetIds.includes(i.id as number));
          rememberRate(workType, rate);
          targets.forEach((t) => save("add the labour", () =>
            boqApi.addLabour(boqId, t.id as number, { workType, quantity: t.quantity ?? 1, rate })));
          toast.success(`Labour added to ${targets.length} item(s)`);
          setBulk(null);
        }}
        onCopy={(sourceId, targetIds) => {
          const src = items.find((i) => i.id === sourceId);
          if (!src) return;
          for (const tid of targetIds) {
            if (tid === sourceId) continue;
            src.materials?.forEach((m) => save("copy the material", () => boqApi.addMaterial(boqId, tid, {
              product: m.product?.id ? { id: m.product.id } : undefined, materialName: m.materialName,
              quantity: m.quantity, unit: m.unit, wastePercent: m.wastePercent, costPrice: m.costPrice,
              sellingRate: m.sellingRate, vendor: m.vendor,
            })));
            src.labours?.forEach((l) => save("copy the labour", () => boqApi.addLabour(boqId, tid, {
              workType: l.workType, labourCategory: l.labourCategory, quantity: l.quantity, rate: l.rate,
              contractorName: l.contractorName,
            })));
          }
          toast.success(`Copied ${(src.materials?.length ?? 0) + (src.labours?.length ?? 0)} line(s) from ${src.itemName}`);
          setBulk(null);
        }}
      />
    </div>
  );
}

/** The category name as a text box: Enter or clicking away saves, Esc cancels. */
function CategoryNameInput({ value, onCommit, onCancel }: {
  value: string; onCommit: (v: string) => void; onCancel: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const done = useRef(false);
  const ref = useRef<HTMLInputElement>(null);
  // Opened from the ⋮ menu, the menu still holds focus while it closes — take it once it has.
  useEffect(() => {
    const grab = () => { if (ref.current && document.activeElement !== ref.current) { ref.current.focus(); ref.current.select(); } };
    const timers = [0, 120, 300].map((ms) => setTimeout(grab, ms));
    return () => timers.forEach(clearTimeout);
  }, []);
  const finish = (save: boolean) => {
    if (done.current) return;
    done.current = true;
    if (save) onCommit(draft); else onCancel();
  };
  return (
    <input
      ref={ref}
      autoFocus
      onFocus={(e) => e.currentTarget.select()}
      value={draft}
      maxLength={CATEGORY_MAX}
      aria-label="Category name"
      className="flex-1 min-w-0 h-7 rounded-md border border-primary bg-background px-2 text-sm font-bold uppercase tracking-wide text-primary outline-none ring-2 ring-primary/20"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); finish(true); }
        if (e.key === "Escape") { e.preventDefault(); finish(false); }
      }}
    />
  );
}

function SaveState({ pending, lastSaved }: { pending: number; lastSaved: number | null }) {
  if (pending > 0) return <span className="flex items-center gap-1"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</span>;
  if (lastSaved) return <span className="flex items-center gap-1 text-green-600"><Check className="h-3.5 w-3.5" /> All changes saved</span>;
  return <span>Type in any box — it saves by itself</span>;
}

// ---------------------------------------------------------------------------
// One product = one row: tick · photo · name, colour, location, description · qty · unit · rate ·
// discount · amount. Rate × Qty − discount = Amount; typing Rate or Amount sets the price. Size and
// the material / labour cost breakdown sit behind the chevron for whoever prices the work.
// ---------------------------------------------------------------------------

/** Desktop column layout shared by the header and every product row. */
const ROW = "md:grid md:grid-cols-[28px_48px_minmax(0,1fr)_72px_88px_100px_104px_112px_64px] md:gap-2";

/** Visible input styling for editable cells (the bare spreadsheet cells only show a border on hover). */
const FIELD = "!border-border !bg-background";

function ItemRow({
  item, product, categories, canEdit, showLines, onUpdate, onQty, onSize, onSetGross, onSetAmount, onColor,
  onUpdateMaterial, onUpdateLabour, onDeleteMaterial, onDeleteLabour, onAddMaterial, onAddLabour,
  onDelete, onToggleActive, onCopyFrom, rateFor,
}: {
  item: BoqItem;
  product?: Product;
  categories: string[];
  canEdit: boolean;
  showLines: boolean;
  onUpdate: (patch: Partial<BoqItem>) => void;
  onQty: (v: number | null) => void;
  onSize: (field: "length" | "width", v: number | null) => void;
  onSetGross: (target: number) => void;
  onSetAmount: (target: number) => void;
  onColor: (name: string | null, c?: ProductColor) => void;
  onUpdateMaterial: (id: number, patch: Partial<BoqItemMaterial>) => void;
  onUpdateLabour: (id: number, patch: Partial<BoqItemLabour>) => void;
  onDeleteMaterial: (id: number) => void;
  onDeleteLabour: (id: number) => void;
  onAddMaterial: (m: Partial<BoqItemMaterial>) => void;
  onAddLabour: (l: Partial<BoqItemLabour>) => void;
  onDelete: () => void;
  onToggleActive: () => void;
  onCopyFrom: () => void;
  rateFor: (workType: string) => number | undefined;
}) {
  const inactive = item.isActive === false;
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState<null | "material" | "labour">(null);
  const lineCount = (item.materials?.length ?? 0) + (item.labours?.length ?? 0);
  const qty = Number(item.quantity ?? 0);
  const gross = grossOf(item);
  const rate = qty > 0 ? Math.round((gross / qty) * 100) / 100 : gross;
  const f = canEdit ? FIELD : "";
  const detailsOpen = open || showLines;
  const photos = useMemo(() => {
    const all = [...photosOf(product), ...(item.imageUrl ? [item.imageUrl] : [])];
    return [...new Set(all)];
  }, [product, item.imageUrl]);

  return (
    <div className={inactive ? "bg-muted/40" : ""}>
      <div className={`grid grid-cols-[28px_48px_minmax(0,1fr)_auto] gap-x-2 gap-y-1.5 items-start px-3 py-2.5 ${ROW} md:items-start`}>
        {/* ✓ in quote */}
        <input type="checkbox" aria-label={`${item.itemName} in quote`} title="In the quote (customer's choice)"
          className="mt-3.5 h-4 w-4 accent-primary justify-self-center" disabled={!canEdit}
          checked={!inactive} onChange={onToggleActive} />

        {/* Photo */}
        <div className={inactive ? "opacity-60" : ""}>
          <ImageCell url={item.imageUrl} options={photos} disabled={!canEdit} onChange={(url) => onUpdate({ imageUrl: url })} />
        </div>

        {/* Product: name · colour · location · description */}
        <div className={`min-w-0 ${inactive ? "opacity-60" : ""}`}>
          <div className="flex items-center gap-1.5">
            <TextCell value={item.itemName} col="itemName" disabled={!canEdit} className={`font-medium ${f}`}
              onCommit={(v) => v && onUpdate({ itemName: v })} />
            {inactive && <span className="shrink-0 text-[10px] uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">Not in quote</span>}
            {item.productId == null && canEdit && (
              <span className="shrink-0 text-[10px] uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground" title="Not from the catalogue">Custom</span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 px-1">
            <ColorCell value={item.color} colors={colorsOf(product)} disabled={!canEdit} onChange={onColor} />
            <LocationBox value={item.location} fallback={item.roomName} disabled={!canEdit}
              onCommit={(v) => onUpdate({ location: v || null })} />
          </div>
          <DescriptionBox value={item.description} disabled={!canEdit}
            onCommit={(v) => onUpdate({ description: v || undefined })} />
        </div>

        {/* Actions (mobile: top-right) */}
        <div className="row-start-1 col-start-4 md:hidden flex items-center">
          <RowActions canEdit={canEdit} open={detailsOpen} lineCount={lineCount} onToggle={() => setOpen((v) => !v)}
            onAddMaterial={() => { setOpen(true); setAdding("material"); }} onAddLabour={() => { setOpen(true); setAdding("labour"); }}
            onCopyFrom={onCopyFrom} onDelete={onDelete} />
        </div>

        {/* Numbers — a labelled grid on phones, table cells on desktop */}
        <div className="col-span-4 col-start-1 md:col-span-1 md:col-start-auto grid grid-cols-2 gap-2 md:contents pl-[36px] md:pl-0">
          <Cell label="Qty">
            <NumCell value={item.quantity} col="qty" disabled={!canEdit} className={f} onCommit={onQty} />
          </Cell>
          <Cell label="Unit">
            <SelectCell value={item.unit} options={BOQ_UNITS} disabled={!canEdit} className={f} onCommit={(v) => onUpdate({ unit: v })} />
          </Cell>
          <Cell label="Rate ₹">
            <NumCell value={rate} col="rate" disabled={!canEdit} className={f}
              onCommit={(v) => v != null && onSetGross(Math.round(v * (qty > 0 ? qty : 1) * 100) / 100)} />
          </Cell>
          <Cell label="Discount">
            <DiscountCell type={item.discountType} value={item.discountValue} amount={item.discountAmount} disabled={!canEdit}
              onChange={(type, value) => onUpdate({ discountType: type, discountValue: value })} />
          </Cell>
          <Cell label="Amount ₹" className="col-span-2 md:col-span-1">
            <NumCell value={item.amount} col="amount" disabled={!canEdit}
              className={`font-semibold ${canEdit ? "!border-primary/40 !bg-primary/[0.04]" : ""}`}
              onCommit={(v) => v != null && onSetAmount(v)} />
          </Cell>
        </div>

        <div className="hidden md:flex items-center justify-end pt-1.5">
          <RowActions canEdit={canEdit} open={detailsOpen} lineCount={lineCount} onToggle={() => setOpen((v) => !v)}
            onAddMaterial={() => { setOpen(true); setAdding("material"); }} onAddLabour={() => { setOpen(true); setAdding("labour"); }}
            onCopyFrom={onCopyFrom} onDelete={onDelete} />
        </div>
      </div>

      {/* ---- Details: category, size, and the material / labour behind the price ---- */}
      {detailsOpen && (
        <div className="mx-3 mb-3 md:ml-[92px] rounded-lg bg-muted/40 p-2 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 px-1 text-xs text-muted-foreground">
            <span>Cost breakdown</span>
            <span>·</span>
            <span className="flex items-center gap-1">Category
              <SelectCell value={item.category} options={categories} disabled={!canEdit}
                className="h-6 w-auto rounded-full bg-background px-2 text-[11px]" onCommit={(v) => onUpdate({ category: v })} />
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">Size
              <span className="w-16"><NumCell value={item.length} col="length" placeholder="L" disabled={!canEdit} className={`h-6 text-center text-xs ${f}`} onCommit={(v) => onSize("length", v)} /></span>
              ×
              <span className="w-16"><NumCell value={item.width} col="width" placeholder="W" disabled={!canEdit} className={`h-6 text-center text-xs ${f}`} onCommit={(v) => onSize("width", v)} /></span>
            </span>
          </div>
          {lineCount === 0 && !adding && (
            <p className="px-1 text-xs text-muted-foreground">
              No material or labour lines — the amount is a single price{canEdit ? ". Add lines to build it up." : "."}
            </p>
          )}
          {item.materials?.map((m) => (
            <MaterialLine key={m.id} m={m} canEdit={canEdit}
              onUpdate={(patch) => onUpdateMaterial(m.id as number, patch)}
              onDelete={() => onDeleteMaterial(m.id as number)} />
          ))}
          {item.labours?.map((l) => (
            <LabourLine key={l.id} l={l} canEdit={canEdit} rateFor={rateFor}
              onUpdate={(patch) => onUpdateLabour(l.id as number, patch)}
              onDelete={() => onDeleteLabour(l.id as number)} />
          ))}

          {adding === "material" && (
            <div className="flex items-center gap-2 rounded-md bg-background p-1.5">
              <Package className="h-4 w-4 text-sky-600 shrink-0" />
              <ProductSearch
                autoFocus
                onCancel={() => setAdding(null)}
                onPick={(p: ProductRef) => onAddMaterial({
                  product: { id: p.id }, materialName: p.name || "Material",
                  quantity: item.quantity ?? 1, unit: p.unit || item.unit, wastePercent: 0,
                  sellingRate: p.sellingPrice ?? p.price ?? 0,
                })}
                onCustom={(name) => onAddMaterial({ materialName: name, quantity: item.quantity ?? 1, unit: item.unit, wastePercent: 0, sellingRate: 0 })}
              />
              <Button size="sm" variant="ghost" onClick={() => setAdding(null)}>Done</Button>
            </div>
          )}
          {adding === "labour" && (
            <NewLabourRow defaultQty={item.quantity ?? 1} rateFor={rateFor} onAdd={onAddLabour} onDone={() => setAdding(null)} />
          )}

          {canEdit && !adding && (
            <div className="flex flex-wrap gap-2 pt-0.5">
              <button type="button" onClick={() => setAdding("material")}
                className="text-xs font-medium text-sky-700 border border-sky-200 bg-background hover:bg-sky-50 rounded-full px-3 py-1 flex items-center gap-1">
                <Plus className="h-3.5 w-3.5" /> Material
              </button>
              <button type="button" onClick={() => setAdding("labour")}
                className="text-xs font-medium text-amber-700 border border-amber-200 bg-background hover:bg-amber-50 rounded-full px-3 py-1 flex items-center gap-1">
                <Plus className="h-3.5 w-3.5" /> Labour
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Optional "where it goes" note. Older room-based lines show their room as the hint. */
function LocationBox({ value, fallback, disabled, onCommit }: {
  value?: string | null; fallback?: string | null; disabled: boolean; onCommit: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => setDraft(value ?? ""), [value]);
  if (disabled) {
    const shown = value || fallback;
    return shown ? <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{shown}</span> : null;
  }
  return (
    <span className="inline-flex items-center gap-0.5">
      <MapPin className="h-3 w-3 text-muted-foreground" />
      <input value={draft} placeholder={fallback || "Location (optional)"} aria-label="Location"
        title="Where it goes, e.g. Hall window — shows on the quotation"
        className="h-7 w-40 rounded-md border border-transparent bg-transparent px-1.5 text-xs outline-none hover:border-border focus:border-primary focus:bg-background"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft.trim() !== (value ?? "").trim() && onCommit(draft.trim())}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setDraft(value ?? ""); e.currentTarget.blur(); } }} />
    </span>
  );
}

/** "Details" toggle + ⋮ menu for one item row. */
function RowActions({ canEdit, open, lineCount, onToggle, onAddMaterial, onAddLabour, onCopyFrom, onDelete }: {
  canEdit: boolean; open: boolean; lineCount: number; onToggle: () => void;
  onAddMaterial: () => void; onAddLabour: () => void; onCopyFrom: () => void; onDelete: () => void;
}) {
  return (
    <>
      <button type="button" onClick={onToggle} title={open ? "Hide cost breakdown" : "Show cost breakdown"}
        className={`h-8 px-1.5 rounded-md text-xs flex items-center gap-0.5 hover:bg-muted ${open ? "text-primary" : "text-muted-foreground"}`}>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        {lineCount > 0 && <span className="tabular-nums">{lineCount}</span>}
      </button>
      {canEdit && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="h-8 w-7 rounded-md hover:bg-muted flex items-center justify-center" aria-label="Item actions">
              <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onAddMaterial}><Package className="h-4 w-4 mr-2" /> Add material</DropdownMenuItem>
            <DropdownMenuItem onClick={onAddLabour}><Hammer className="h-4 w-4 mr-2" /> Add labour</DropdownMenuItem>
            <DropdownMenuItem onClick={onCopyFrom}><Copy className="h-4 w-4 mr-2" /> Copy lines from another item…</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" /> Delete item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  );
}

/** A table cell on desktop; a labelled field on phones. */
function Cell({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <span className="md:hidden block text-[10px] font-medium uppercase text-muted-foreground mb-0.5">{label}</span>
      {children}
    </div>
  );
}

/** Item description under the name: quiet until you click it; grows with its text; saves on blur. */
function DescriptionBox({ value, disabled, onCommit }: {
  value?: string | null; disabled: boolean; onCommit: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => { setDraft(value ?? ""); }, [value]);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; };
    fit();
    // Re-fit when the column width changes (window resize, layout switching to/from phone).
    let width = el.offsetWidth;
    const ro = new ResizeObserver(() => { if (el.offsetWidth !== width) { width = el.offsetWidth; fit(); } });
    ro.observe(el);
    return () => ro.disconnect();
  }, [draft]);
  if (disabled && !value) return null;
  return (
    <textarea ref={ref} rows={1} value={draft} disabled={disabled}
      placeholder="+ Add description"
      title="Shows on the quotation, print and PDF"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft.trim() !== (value ?? "").trim() && onCommit(draft.trim())}
      onKeyDown={(e) => { if (e.key === "Escape") { setDraft(value ?? ""); e.currentTarget.blur(); } }}
      className="mt-0.5 w-full resize-none overflow-hidden rounded-md border border-transparent bg-transparent px-2 py-1 text-xs leading-snug text-muted-foreground outline-none hover:border-border focus:border-primary focus:bg-background focus:text-foreground focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/70 disabled:hover:border-transparent" />
  );
}

/** Small inline label between fields ("×", "waste", "="). */
const Op = ({ children }: { children: React.ReactNode }) => (
  <span className="text-xs text-muted-foreground shrink-0">{children}</span>
);

function MaterialLine({ m, canEdit, onUpdate, onDelete }: {
  m: BoqItemMaterial; canEdit: boolean;
  onUpdate: (patch: Partial<BoqItemMaterial>) => void; onDelete: () => void;
}) {
  const [qtyDraft, setQtyDraft] = useState<number | null | undefined>();
  const [wasteDraft, setWasteDraft] = useState<number | null | undefined>();
  const [rateDraft, setRateDraft] = useState<number | null | undefined>();
  const qty = qtyDraft !== undefined ? qtyDraft : m.quantity;
  const waste = wasteDraft !== undefined ? wasteDraft : m.wastePercent;
  const rate = rateDraft !== undefined ? rateDraft : m.sellingRate;
  // Same formula as the server (qty × (1 + waste%) × rate), so the line total moves as you type.
  const live = (qty ?? 0) * (1 + (waste ?? 0) / 100) * (rate ?? 0);
  const f = canEdit ? FIELD : "";

  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-md bg-background px-2 py-1.5">
      <span className="flex items-center gap-1.5 min-w-[10rem] flex-1">
        <Package className="h-4 w-4 text-sky-600 shrink-0" aria-label="Material" />
        <span className="flex-1 min-w-0">
          <TextCell value={m.materialName} col="matName" disabled={!canEdit} className={`h-8 ${f}`}
            onCommit={(v) => v && onUpdate({ materialName: v })} />
          {m.stockWarning && <span className="block text-[10px] text-amber-700 px-2">{m.stockWarning}</span>}
        </span>
      </span>
      <span className="flex flex-wrap items-center gap-1.5 ml-auto">
        <span className="w-20"><NumCell value={m.quantity} col="matQty" placeholder="qty" disabled={!canEdit} className={f} onDraft={setQtyDraft} onCommit={(v) => onUpdate({ quantity: v ?? 0 })} /></span>
        <span className="w-24"><SelectCell value={m.unit} options={BOQ_UNITS} disabled={!canEdit} className={f} onCommit={(v) => onUpdate({ unit: v })} /></span>
        <Op>× ₹</Op>
        <span className="w-24"><NumCell value={m.sellingRate} col="matRate" placeholder="rate" disabled={!canEdit} className={f} onDraft={setRateDraft} onCommit={(v) => onUpdate({ sellingRate: v ?? 0 })} /></span>
        <Op>+</Op>
        <span className="w-14"><NumCell value={m.wastePercent} col="matWaste" placeholder="0" disabled={!canEdit} className={f} onDraft={setWasteDraft} onCommit={(v) => onUpdate({ wastePercent: v ?? 0 })} /></span>
        <Op>% waste =</Op>
        <span className="min-w-[5.5rem] text-right text-sm font-semibold tabular-nums">{inr(live)}</span>
        <LineDelete canEdit={canEdit} onDelete={onDelete} />
      </span>
    </div>
  );
}

function LabourLine({ l, canEdit, onUpdate, onDelete, rateFor }: {
  l: BoqItemLabour; canEdit: boolean;
  onUpdate: (patch: Partial<BoqItemLabour>) => void; onDelete: () => void;
  rateFor: (workType: string) => number | undefined;
}) {
  const [qtyDraft, setQtyDraft] = useState<number | null | undefined>();
  const [rateDraft, setRateDraft] = useState<number | null | undefined>();
  const live = (qtyDraft !== undefined ? qtyDraft ?? 0 : l.quantity ?? 0) * (rateDraft !== undefined ? rateDraft ?? 0 : l.rate ?? 0);
  const f = canEdit ? FIELD : "";

  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-md bg-background px-2 py-1.5">
      <span className="flex items-center gap-1.5 min-w-[10rem] flex-1">
        <Hammer className="h-4 w-4 text-amber-600 shrink-0" aria-label="Labour" />
        <span className="flex-1 min-w-0">
          <TextCell value={l.workType} col="labType" list={LABOUR_TYPES_LIST} disabled={!canEdit} className={`h-8 ${f}`}
            placeholder="Work type"
            onCommit={(v) => {
              // Picking a known work type on a line with no rate fills in the rate you last used.
              const known = rateFor(v);
              onUpdate(!l.rate && known != null ? { workType: v, rate: known } : { workType: v });
            }} />
        </span>
        <span className="w-36 hidden sm:block">
          <TextCell value={l.contractorName} col="labWho" placeholder="Contractor (optional)" disabled={!canEdit} className={`h-8 text-xs ${f}`}
            onCommit={(v) => onUpdate({ contractorName: v || undefined })} />
        </span>
      </span>
      <span className="flex flex-wrap items-center gap-1.5 ml-auto">
        <span className="w-20"><NumCell value={l.quantity} col="labQty" placeholder="qty" disabled={!canEdit} className={f} onDraft={setQtyDraft} onCommit={(v) => onUpdate({ quantity: v ?? 0 })} /></span>
        <Op>× ₹</Op>
        <span className="w-24"><NumCell value={l.rate} col="labRate" placeholder="rate" disabled={!canEdit} className={f} onDraft={setRateDraft} onCommit={(v) => onUpdate({ rate: v ?? 0 })} /></span>
        <Op>=</Op>
        <span className="min-w-[5.5rem] text-right text-sm font-semibold tabular-nums">{inr(live)}</span>
        <LineDelete canEdit={canEdit} onDelete={onDelete} />
      </span>
    </div>
  );
}

function LineDelete({ canEdit, onDelete }: { canEdit: boolean; onDelete: () => void }) {
  if (!canEdit) return <span className="w-7" />;
  return (
    <button type="button" onClick={onDelete} aria-label="Remove line"
      className="h-7 w-7 rounded hover:bg-destructive/10 flex items-center justify-center shrink-0">
      <Trash2 className="h-3.5 w-3.5 text-destructive" />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Inline "add" rows
// ---------------------------------------------------------------------------

function NewLabourRow({ defaultQty, rateFor, onAdd, onDone }: {
  defaultQty: number;
  rateFor: (workType: string) => number | undefined;
  onAdd: (l: Partial<BoqItemLabour>) => void;
  onDone: () => void;
}) {
  const [workType, setWorkType] = useState("");
  const [qty, setQty] = useState(String(defaultQty));
  const [rate, setRate] = useState("");
  const typeRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const wt = workType.trim() || "Labour";
    onAdd({ workType: wt, quantity: Number(qty) || 0, rate: Number(rate) || 0 });
    // Stay open for the next line — type, Enter, type, Enter.
    setWorkType(""); setRate(""); setQty(String(defaultQty));
    typeRef.current?.focus();
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); submit(); }
    if (e.key === "Escape") onDone();
  };

  return (
    <div className="flex flex-wrap items-center gap-2 py-1">
      <Hammer className="h-3.5 w-3.5 text-amber-600 shrink-0" />
      <Input ref={typeRef} autoFocus list={LABOUR_TYPES_LIST} placeholder="Work type (e.g. Carpenter)" className="h-8 flex-1 min-w-[10rem]"
        value={workType}
        onChange={(e) => {
          setWorkType(e.target.value);
          const known = rateFor(e.target.value);
          if (known != null && !rate) setRate(String(known));
        }}
        onKeyDown={onKey} />
      <Input inputMode="decimal" placeholder="Qty" className="h-8 w-20 text-right" value={qty} onChange={(e) => setQty(e.target.value)} onKeyDown={onKey} />
      <Input inputMode="decimal" placeholder="Rate ₹" className="h-8 w-24 text-right" value={rate} onChange={(e) => setRate(e.target.value)} onKeyDown={onKey} />
      <Button size="sm" onClick={submit}>Add</Button>
      <Button size="sm" variant="ghost" onClick={onDone}>Done</Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bulk actions: add one labour line to many items / copy lines from one item to others
// ---------------------------------------------------------------------------

function BulkDialog({
  state, items, rateFor, onClose, onAddLabour, onCopy,
}: {
  state: null | { mode: "labour" } | { mode: "copy"; targets: number[] };
  items: BoqItem[];
  rateFor: (workType: string) => number | undefined;
  onClose: () => void;
  onAddLabour: (workType: string, rate: number, targetIds: number[]) => void;
  onCopy: (sourceId: number, targetIds: number[]) => void;
}) {
  const [workType, setWorkType] = useState("");
  const [rate, setRate] = useState("");
  const [sourceId, setSourceId] = useState<number | "">("");
  // Labour targets: every item in the quote, untick the ones that don't need it.
  const [picked, setPicked] = useState<Set<number>>(new Set());
  useEffect(() => {
    setWorkType(""); setRate(""); setSourceId("");
    setPicked(new Set(items.filter((i) => i.isActive !== false).map((i) => i.id as number)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const targets = state?.mode === "copy" ? state.targets : [];
  const sources = items.filter((i) => !targets.includes(i.id as number) && ((i.materials?.length ?? 0) + (i.labours?.length ?? 0)) > 0);
  const src = items.find((i) => i.id === sourceId);

  return (
    <Dialog open={!!state} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        {state?.mode === "labour" && (
          <>
            <DialogHeader><DialogTitle>Add labour to {picked.size} item(s)</DialogTitle></DialogHeader>
            <p className="text-xs text-muted-foreground">Each ticked item gets one labour line, with quantity taken from that item's own quantity.</p>
            <div className="max-h-48 overflow-auto rounded-md border divide-y text-sm">
              {items.map((i) => (
                <label key={i.id} className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-muted/40">
                  <input type="checkbox" className="h-4 w-4 accent-primary" checked={picked.has(i.id as number)}
                    onChange={() => setPicked((s) => { const n = new Set(s); n.has(i.id as number) ? n.delete(i.id as number) : n.add(i.id as number); return n; })} />
                  <span className="truncate">{[i.category, i.itemName].filter(Boolean).join(" › ")}</span>
                </label>
              ))}
            </div>
            <div className="grid grid-cols-[1fr_120px] gap-2">
              <Input autoFocus list={LABOUR_TYPES_LIST} placeholder="Work type (e.g. Painter)" value={workType}
                onChange={(e) => { setWorkType(e.target.value); const k = rateFor(e.target.value); if (k != null && !rate) setRate(String(k)); }} />
              <Input inputMode="decimal" placeholder="Rate ₹ / unit" value={rate} onChange={(e) => setRate(e.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button disabled={!workType.trim() || picked.size === 0} onClick={() => onAddLabour(workType.trim(), Number(rate) || 0, [...picked])}>Add</Button>
            </DialogFooter>
          </>
        )}
        {state?.mode === "copy" && (
          <>
            <DialogHeader>
              <DialogTitle>Copy material & labour {targets.length > 1 ? `into ${targets.length} items` : "into this item"}</DialogTitle>
            </DialogHeader>
            {sources.length === 0 ? (
              <p className="text-sm text-muted-foreground">No other item has material or labour lines to copy yet.</p>
            ) : (
              <>
                <select className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={sourceId}
                  onChange={(e) => setSourceId(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">Copy from…</option>
                  {sources.map((i) => (
                    <option key={i.id} value={i.id}>
                      {[i.category, i.itemName].filter(Boolean).join(" › ")} ({(i.materials?.length ?? 0) + (i.labours?.length ?? 0)} lines)
                    </option>
                  ))}
                </select>
                {src && (
                  <div className="rounded-md border bg-muted/30 p-2 text-xs space-y-0.5 max-h-48 overflow-auto">
                    {src.materials?.map((m) => <div key={`m${m.id}`}>📦 {m.materialName} — {m.quantity} {m.unit} × ₹{m.sellingRate}</div>)}
                    {src.labours?.map((l) => <div key={`l${l.id}`}>🔨 {l.workType} — {l.quantity} × ₹{l.rate}</div>)}
                  </div>
                )}
              </>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button disabled={!src} onClick={() => src && onCopy(src.id as number, targets)}>Copy lines</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}


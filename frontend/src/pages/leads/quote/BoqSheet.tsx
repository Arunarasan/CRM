import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, ChevronRight, FolderOpen, Hammer, Layers, Loader2, MapPin, MoreVertical, Package, PackageSearch, Pencil, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
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

/**
 * The single price line an item gets when its Rate / Amount is typed straight in (same name or qty
 * as the item, no waste, nothing else under it). It only repeats the row above, so it stays hidden
 * until the price is built up from more than one line.
 */
function priceLineOf(i: BoqItem): BoqItemMaterial | null {
  if ((i.labours?.length ?? 0) > 0 || (i.materials?.length ?? 0) !== 1) return null;
  const m = i.materials![0];
  if (Number(m.wastePercent ?? 0) !== 0) return null;
  const sameNameAsItem = sameName(m.materialName || "", i.itemName || "") || m.materialName === "Item";
  const sameQty = Math.abs(Number(m.quantity ?? 0) - Number(i.quantity ?? 0)) < 0.005 || Number(m.quantity ?? 0) === 1;
  return sameNameAsItem && sameQty ? m : null;
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
  boq, canEdit, onBoqChanged, showBreakdown, onSaveState, actionsTarget,
}: {
  /** The page's tab bar slot for "Add from Inventory" / "Add Item" (rendered there via a portal). */
  actionsTarget?: HTMLElement | null;
  boq: Boq;
  canEdit: boolean;
  onBoqChanged: (b: Boq) => void;
  /** Set by the page's Items / Cost Breakdown tabs; left out, the sheet shows its own toggle. */
  showBreakdown?: boolean;
  /** The page shows the autosave state itself (header); left out, the sheet's toolbar shows it. */
  onSaveState?: (pending: number, lastSaved: number | null) => void;
}) {
  const boqId = boq.id as number;
  const latest = useRef(boq);
  useEffect(() => { latest.current = boq; }, [boq]);

  // All saves run one after another: the item/material/labour updates are full-replace, so two
  // overlapping saves built from the same snapshot would undo each other.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const [pending, setPending] = useState(0);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const reportSave = useRef(onSaveState);
  reportSave.current = onSaveState;
  useEffect(() => { reportSave.current?.(pending, lastSaved); }, [pending, lastSaved]);

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

  /** Category-level labour (e.g. "Fitting — whole wall"): its own line, priced by one labour line. */
  const addLabourItem = (category: string, workType: string, qty: number, unit: string, rate: number) =>
    save("add the labour", async () => {
      const created = await boqApi.addItem(boqId, { category, itemName: workType, quantity: qty, unit });
      rememberRate(workType, rate);
      if (rate > 0 && created?.id) await boqApi.addLabour(boqId, created.id, { workType, quantity: qty, rate });
    });

  // ---------------- Catalogue ----------------

  const { list: savedCategories, byName: categoryByName, add: rememberCategory } = useCategories();
  const productIds = useMemo(
    () => (boq.items || []).map((i) => i.productId).filter((x): x is number => x != null),
    [boq.items],
  );
  const { products, remember: rememberProduct } = useLineProducts(productIds);

  /** The table's empty last row: whatever was typed (catalogue product or custom name) becomes a line. */
  const addRow = (category: string, d: NewRowDraft) => {
    const p = d.product;
    if (p) rememberProduct(p);
    const color = p ? colorsOf(p)[0] : undefined;
    return addPricedItem({
      category, itemName: d.name.trim(), productId: p?.id,
      description: p ? productSummary(p) : undefined,
      imageUrl: p ? color?.imageUrl || photosOf(p)[0] || undefined : undefined, color: color?.name,
      quantity: d.qty > 0 ? d.qty : 1, unit: d.unit || "Nos",
    }, d.rate);
  };

  const pickColor = (item: BoqItem, name: string | null, c?: ProductColor) =>
    updateItem(item.id as number, c?.imageUrl ? { color: name, imageUrl: c.imageUrl } : { color: name });

  // Rows removed on screen but not yet on the server: the toast's Undo brings them back.
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const deleteWithUndo = (item: BoqItem) => {
    const id = item.id as number;
    setHidden((h) => new Set(h).add(id));
    let undone = false;
    const unhide = () => setHidden((h) => { const n = new Set(h); n.delete(id); return n; });
    toast.withAction(`Removed "${item.itemName}"`, { label: "Undo", onClick: () => { undone = true; unhide(); } });
    window.setTimeout(() => {
      if (undone) return;
      save("delete the product", () => boqApi.deleteItem(boqId, id)).then(unhide);
    }, 8000);
  };

  // ---------------- Derived view data ----------------

  const items = useMemo(
    () => [...(boq.items || [])].filter((i) => !hidden.has(i.id as number)).sort(compareItems),
    [boq.items, hidden],
  );

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
  const [ownShowLines, setShowLines] = useState(() => {
    try { return localStorage.getItem("quoteShowBreakdown") === "1"; } catch { return false; }
  });
  useEffect(() => { try { localStorage.setItem("quoteShowBreakdown", ownShowLines ? "1" : "0"); } catch { /* ignore */ } }, [ownShowLines]);
  const showLines = showBreakdown ?? ownShowLines;
  // Categories folded shut (header only) — a view preference, not saved.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleCollapsed = (c: string) => setCollapsed((cur) => {
    const next = new Set(cur);
    if (next.has(c)) next.delete(c); else next.add(c);
    return next;
  });
  const [bulk, setBulk] = useState<null | { mode: "labour" }>(null);
  // Category ⋮ → Add material / Add labour: a line of its own in that category.
  const [catLine, setCatLine] = useState<null | { category: string; kind: "material" | "labour" }>(null);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [newCategorySignal, setNewCategorySignal] = useState(0);
  /** "Add Item": jump to a category's empty last row and put the cursor in it. */
  const focusNewRow = (category?: string) => {
    const target = category ?? groups[groups.length - 1]?.category;
    if (!target) { setNewCategorySignal((n) => n + 1); return; }
    setCollapsed((cur) => { const n = new Set(cur); n.delete(target); return n; });
    setTimeout(() => {
      const row = [...document.querySelectorAll<HTMLElement>("[data-newrow]")].find((el) => el.dataset.newrow === target);
      row?.scrollIntoView({ block: "center", behavior: "smooth" });
      row?.querySelector("input")?.focus();
    }, 50);
  };

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
    // A container: the item table switches to its desktop columns by the room it actually has
    // (sidebar open, summary panel beside it, project page…), not by the screen width.
    <div className="@container space-y-3">
      {(!canEdit || !onSaveState || showBreakdown === undefined) && (
        <div className="flex flex-wrap items-center gap-3 justify-between text-xs text-muted-foreground">
          {!canEdit ? <span>Locked — view only</span> : !onSaveState ? <SaveState pending={pending} lastSaved={lastSaved} /> : <span />}
          {showBreakdown === undefined && (
            <label className="flex items-center gap-1.5 font-medium cursor-pointer select-none">
              <input type="checkbox" className="h-3.5 w-3.5 accent-primary" checked={showLines} onChange={(e) => setShowLines(e.target.checked)} />
              Show cost breakdown
            </label>
          )}
        </div>
      )}

      {/* "Add from Inventory" · "Add Item ▾" — in the page's tab bar when it gives a slot, else here */}
      {canEdit && (() => {
        const actions = (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-8" onClick={() => setInventoryOpen(true)}>
              <PackageSearch className="h-4 w-4" /> Add from Inventory
            </Button>
            <div className="inline-flex">
              <Button size="sm" className="h-8 rounded-r-none bg-[#1F5C3F] hover:bg-[#184A33] text-white" onClick={() => focusNewRow()}>
                <Plus className="h-4 w-4" /> Add Item
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="h-8 rounded-l-none border-l border-white/20 px-2 bg-[#1F5C3F] hover:bg-[#184A33] text-white" aria-label="More ways to add">
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  {groups.map((g) => (
                    <DropdownMenuItem key={g.category} onClick={() => focusNewRow(g.category)}>
                      <Plus className="h-4 w-4 mr-2" /> Add to {g.category}
                    </DropdownMenuItem>
                  ))}
                  {groups.length > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuItem onClick={() => setNewCategorySignal((n) => n + 1)}><Layers className="h-4 w-4 mr-2" /> New category</DropdownMenuItem>
                  {items.length > 1 && (
                    <DropdownMenuItem onClick={() => setBulk({ mode: "labour" })}><Hammer className="h-4 w-4 mr-2" /> Add labour to several products…</DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        );
        return actionsTarget ? createPortal(actions, actionsTarget) : <div className="flex justify-end">{actions}</div>;
      })()}

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
        const folded = collapsed.has(g.category);
        return (
          // No overflow-hidden here: the product picker's dropdown must be able to spill out.
          <div key={g.category} className="rounded-lg border bg-card">
            {/* Category header */}
            <div className={`flex items-center gap-2 bg-muted px-3 py-2.5 ${folded ? "rounded-lg" : "rounded-t-lg"}`}>
              <button type="button" onClick={() => toggleCollapsed(g.category)}
                aria-label={folded ? `Show ${g.category}` : `Hide ${g.category}`} aria-expanded={!folded}
                className="h-6 w-6 -ml-1 rounded-md hover:bg-primary/10 flex items-center justify-center text-muted-foreground">
                {folded ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              <input type="checkbox" className="h-4 w-4 accent-primary @[820px]:hidden" disabled={!canEdit || g.items.length === 0}
                title="Whole category in the quote" aria-label={`${g.category} in quote`}
                ref={(el) => { if (el) el.indeterminate = on > 0 && on < g.items.length; }}
                checked={g.items.length > 0 && on === g.items.length} onChange={() => setIncluded(g.items, on !== g.items.length)} />
              {renaming === g.category ? (
                <CategoryNameInput value={g.category}
                  onCommit={(v) => renameCategory(g, v)} onCancel={() => setRenaming(null)} />
              ) : (
                <span className="flex-1 min-w-0 truncate text-sm font-bold uppercase tracking-wide">
                  <FolderOpen className="inline h-[18px] w-[18px] mr-2 -mt-0.5 text-[#D97706]" aria-hidden />
                  <span
                    className={canEdit ? "cursor-text rounded px-0.5 -mx-0.5 hover:bg-primary/10" : ""}
                    title={canEdit ? "Double-click to rename" : undefined}
                    onDoubleClick={() => canEdit && setRenaming(g.category)}>
                    {g.category}
                  </span>
                  <span className="ml-3 text-sm font-normal normal-case tracking-normal text-muted-foreground">
                    {g.items.length} item{g.items.length === 1 ? "" : "s"}
                  </span>
                </span>
              )}
              <span className="hidden sm:inline text-sm text-muted-foreground">Category total:</span>
              <span className="text-sm font-bold tabular-nums">{inr(groupTotal(g.items))}</span>
              {canEdit && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center" aria-label="Category actions">
                      <MoreVertical className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
                    <DropdownMenuItem onClick={() => setCatLine({ category: g.category, kind: "material" })}><Package className="h-4 w-4 mr-2" /> Add material</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setCatLine({ category: g.category, kind: "labour" })}><Hammer className="h-4 w-4 mr-2" /> Add labour</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setRenaming(g.category)}><Pencil className="h-4 w-4 mr-2" /> Rename</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => removeCategory(g)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" /> Remove category</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {!folded && (g.items.length > 0 || canEdit) && (
              <div className={`hidden @[820px]:grid ${ROW} items-center border-t px-3 py-2 text-sm text-muted-foreground`}>
                <input type="checkbox" className="h-4 w-4 accent-primary justify-self-center" disabled={!canEdit || g.items.length === 0}
                  title="Whole category in the quote" aria-label={`${g.category} in quote`}
                  ref={(el) => { if (el) el.indeterminate = on > 0 && on < g.items.length; }}
                  checked={g.items.length > 0 && on === g.items.length} onChange={() => setIncluded(g.items, on !== g.items.length)} />
                <span className="text-center">#</span>
                <span className="col-span-2">Product</span>
                <span className="hidden @[1000px]:block">Description</span>
                <span className="text-right pr-2">Qty</span>
                <span className="pl-2">Unit</span>
                <span className="text-right pr-2">Rate (₹)</span>
                <span className="pl-2">Disc.</span>
                <span className="text-right pr-2">Amount (₹)</span>
                <span />
              </div>
            )}

            {!folded && <div className="divide-y border-t">
              {g.items.map((item, idx) => (
                <ItemRow
                  key={item.id}
                  index={idx + 1}
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
                  onDelete={() => deleteWithUndo(item)}
                  onToggleActive={() => save("update the quote", () => boqApi.toggleItemActive(boqId, item.id as number, item.isActive === false))}
                />
              ))}
            </div>}
            {!folded && canEdit && (
              <NewItemRow key={`new-${g.category}`} categoryId={saved?.id} categoryName={g.category} first={g.items.length === 0}
                onAdd={(d) => addRow(g.category, d)} />
            )}
          </div>
        );
      })}

      {canEdit && (
        <AddCategoryBar
          openSignal={newCategorySignal}
          categories={savedCategories}
          used={categoryNames}
          onSaveCategory={rememberCategory}
          onAdd={(name) => setExtraCategories((l) => [...l, name.slice(0, CATEGORY_MAX)])}
        />
      )}

      <InventoryDialog
        open={inventoryOpen}
        categories={categoryNames}
        categoryId={(c) => categoryByName.get(c.trim().toLowerCase())?.id}
        onClose={() => setInventoryOpen(false)}
        onPick={(category, prod) => {
          addRow(category, { name: prod.name, product: prod, qty: 1, unit: prod.unit || "Nos", rate: priceOf(prod) });
          toast.success(`${prod.name} added to ${category}`);
        }}
      />

      <CategoryLineDialog
        state={catLine}
        rateFor={rateFor}
        onClose={() => setCatLine(null)}
        onAdd={(name, qty, unit, rate) => {
          if (!catLine) return;
          if (catLine.kind === "labour") addLabourItem(catLine.category, name, qty, unit, rate);
          else addPricedItem({ category: catLine.category, itemName: name, quantity: qty, unit }, rate);
          toast.success(`${catLine.kind === "labour" ? "Labour" : "Material"} added to ${catLine.category}`);
          setCatLine(null);
        }}
      />

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
      className="flex-1 min-w-0 h-7 rounded-md border border-ring bg-background px-2 text-sm font-semibold uppercase tracking-wide outline-none ring-2 ring-ring/20"
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
const ROW = "@[820px]:grid @[820px]:grid-cols-[28px_24px_40px_minmax(0,1fr)_68px_84px_88px_84px_108px_32px] "
  + "@[1000px]:grid-cols-[28px_24px_40px_minmax(0,1.2fr)_minmax(0,1fr)_68px_84px_88px_84px_108px_32px] @[820px]:gap-x-2 @[820px]:gap-y-0";

/** Visible input styling for editable cells (the bare spreadsheet cells only show a border on hover). */
const FIELD = "!border-border !bg-background";
/**
 * Item-row cells read like a table: plain values in the wide layout that outline when the row is
 * hovered (and highlight on focus); in the narrow layout (phones — no hover) they're always boxes.
 */
const CELL = "!border-border !bg-background focus:!border-ring";
/** The product name reads as plain bold text until you hover or click it. */
const NAME_CELL = "@[820px]:!border-transparent @[820px]:!bg-transparent @[820px]:group-hover:!border-border focus:!border-ring focus:!bg-background";

function ItemRow({
  index, item, product, categories, canEdit, showLines, onUpdate, onQty, onSize, onSetGross, onSetAmount, onColor,
  onUpdateMaterial, onUpdateLabour, onDeleteMaterial, onDeleteLabour, onAddMaterial, onAddLabour,
  onDelete, onToggleActive, rateFor,
}: {
  index: number;
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
  rateFor: (workType: string) => number | undefined;
}) {
  const inactive = item.isActive === false;
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState<null | "material" | "labour">(null);
  // A typed-in price is already the row's Rate/Amount — don't repeat it as a breakdown line.
  const priceLine = priceLineOf(item);
  const materials = (item.materials || []).filter((m) => m !== priceLine);
  const lineCount = materials.length + (item.labours?.length ?? 0);
  const qty = Number(item.quantity ?? 0);
  const gross = grossOf(item);
  const rate = qty > 0 ? Math.round((gross / qty) * 100) / 100 : gross;
  const f = canEdit ? CELL : "";
  // "Show cost breakdown" opens items that have a breakdown; a plain-priced item stays one row
  // (its chevron still opens size / category / build-up).
  const detailsOpen = open || (showLines && lineCount > 0);
  const photos = useMemo(() => {
    const all = [...photosOf(product), ...(item.imageUrl ? [item.imageUrl] : [])];
    return [...new Set(all)];
  }, [product, item.imageUrl]);

  const editName = (v: string) => {
    if (!v) return;
    onUpdate({ itemName: v });
    if (priceLine) onUpdateMaterial(priceLine.id as number, { materialName: v });
  };
  const badge = item.productId == null
    ? <span className="shrink-0 rounded px-1.5 py-px text-[10px] font-semibold uppercase bg-[#EFF6FF] text-[#1D4ED8]" title="Typed in — not from the inventory catalogue">Custom</span>
    : <span className="shrink-0 rounded px-1.5 py-px text-[10px] font-semibold uppercase bg-[#ECFDF5] text-[#16805C]" title="From the inventory catalogue">Inventory</span>;
  // Colour / location show as quiet text under the name; they're edited in Details.
  const meta = [item.color, item.location || item.roomName].filter(Boolean).join(" · ");
  const menu = (
    <RowMenu canEdit={canEdit} open={detailsOpen} lineCount={lineCount}
      onToggle={() => setOpen((v) => !v)} onDelete={onDelete} />
  );

  return (
    <div className={`group transition-colors ${inactive ? "bg-muted/30" : "hover:bg-muted/20"}`}>
      <div className={`grid grid-cols-[24px_40px_minmax(0,1fr)_auto] gap-x-2 gap-y-2 items-start px-3 py-2.5 ${ROW} @[820px]:items-center @[820px]:py-1.5`}>
        {/* ✓ in quote */}
        <input type="checkbox" aria-label={`${item.itemName} in quote`} title="In the quote (customer's choice)"
          className="mt-2.5 @[820px]:mt-0 h-4 w-4 accent-primary justify-self-center" disabled={!canEdit}
          checked={!inactive} onChange={onToggleActive} />

        {/* # */}
        <span className="hidden @[820px]:block text-center text-sm tabular-nums text-muted-foreground">{index}</span>

        {/* Photo */}
        <div className={inactive ? "opacity-60" : ""}>
          <ImageCell url={item.imageUrl} options={photos} disabled={!canEdit} onChange={(url) => onUpdate({ imageUrl: url })} />
        </div>

        {/* Product: name + badge; quiet details underneath */}
        <div className={`min-w-0 ${inactive ? "opacity-60" : ""}`}>
          <div className="flex min-w-0 items-center gap-1.5">
            <div className="min-w-0 flex-1 @[820px]:flex-none @[820px]:max-w-[70%]">
              <TextCell value={item.itemName} col="itemName" disabled={!canEdit} className={`font-semibold ${canEdit ? `${CELL} ${NAME_CELL}` : ""}`} onCommit={editName} />
            </div>
            {badge}
          </div>
          {(inactive || meta || item.description) && (
            <div className="flex min-w-0 items-center gap-1.5 px-2 text-xs text-muted-foreground">
              {inactive && <span className="shrink-0 rounded px-1.5 py-px text-[10px] font-semibold uppercase bg-[#FFFBEB] text-[#B7791F]">Not in quote</span>}
              {meta && <span className="truncate">{meta}</span>}
              {item.description && <span className="truncate @[1000px]:hidden">{meta ? "· " : ""}{item.description}</span>}
            </div>
          )}
        </div>

        {/* Description column (wide tables) */}
        <div className={`hidden @[1000px]:block min-w-0 ${inactive ? "opacity-60" : ""}`}>
          <DescriptionBox value={item.description} disabled={!canEdit}
            onCommit={(v) => onUpdate({ description: v || undefined })} />
        </div>

        {/* Actions (phone: top-right) */}
        <div className="row-start-1 col-start-4 @[820px]:hidden flex items-center">{menu}</div>

        {/* Numbers — one labelled strip on phones (Qty · Unit · Rate · Amount), table cells on desktop */}
        <div className="col-span-4 col-start-1 @[820px]:col-span-1 @[820px]:col-start-auto grid grid-cols-2 @[420px]:grid-cols-[60px_76px_minmax(0,1fr)_minmax(0,1fr)] gap-x-2 gap-y-1.5 @[820px]:contents rounded-lg bg-muted/40 p-2 @[820px]:p-0">
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
          <Cell label="Disc." className="order-last col-span-2 @[420px]:col-span-4 @[820px]:order-none @[820px]:col-span-1 max-w-[9rem] @[820px]:max-w-none">
            <DiscountCell type={item.discountType} value={item.discountValue} amount={item.discountAmount} disabled={!canEdit}
              onChange={(type, value) => onUpdate({ discountType: type, discountValue: value })} />
          </Cell>
          <Cell label="Amount ₹">
            <NumCell value={item.amount} col="amount" disabled={!canEdit}
              className={`font-semibold text-foreground ${canEdit ? "!border-border !bg-muted/70 focus:!border-ring focus:!bg-background" : ""}`}
              onCommit={(v) => v != null && onSetAmount(v)} />
          </Cell>
        </div>

        <div className="hidden @[820px]:flex items-center justify-center">{menu}</div>
      </div>

      {/* ---- Details: size, category, and the material / labour behind the price ---- */}
      {detailsOpen && (
        <div className="mx-3 mb-3 @[820px]:ml-[140px] rounded-lg border bg-muted/40 p-2 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">Colour
              <ColorCell value={item.color} colors={colorsOf(product)} disabled={!canEdit} onChange={onColor} />
            </span>
            <span className="flex items-center gap-1.5">
              <LocationBox value={item.location} fallback={item.roomName} disabled={!canEdit}
                onCommit={(v) => onUpdate({ location: v || null })} />
            </span>
            <span className="min-w-[12rem] flex-1 @[1000px]:hidden">
              <DescriptionBox value={item.description} disabled={!canEdit}
                onCommit={(v) => onUpdate({ description: v || undefined })} />
            </span>
          </div>
          <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Cost breakdown <span className="normal-case tracking-normal font-normal">· qty × rate + waste % = line total · lines add up to the item amount</span>
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5 whitespace-nowrap">Size
              <span className="w-14"><NumCell value={item.length} col="length" placeholder="L" disabled={!canEdit} className={`h-7 text-center text-xs ${f}`} onCommit={(v) => onSize("length", v)} /></span>
              ×
              <span className="w-14"><NumCell value={item.width} col="width" placeholder="W" disabled={!canEdit} className={`h-7 text-center text-xs ${f}`} onCommit={(v) => onSize("width", v)} /></span>
            </span>
            <span className="flex items-center gap-1.5 whitespace-nowrap">Move to
              <SelectCell value={item.category} options={categories} disabled={!canEdit}
                className="h-7 w-auto rounded-full bg-background px-2 text-[11px]" onCommit={(v) => onUpdate({ category: v })} />
            </span>
            {canEdit && !adding && (
              <span className="flex flex-wrap items-center gap-2 @[820px]:ml-auto">
                {lineCount === 0 && <span title="Optional — only if you want the price built up from parts">Build price from</span>}
                <button type="button" onClick={() => setAdding("material")}
                  className="text-xs font-medium text-sky-700 border border-sky-200 bg-background hover:bg-sky-50 rounded-full px-3 py-1 flex items-center gap-1">
                  <Plus className="h-3.5 w-3.5" /> Material
                </button>
                <button type="button" onClick={() => setAdding("labour")}
                  className="text-xs font-medium text-amber-700 border border-amber-200 bg-background hover:bg-amber-50 rounded-full px-3 py-1 flex items-center gap-1">
                  <Plus className="h-3.5 w-3.5" /> Labour
                </button>
              </span>
            )}
          </div>
          {materials.map((m) => (
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
        </div>
      )}
    </div>
  );
}

type NewRowDraft = { name: string; product?: Product; qty: number; unit: string; rate: number };
const EMPTY_ROW: NewRowDraft = { name: "", qty: 1, unit: "Nos", rate: 0 };

/**
 * The empty last row of a category table — new products are typed straight into the table:
 * Product (pick from the catalogue or type any name) → Qty → Unit → Rate, Enter adds the line and
 * the row clears for the next one.
 */
function NewItemRow({ categoryId, categoryName, first, onAdd }: {
  categoryId?: number; categoryName: string; first: boolean;
  onAdd: (d: NewRowDraft) => Promise<unknown>;
}) {
  const [d, setD] = useState<NewRowDraft>(EMPTY_ROW);
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const ready = d.name.trim().length > 0;
  const amount = Math.round(d.qty * d.rate * 100) / 100;
  const box = "h-8 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20";
  const num = (v: string) => { const n = Number(v.replace(/,/g, "")); return Number.isFinite(n) ? n : 0; };

  const add = async () => {
    if (!ready || busy) return;
    setBusy(true);
    try {
      await onAdd(d);
      setD(EMPTY_ROW);
      nameRef.current?.focus();
    } finally { setBusy(false); }
  };
  const enterAdds = (e: React.KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); add(); } };

  return (
    <div data-newrow={categoryName} className={`grid grid-cols-[24px_minmax(0,1fr)] gap-x-2 gap-y-2 items-center px-3 py-2 border-t rounded-b-lg ${ROW}`}>
      <Plus className="h-4 w-4 text-muted-foreground justify-self-center" aria-hidden />
      {/* Product — spans the #, photo, name (and description) columns */}
      <div className="min-w-0 @[820px]:col-span-3 @[1000px]:col-span-4">
        <ProductPicker
          categoryId={categoryId}
          categoryName={categoryName}
          value={d.name}
          onValueChange={(v) => setD((x) => ({ ...x, name: v, product: x.product && v === x.product.name ? x.product : undefined }))}
          onPick={(p) => {
            setD((x) => ({ ...x, name: p.name, product: p, unit: p.unit || x.unit, rate: priceOf(p) || x.rate }));
            setTimeout(() => { qtyRef.current?.focus(); qtyRef.current?.select(); }, 0);
          }}
          onCustom={() => setTimeout(() => { qtyRef.current?.focus(); qtyRef.current?.select(); }, 0)}
          placeholder={first ? `Add the first product to ${categoryName} — search name or code…` : "Add product — search name or code..."}
          inputClassName={`${box} pl-8`}
          inputRef={nameRef}
        />
      </div>

      {/* Numbers — a strip on phones, table cells on desktop */}
      <div className="col-span-2 col-start-1 @[820px]:col-span-1 @[820px]:col-start-auto grid grid-cols-2 @[420px]:grid-cols-[60px_76px_minmax(0,1fr)_minmax(0,1fr)] gap-x-2 @[820px]:contents">
        <Cell label="Qty">
          <input ref={qtyRef} inputMode="decimal" aria-label="Quantity" className={`${box} text-right tabular-nums`}
            value={d.qty || ""} placeholder="1" onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setD((x) => ({ ...x, qty: num(e.target.value) }))} onKeyDown={enterAdds} />
        </Cell>
        <Cell label="Unit">
          <select aria-label="Unit" className={`${box} pr-1`} value={d.unit}
            onChange={(e) => setD((x) => ({ ...x, unit: e.target.value }))}>
            {(BOQ_UNITS.includes(d.unit) ? BOQ_UNITS : [d.unit, ...BOQ_UNITS]).map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </Cell>
        <Cell label="Rate ₹">
          <input inputMode="decimal" aria-label="Rate" className={`${box} text-right tabular-nums`}
            value={d.rate || ""} placeholder="0" onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setD((x) => ({ ...x, rate: num(e.target.value) }))} onKeyDown={enterAdds} />
        </Cell>
        <span className="hidden @[820px]:block" />
        <Cell label="Amount ₹" className="@[820px]:hidden">
          <span className="flex h-8 items-center justify-end px-2 text-sm font-semibold tabular-nums text-muted-foreground">
            {amount > 0 ? inr(amount) : "—"}
          </span>
        </Cell>
      </div>

      <Button size="sm" variant="outline" className="col-span-2 h-8" disabled={!ready || busy} onClick={add}
        title="Add this product (Enter)">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 @[820px]:mr-0 mr-1" /><span className="@[820px]:hidden">Add product</span></>}
      </Button>
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
      <input value={draft} placeholder={fallback || "Location"} aria-label="Location"
        title="Where it goes, e.g. Hall window — shows on the quotation"
        className="h-6 w-16 focus:w-40 transition-[width] rounded-md border border-transparent bg-transparent px-1.5 text-xs outline-none hover:border-border focus:border-primary focus:bg-background"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft.trim() !== (value ?? "").trim() && onCommit(draft.trim())}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setDraft(value ?? ""); e.currentTarget.blur(); } }} />
    </span>
  );
}

/** One product's ⋮: details & cost breakdown, remove (undo-able). */
function RowMenu({ canEdit, open, lineCount, onToggle, onDelete }: {
  canEdit: boolean; open: boolean; lineCount: number; onToggle: () => void; onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="Product actions"
          className={`relative h-8 w-7 rounded-md flex items-center justify-center hover:bg-muted ${open ? "text-foreground" : "text-muted-foreground"}`}>
          <MoreVertical className="h-4 w-4" />
          {lineCount > 0 && <span className="absolute -top-0.5 -right-0.5 h-3.5 min-w-3.5 rounded-full bg-muted px-0.5 text-[9px] leading-[14px] tabular-nums text-muted-foreground">{lineCount}</span>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem onClick={onToggle}>
          <SlidersHorizontal className="h-4 w-4 mr-2" /> {open ? "Hide details" : "Colour, location & cost breakdown"}
        </DropdownMenuItem>
        {canEdit && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" /> Remove product</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** A table cell on desktop; a labelled field on phones. */
function Cell({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`min-w-0 ${className}`}>
      {label && <span className="@[820px]:hidden block text-[10px] font-medium uppercase text-muted-foreground mb-0.5">{label}</span>}
      {children}
    </div>
  );
}

/** Item description under the name: quiet until you click it; grows with its text; saves on blur. */
function DescriptionBox({ value, disabled, onCommit, autoFocus, onDone }: {
  value?: string | null; disabled: boolean; onCommit: (v: string) => void;
  autoFocus?: boolean; onDone?: () => void;
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
    <textarea ref={ref} rows={1} value={draft} disabled={disabled} autoFocus={autoFocus}
      placeholder={disabled ? "" : "Add description…"}
      title="Shows on the quotation, print and PDF"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { if (draft.trim() !== (value ?? "").trim()) onCommit(draft.trim()); onDone?.(); }}
      onKeyDown={(e) => { if (e.key === "Escape") { setDraft(value ?? ""); e.currentTarget.blur(); } }}
      className="w-full min-h-8 resize-none overflow-hidden rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm leading-snug text-foreground/80 outline-none group-hover:border-border focus:border-ring focus:bg-background focus:text-foreground focus:ring-2 focus:ring-ring/20 placeholder:text-muted-foreground/60 disabled:group-hover:border-transparent" />
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

/** "Add from Inventory": pick a category, then any number of catalogue products. */
function InventoryDialog({ open, categories, categoryId, onClose, onPick }: {
  open: boolean;
  categories: string[];
  categoryId: (name: string) => number | undefined;
  onClose: () => void;
  onPick: (category: string, p: Product) => void;
}) {
  const [category, setCategory] = useState("");
  useEffect(() => { if (open) setCategory((c) => (c && categories.includes(c) ? c : categories[0] ?? "")); }, [open, categories]);
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="quote-neutral max-w-lg">
        <DialogHeader><DialogTitle>Add from Inventory</DialogTitle></DialogHeader>
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">Add a category to the quote first — products are grouped by category.</p>
        ) : (
          <div className="space-y-3">
            <label className="block text-xs text-muted-foreground">Add to category
              <select className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground" value={category}
                onChange={(e) => setCategory(e.target.value)}>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <div className="min-h-[18rem]">
              <ProductPicker
                key={category}
                categoryId={categoryId(category)}
                categoryName={category}
                placeholder="Search products by name, code or category…"
                onPick={(p) => onPick(category, p)}
                onCustom={() => toast.info("Pick a product from the list — use the table's last row for a custom one.")}
              />
              <p className="mt-2 text-[11px] text-muted-foreground">Pick as many as you need — each is added with its saved rate.</p>
            </div>
          </div>
        )}
        <DialogFooter><Button variant="outline" onClick={onClose}>Done</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Category ⋮ → Add material / Add labour: one line for the category, e.g. "Fevicol" or "Fitting labour". */
function CategoryLineDialog({ state, rateFor, onClose, onAdd }: {
  state: null | { category: string; kind: "material" | "labour" };
  rateFor: (workType: string) => number | undefined;
  onClose: () => void;
  onAdd: (name: string, qty: number, unit: string, rate: number) => void;
}) {
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("Nos");
  const [rate, setRate] = useState("");
  useEffect(() => { setName(""); setQty("1"); setUnit(state?.kind === "labour" ? "Lump Sum" : "Nos"); setRate(""); }, [state]);
  const labour = state?.kind === "labour";
  const amount = (Number(qty) || 0) * (Number(rate) || 0);
  const submit = () => name.trim() && onAdd(name.trim(), Number(qty) || 1, unit, Number(rate) || 0);
  const units = BOQ_UNITS.includes(unit) ? BOQ_UNITS : [unit, ...BOQ_UNITS];

  return (
    <Dialog open={!!state} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="quote-neutral max-w-md">
        <DialogHeader><DialogTitle>Add {labour ? "labour" : "material"} to {state?.category}</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">
          {labour
            ? "Labour for the whole category, e.g. fitting or installation — it shows as its own line."
            : "A material for the whole category, e.g. adhesive or fixings — it shows as its own line."}
        </p>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <Input autoFocus list={labour ? LABOUR_TYPES_LIST : undefined} value={name}
            placeholder={labour ? "Work type (e.g. Fitting, Carpenter)" : "Material name (e.g. Fevicol, Screws)"}
            onChange={(e) => {
              setName(e.target.value);
              const known = labour ? rateFor(e.target.value) : undefined;
              if (known != null && !rate) setRate(String(known));
            }} />
          <div className="grid grid-cols-3 gap-2">
            <label className="text-xs text-muted-foreground">Qty
              <Input inputMode="decimal" className="mt-1 text-right" value={qty} onChange={(e) => setQty(e.target.value)} />
            </label>
            <label className="text-xs text-muted-foreground">Unit
              <select className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground" value={unit} onChange={(e) => setUnit(e.target.value)}>
                {units.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">Rate ₹
              <Input inputMode="decimal" className="mt-1 text-right" value={rate} placeholder="0" onChange={(e) => setRate(e.target.value)} />
            </label>
          </div>
          <p className="text-right text-sm">Amount <span className="font-semibold tabular-nums">{inr(amount)}</span></p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!name.trim()}>Add {labour ? "labour" : "material"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Bulk action: add one labour line to many items
// ---------------------------------------------------------------------------

function BulkDialog({
  state, items, rateFor, onClose, onAddLabour,
}: {
  state: null | { mode: "labour" };
  items: BoqItem[];
  rateFor: (workType: string) => number | undefined;
  onClose: () => void;
  onAddLabour: (workType: string, rate: number, targetIds: number[]) => void;
}) {
  const [workType, setWorkType] = useState("");
  const [rate, setRate] = useState("");
  // Labour targets: every item in the quote, untick the ones that don't need it.
  const [picked, setPicked] = useState<Set<number>>(new Set());
  useEffect(() => {
    setWorkType(""); setRate("");
    setPicked(new Set(items.filter((i) => i.isActive !== false).map((i) => i.id as number)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);


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
      </DialogContent>
    </Dialog>
  );
}


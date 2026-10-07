import { useEffect, useMemo, useRef, useState } from "react";
import { enqueueSave } from "./saveQueue";
import { createPortal } from "react-dom";
import { BookmarkPlus, Check, ChevronDown, ChevronRight, ChevronUp, FolderOpen, FolderPlus, Hammer, Loader2, MapPin, MoreVertical, Package, PackagePlus, Pencil, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { apiError } from "@/lib/apiError";
import { boqApi } from "@/api/boqApi";
import {
  type Boq, type BoqItem, type BoqItemLabour, type BoqItemMaterial, type ProductRef,
} from "@/types/boq";
import type { Product, ProductColor } from "@/types/inventory";
import { NumCell, ProductSearch, SelectCell, TextCell, UnitCell } from "./cells";
import {
  ColourBox, DiscountCell, ImageCell, colorsOf, photosOf, productSummary, useCategories, useLineProducts,
} from "./productCells";
import AddProductPanel, { type NewRowDraft } from "./AddProductPanel";
import { CATEGORY_TONE, PRODUCT_TONE } from "./quoteTones";
import { UnitOptions } from "@/components/UnitOptions";
import { isAreaUnit, isLengthUnit, normalizeUnit, sizeUnitOf } from "@/lib/units";

// The quote sheet, organised Category → Product. Every line is edited in place, saved on blur, and
// the sheet is re-fetched after each save so server-calculated totals stay authoritative.

const inr = (v?: number | null) =>
  "₹" + Number(v ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
/** Grouped digits for rate / amount cells (1500 → 1,500). */
const grouped = (v: number) => v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
const errMsg = (e: any, fallback: string) =>
  e?.response?.data?.message || (typeof e?.response?.data === "string" ? e.response.data : "") || fallback;

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

  // All saves run one after another — the item/material/labour updates are full-replace, so two
  // overlapping saves built from the same snapshot would undo each other. The queue is shared with
  // the price cards under the sheet (see saveQueue.ts).
  const [pending, setPending] = useState(0);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const reportSave = useRef(onSaveState);
  reportSave.current = onSaveState;
  useEffect(() => { reportSave.current?.(pending, lastSaved); }, [pending, lastSaved]);

  const save = (label: string, job: (cur: Boq) => Promise<unknown>) => {
    setPending((n) => n + 1);
    return enqueueSave(boqId, async () => {
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
    }).finally(() => setPending((n) => n - 1));
  };

  const findItem = (cur: Boq, id: number) => (cur.items || []).find((i) => i.id === id);

  const updateItem = (id: number, patch: Partial<BoqItem>) =>
    save("update the item", (cur) => {
      const it = findItem(cur, id);
      return it ? boqApi.updateItem(boqId, id, itemPayload(it, patch)) : Promise.resolve();
    });

  /**
   * Size edit: keep area in step, and carry it into qty when qty was tracking the size —
   * L × W for an area (2D) unit, L alone for a length (1D) unit. Sizes are entered in the
   * unit's own length (Sqm → metres, Sq Cm → cm, Sqft/Rft → feet).
   */
  const updateSize = (item: BoqItem, field: "length" | "width", v: number | null) => {
    const L = field === "length" ? v : item.length ?? null;
    const W = field === "width" ? v : item.width ?? null;
    const patch: Partial<BoqItem> = { [field]: v ?? undefined };
    const q = item.quantity ?? 0;
    const near = (x?: number | null) => x != null && Math.abs(q - x) < 0.01;
    const tracking = item.quantity == null || item.quantity === 0 || near(item.area)
      || near(item.length != null && item.width != null ? item.length * item.width : null)
      || near(item.length);
    if (L != null && W != null) {
      const area = Math.round(L * W * 100) / 100;
      patch.area = area;
      if (isAreaUnit(item.unit) && tracking) patch.quantity = area;
    }
    if (L != null && isLengthUnit(item.unit) && tracking) patch.quantity = Math.round(L * 100) / 100;
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
  const addRow = async (category: string, d: NewRowDraft) => {
    let p = d.product;
    // A typed-in name with "Save for future quotes" ticked goes into the catalogue first, so the line
    // links to it (or to the product already there under that name).
    if (!p && !d.web && d.saveForLater && d.name.trim()) {
      p = await saveToCatalogue(category, d.name, d.unit, d.rate);
    }
    // Picked a saved item and corrected it: the saved item changes — no second copy.
    if (p && d.updateSaved && p.source === "QUOTE") {
      try {
        const r = await boqApi.updateCatalogueItem(p.id, { name: d.name.trim(), unit: d.unit || undefined });
        p = r.product;
        if (r.updated) toast.success(`Saved item "${p.name}" updated for future quotes`);
      } catch (e) {
        toast.error(apiError(e, "Couldn't update the saved item."));
      }
    }
    if (p) rememberProduct(p);
    const color = p ? colorsOf(p)[0] : undefined;
    const web = d.web;
    return addPricedItem({
      category, itemName: d.name.trim(), productId: p?.id,
      description: p ? productSummary(p) : web?.shortDescription || undefined,
      imageUrl: p ? color?.imageUrl || photosOf(p)[0] || undefined : web?.image || undefined, color: color?.name,
      quantity: d.qty > 0 ? d.qty : 1, unit: d.unit || "Nos",
    }, d.rate);
  };

  /** Saves a typed-in line to the catalogue; returns the product, or undefined if it couldn't be saved. */
  const saveToCatalogue = async (category: string, name: string, unit?: string | null, rate?: number, description?: string | null) => {
    try {
      const r = await boqApi.saveCatalogueItem({
        name: name.trim(), description: description?.trim() || undefined, unit: unit || "Nos", rate: rate && rate > 0 ? rate : undefined,
        categoryId: categoryByName.get(category.trim().toLowerCase())?.id,
      });
      toast.success(r.existing ? `"${r.product.name}" is already in the catalogue — linked to it` : `"${r.product.name}" saved for future quotes`);
      return r.product;
    } catch (e) {
      toast.error(apiError(e, "Couldn't save it to the catalogue — added to this quote only."));
      return undefined;
    }
  };

  /** "Save to catalogue" on an existing custom line: save it, then link the line to the product. */
  const saveLineToCatalogue = async (item: BoqItem) => {
    const qty = Number(item.quantity ?? 0) > 0 ? Number(item.quantity) : 1;
    const p = await saveToCatalogue(item.category || "", item.itemName || "", item.unit,
      Math.round((grossOf(item) / qty) * 100) / 100, item.description);
    if (!p) return;
    rememberProduct(p);
    updateItem(item.id as number, { productId: p.id });
  };

  /**
   * A line linked to an item saved from a quote: changing its name, description or unit changes the
   * saved item too, so the next quote picks the corrected version (no second copy). Stocked inventory
   * products are never changed from a quote. The saved rate is left as it is.
   */
  const syncSavedItem = (item: BoqItem, patch: Partial<BoqItem>) => {
    if (item.productId == null) return;
    const prod = products[item.productId];
    if (prod && prod.source !== "QUOTE") return;
    const body: { name?: string; description?: string; unit?: string } = {};
    const name = patch.itemName?.trim();
    if (name && name !== (prod?.name ?? item.itemName)) body.name = name;
    if ("description" in patch && (patch.description ?? "") !== (prod ? prod.description ?? "" : item.description ?? "")) body.description = patch.description ?? "";
    if (patch.unit && patch.unit !== (prod?.unit ?? item.unit)) body.unit = patch.unit;
    if (!Object.keys(body).length) return;
    boqApi.updateCatalogueItem(item.productId, body)
      .then((r) => {
        rememberProduct(r.product);
        if (r.updated) toast.success(`Saved item "${r.product.name}" updated for future quotes`);
      })
      .catch((e) => toast.error(apiError(e, "Couldn't update the saved item.")));
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
  // The "Add products" panel — the one place products and new categories are added.
  const [panel, setPanel] = useState<null | { category?: string; newCategory?: boolean }>(null);
  const openPanel = (category?: string, newCategory?: boolean) => {
    if (category) setCollapsed((cur) => { const n = new Set(cur); n.delete(category); return n; });
    setPanel({ category, newCategory });
  };

  // The tick on each item is the customer's choice: ticked items are in the quote and its total.
  const setIncluded = (list: BoqItem[], on: boolean) => list
    .filter((i) => (i.isActive !== false) !== on)
    .forEach((i) => save("update the quote", () => boqApi.toggleItemActive(boqId, i.id as number, on)));

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

      {/* Add product — in the page's tab bar when it gives a slot, else here. New categories are made at
          the bottom of the sheet (amber), never up here, so the two are never mixed up. */}
      {canEdit && groups.length > 0 && (() => {
        const actions = (
          <div className="flex w-full items-center gap-2">
            <Button size="sm" className={`h-9 flex-1 sm:flex-none ${PRODUCT_TONE.solid}`} onClick={() => openPanel()}>
              <PackagePlus className="h-4 w-4" /> Add product
            </Button>
            {items.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="h-9 w-9 shrink-0 px-0" aria-label="More actions">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuItem onClick={() => setBulk({ mode: "labour" })}><Hammer className="h-4 w-4 mr-2" /> Add labour to several products…</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        );
        return actionsTarget ? createPortal(actions, actionsTarget) : <div className="flex justify-end">{actions}</div>;
      })()}

      <datalist id={LABOUR_TYPES_LIST}>
        {Object.values(labourRates).map((r) => <option key={r.label} value={r.label}>{`₹${r.rate}`}</option>)}
      </datalist>

      {groups.length === 0 && (
        <div className="rounded-xl border border-dashed px-4 py-8 sm:px-6 sm:py-10 text-center">
          <p className="text-sm font-semibold">This quote is empty</p>
          {canEdit ? (
            <>
              <ol className="mx-auto mt-4 grid max-w-md gap-2 text-left sm:grid-cols-2">
                <li className="flex items-start gap-2.5 rounded-lg border-2 border-[#F59E0B]/60 bg-[#FFFBEB] p-3">
                  <FolderPlus className={`mt-0.5 h-5 w-5 shrink-0 ${CATEGORY_TONE.icon}`} />
                  <span className="text-xs"><span className="block font-semibold text-[#92400E]">1 · Make a category</span>
                    <span className="text-muted-foreground">A group, e.g. Curtains, Wallpaper</span></span>
                </li>
                <li className="flex items-start gap-2.5 rounded-lg border p-3 opacity-70">
                  <PackagePlus className="mt-0.5 h-5 w-5 shrink-0 text-[#1F5C3F]" />
                  <span className="text-xs"><span className="block font-semibold">2 · Add its products</span>
                    <span className="text-muted-foreground">Search, set qty & rate</span></span>
                </li>
              </ol>
              <Button className={`mt-4 h-10 ${CATEGORY_TONE.solid}`} onClick={() => openPanel(undefined, true)}>
                <FolderPlus className="h-4 w-4" /> Make first category
              </Button>
            </>
          ) : <p className="mt-1 text-xs text-muted-foreground">Nothing has been priced here.</p>}
        </div>
      )}

      {groups.map((g) => {
        const on = g.items.filter((i) => i.isActive !== false).length;
        const folded = collapsed.has(g.category);
        return (
          // No overflow-hidden here: the product picker's dropdown must be able to spill out.
          <div key={g.category} className="rounded-lg border bg-card">
            {/* Category header */}
            <div className={`flex items-center gap-2 ${CATEGORY_TONE.header} px-3 py-2 ${folded ? "rounded-lg" : "rounded-t-lg"}`}>
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
                  <FolderOpen className={`inline h-4 w-4 mr-1.5 -mt-0.5 ${CATEGORY_TONE.icon}`} aria-hidden />
                  <span
                    className={canEdit ? "cursor-text rounded px-0.5 -mx-0.5 hover:bg-primary/10" : ""}
                    title={canEdit ? "Double-click to rename" : undefined}
                    onDoubleClick={() => canEdit && setRenaming(g.category)}>
                    {g.category}
                  </span>
                  <span className="ml-2 text-xs font-normal normal-case tracking-normal text-muted-foreground">
                    {g.items.length} item{g.items.length === 1 ? "" : "s"}
                  </span>
                </span>
              )}
              <span className="hidden sm:inline text-xs text-muted-foreground">Total</span>
              <span className="text-sm font-bold tabular-nums">{inr(groupTotal(g.items))}</span>
              {canEdit && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center" aria-label="Category actions">
                      <MoreVertical className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
                    <DropdownMenuItem onClick={() => openPanel(g.category)}><PackagePlus className="h-4 w-4 mr-2 text-[#1F5C3F]" /> Add product</DropdownMenuItem>
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
              <div className={`hidden @[820px]:grid ${ROW} items-center border-t px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground`}>
                <input type="checkbox" className="h-4 w-4 accent-primary justify-self-center" disabled={!canEdit || g.items.length === 0}
                  title="Whole category in the quote" aria-label={`${g.category} in quote`}
                  ref={(el) => { if (el) el.indeterminate = on > 0 && on < g.items.length; }}
                  checked={g.items.length > 0 && on === g.items.length} onChange={() => setIncluded(g.items, on !== g.items.length)} />
                <span className="text-center">#</span>
                <span className="col-span-2">Product</span>
                <span className="hidden @[1100px]:block">Description</span>
                <span className="hidden @[1100px]:block">Colour</span>
                <span className="text-right pr-2">Qty</span>
                <span className="pl-2">Unit</span>
                <span className="text-right pr-2">Rate ₹</span>
                <span className="pl-2">Disc.</span>
                <span className="text-right pr-2">Amount ₹</span>
                <span />
              </div>
            )}

            {!folded && <div className="border-t space-y-2 p-2 @[820px]:space-y-0 @[820px]:p-0 @[820px]:divide-y">
              {g.items.map((item, idx) => (
                <ItemRow
                  key={item.id}
                  index={idx + 1}
                  item={item}
                  product={item.productId != null ? products[item.productId] : undefined}
                  categories={categoryNames}
                  canEdit={canEdit}
                  showLines={showLines}
                  onUpdate={(patch) => { updateItem(item.id as number, patch); syncSavedItem(item, patch); }}
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
                  onSaveToCatalogue={() => saveLineToCatalogue(item)}
                  onToggleActive={() => save("update the quote", () => boqApi.toggleItemActive(boqId, item.id as number, item.isActive === false))}
                />
              ))}
            </div>}
            {!folded && canEdit && (
              <div className="border-t p-1.5">
                <button type="button" onClick={() => openPanel(g.category)}
                  className={`flex h-10 w-full items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors active:scale-[0.99] ${PRODUCT_TONE.soft}`}>
                  <PackagePlus className="h-4 w-4" />
                  {g.items.length === 0 ? `Add the first product to ${g.category}` : `Add product to ${g.category}`}
                </button>
              </div>
            )}
          </div>
        );
      })}

      {canEdit && groups.length > 0 && (
        <button type="button" onClick={() => openPanel(undefined, true)}
          className={`flex w-full items-center justify-center gap-2.5 rounded-lg px-4 py-3 text-left transition-colors active:scale-[0.99] ${CATEGORY_TONE.soft}`}>
          <FolderPlus className={`h-5 w-5 shrink-0 ${CATEGORY_TONE.icon}`} />
          <span>
            <span className="block text-sm font-semibold">New category</span>
            <span className="block text-xs font-normal opacity-80">Start another group, e.g. Blinds, Wallpaper</span>
          </span>
        </button>
      )}

      <AddProductPanel
        open={!!panel}
        onClose={() => setPanel(null)}
        initialCategory={panel?.category}
        newCategory={panel?.newCategory}
        categories={categoryNames}
        categoryIdOf={(c) => categoryByName.get(c.trim().toLowerCase())?.id}
        savedCategories={savedCategories}
        onSaveCategory={rememberCategory}
        onAddCategory={(name) => setExtraCategories((l) => [...l, name.slice(0, CATEGORY_MAX)])}
        onAdd={addRow}
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
const ROW = "@[820px]:grid @[820px]:grid-cols-[20px_18px_32px_minmax(0,1fr)_64px_76px_88px_72px_104px_28px] "
  + "@[1100px]:grid-cols-[20px_18px_32px_minmax(0,1.2fr)_minmax(0,1fr)_112px_64px_76px_88px_72px_104px_28px] @[820px]:gap-x-1.5 @[820px]:gap-y-0";

/** Visible input styling for editable cells (the bare spreadsheet cells only show a border on hover). */
const FIELD = "!border-border !bg-background";
/**
 * Item-row cells read like a table: plain values in the wide layout that outline when the row is
 * hovered (and highlight on focus); in the narrow layout (phones — no hover) they're always boxes.
 */
const CELL = "!border-border !bg-background @[820px]:!border-transparent @[820px]:!bg-transparent "
  + "@[820px]:group-hover:!border-border @[820px]:group-hover:!bg-background focus:!border-ring focus:!bg-background";
/** Phones / tablets: taller, larger fields (touch + no iOS zoom); the wide table keeps compact cells. */
const BIG = "!h-10 !text-base @[820px]:!h-8 @[820px]:!text-sm";
/** Amount on phones / tablets: big bold figure sitting in the green box; a normal table cell when wide. */
const AMOUNT_CELL = "!h-9 !px-1 !text-lg font-bold !border-transparent !bg-transparent hover:!border-[#A7F3D0] focus:!border-ring focus:!bg-background "
  + "@[820px]:!h-8 @[820px]:!px-2 @[820px]:!text-sm @[820px]:font-semibold @[820px]:group-hover:!border-border @[820px]:group-hover:!bg-background";
/** Quiet text under the product name (description, colour): no box until hovered or focused. */
const QUIET = "h-7 text-xs text-muted-foreground !border-transparent !bg-transparent hover:!border-border focus:!border-ring focus:!bg-background focus:text-foreground";
/** The product name reads as plain bold text until you hover or click it. */
const NAME_CELL = "@[820px]:!border-transparent @[820px]:!bg-transparent @[820px]:group-hover:!border-border focus:!border-ring focus:!bg-background";

function ItemRow({
  index, item, product, categories, canEdit, showLines, onUpdate, onQty, onSize, onSetGross, onSetAmount, onColor,
  onUpdateMaterial, onUpdateLabour, onDeleteMaterial, onDeleteLabour, onAddMaterial, onAddLabour,
  onDelete, onToggleActive, rateFor, onSaveToCatalogue,
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
  /** Custom line → catalogue product for future quotes. */
  onSaveToCatalogue: () => Promise<unknown>;
}) {
  const inactive = item.isActive === false;
  const [saveMenu, setSaveMenu] = useState(false);
  const [savingToCatalogue, setSavingToCatalogue] = useState(false);
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
  const customCls = "shrink-0 rounded px-1 text-[10px] font-semibold uppercase leading-4 bg-[#EFF6FF] text-[#1D4ED8]";
  const badge = item.productId == null
    ? (canEdit ? (
      <span className="relative shrink-0">
        <button type="button" className={`${customCls} hover:ring-1 hover:ring-[#1D4ED8]/40`}
          title="Typed in — click to save it for future quotes" aria-expanded={saveMenu}
          onClick={() => setSaveMenu((v) => !v)}>
          {savingToCatalogue ? <Loader2 className="inline h-3 w-3 animate-spin" /> : "Custom"}
        </button>
        {saveMenu && (
          <>
            <span className="fixed inset-0 z-40" onClick={() => setSaveMenu(false)} />
            <span className="absolute left-0 top-full z-50 mt-1 w-60 rounded-lg border bg-popover p-1 text-left shadow-lg">
              <button type="button" disabled={savingToCatalogue}
                className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted active:scale-[0.98]"
                onClick={async () => {
                  setSaveMenu(false); setSavingToCatalogue(true);
                  try { await onSaveToCatalogue(); } finally { setSavingToCatalogue(false); }
                }}>
                <BookmarkPlus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span><span className="block font-semibold text-foreground">Save to catalogue</span>
                  <span className="text-muted-foreground">Pick it from search in future quotes, with this unit and rate</span></span>
              </button>
            </span>
          </>
        )}
      </span>
    ) : <span className={customCls} title="Typed in — not from the inventory catalogue">Custom</span>)
    : <span className="shrink-0 rounded px-1 text-[10px] font-semibold uppercase leading-4 bg-[#ECFDF5] text-[#16805C]" title="From the inventory catalogue">Inventory</span>;
  // Location shows as quiet text under the name; it's edited in Details.
  const meta = item.location || item.roomName || "";
  const menu = (
    <RowMenu canEdit={canEdit} open={detailsOpen} lineCount={lineCount}
      onToggle={() => setOpen((v) => !v)} onDelete={onDelete} />
  );

  return (
    <div className={`group transition-colors rounded-xl border bg-card shadow-sm @[820px]:rounded-none @[820px]:border-0 @[820px]:shadow-none @[820px]:bg-transparent ${inactive ? "!bg-muted/40" : "@[820px]:hover:bg-muted/30"}`}>
      <div className={`grid grid-cols-[22px_48px_minmax(0,1fr)_auto] @[440px]:grid-cols-[22px_56px_minmax(0,1fr)_auto] gap-x-2.5 @[440px]:gap-x-3 gap-y-3 items-start p-3 ${ROW} @[820px]:items-center @[820px]:px-3 @[820px]:py-1`}>
        {/* ✓ in quote */}
        <input type="checkbox" aria-label={`${item.itemName} in quote`} title="In the quote (customer's choice)"
          className="mt-4 @[820px]:mt-0 h-5 w-5 @[820px]:h-4 @[820px]:w-4 accent-[#1F5C3F] justify-self-center" disabled={!canEdit}
          checked={!inactive} onChange={onToggleActive} />

        {/* # */}
        <span className="hidden @[820px]:block text-center text-xs tabular-nums text-muted-foreground">{index}</span>

        {/* Photo */}
        <div className={inactive ? "opacity-60" : ""}>
          <ImageCell url={item.imageUrl} options={photos} disabled={!canEdit} size="h-12 w-12 @[440px]:h-14 @[440px]:w-14 @[820px]:h-8 @[820px]:w-8"
            onChange={(url) => onUpdate({ imageUrl: url })} />
        </div>

        {/* Product: name + badge; description · colour as one quiet line underneath */}
        <div className={`min-w-0 ${inactive ? "opacity-60" : ""}`}>
          {/* Narrow phones: the name gets the whole line and the badges wrap under it. */}
          <div className="flex flex-wrap @[440px]:flex-nowrap min-w-0 items-center gap-x-1.5 gap-y-0.5">
            <div className="min-w-0 basis-full @[440px]:basis-auto flex-1 @[820px]:flex-none @[820px]:max-w-[80%]">
              <TextCell value={item.itemName} col="itemName" disabled={!canEdit}
                className={`h-8 text-base @[820px]:h-7 @[820px]:text-sm font-semibold @[820px]:[field-sizing:content] @[820px]:min-w-[5rem] @[820px]:max-w-full ${canEdit ? `${CELL} ${NAME_CELL}` : ""}`} onCommit={editName} />
            </div>
            {badge}
            {inactive && <span className="shrink-0 rounded px-1 text-[10px] font-semibold uppercase leading-4 bg-[#FFFBEB] text-[#B7791F]">Not in quote</span>}
          </div>
          {/* Description + colour — under the name until the table has room for their own columns */}
          <div className="flex flex-wrap min-w-0 items-start gap-x-1 @[1100px]:hidden">
            <div className="min-w-0 basis-full @[560px]:basis-0 flex-1 @[820px]:flex-none max-w-full">
              <DescriptionBox value={item.description} disabled={!canEdit} quiet
                onCommit={(v) => onUpdate({ description: v || undefined })} />
            </div>
            {(canEdit || item.color) && (
              <ColourBox value={item.color} colors={colorsOf(product)} disabled={!canEdit} onChange={onColor}
                className="w-24 shrink-0 @[560px]:hidden @[820px]:block" inputClassName={QUIET} />
            )}
          </div>
          {meta && (
            <span className="flex min-w-0 items-center gap-0.5 px-2 text-[11px] text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{meta}</span>
            </span>
          )}
        </div>

        {/* Description + Colour columns (wide tables) */}
        <div className={`hidden @[1100px]:block min-w-0 ${inactive ? "opacity-60" : ""}`}>
          <DescriptionBox value={item.description} disabled={!canEdit} table
            onCommit={(v) => onUpdate({ description: v || undefined })} />
        </div>
        <div className={`hidden @[1100px]:block min-w-0 ${inactive ? "opacity-60" : ""}`}>
          <ColourBox value={item.color} colors={colorsOf(product)} disabled={!canEdit} onChange={onColor}
            inputClassName={canEdit ? CELL : ""} />
        </div>

        {/* Colour + actions (phones / tablets: top-right of the card) */}
        <div className="row-start-1 col-start-4 @[820px]:hidden flex items-center gap-1">
          {(canEdit || item.color) && (
            <ColourBox value={item.color} colors={colorsOf(product)} disabled={!canEdit} onChange={onColor}
              className="hidden @[560px]:block w-28" inputClassName={QUIET} />
          )}
          {menu}
        </div>

        {/* Numbers — one labelled strip on phones (Qty · Unit · Rate · Disc · Amount), table cells on desktop */}
        <div className="col-span-4 col-start-1 @[820px]:col-span-1 @[820px]:col-start-auto grid grid-cols-3 @[520px]:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1.2fr)] gap-x-3 gap-y-3 items-end @[820px]:contents">
          <Cell label="Qty">
            <div className="relative">
              <NumCell value={item.quantity} col="qty" disabled={!canEdit} className={`${f} ${BIG} !text-left @[820px]:!text-right ${canEdit ? "!pl-3 pr-8 @[820px]:!pl-2 @[820px]:pr-2" : ""}`} onCommit={onQty} />
              {canEdit && (
                <span className="absolute inset-y-0 right-0.5 flex flex-col justify-center @[820px]:hidden">
                  <button type="button" aria-label="One more" onClick={() => onQty(Math.round((qty + 1) * 100) / 100)}
                    className="flex h-[18px] w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"><ChevronUp className="h-4 w-4" /></button>
                  <button type="button" aria-label="One less" disabled={qty <= 1} onClick={() => onQty(Math.max(1, Math.round((qty - 1) * 100) / 100))}
                    className="flex h-[18px] w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"><ChevronDown className="h-4 w-4" /></button>
                </span>
              )}
            </div>
          </Cell>
          <Cell label="Unit" divider>
            <UnitCell value={item.unit} disabled={!canEdit} className={`${f} ${BIG}`} onCommit={(v) => onUpdate({ unit: v })} />
          </Cell>
          <Cell label="Rate (₹)" divider>
            <NumCell value={rate} col="rate" disabled={!canEdit} className={`${f} ${BIG}`} format={grouped}
              onCommit={(v) => v != null && onSetGross(Math.round(v * (qty > 0 ? qty : 1) * 100) / 100)} />
          </Cell>
          <Cell label="Disc." divider>
            <DiscountCell type={item.discountType} value={item.discountValue} amount={item.discountAmount} disabled={!canEdit}
              selectClassName={`${f} ${BIG}`} onChange={(type, value) => onUpdate({ discountType: type, discountValue: value })} />
          </Cell>
          <Cell label="Amount (₹)" className="col-span-2 @[520px]:col-span-1 rounded-lg bg-[#ECFDF5] px-2 pt-1.5 pb-1 @[820px]:col-span-1 @[820px]:rounded-none @[820px]:bg-transparent @[820px]:p-0">
            <NumCell value={item.amount} col="amount" disabled={!canEdit} format={grouped}
              className={`text-foreground ${canEdit ? AMOUNT_CELL : "!h-9 !text-lg font-bold @[820px]:!h-8 @[820px]:!text-sm @[820px]:font-semibold"}`}
              onCommit={(v) => v != null && onSetAmount(v)} />
          </Cell>
        </div>

        <div className="hidden @[820px]:flex items-center justify-center">{menu}</div>
      </div>

      {/* ---- Details: size, category, and the material / labour behind the price ---- */}
      {detailsOpen && (
        <div className="mx-3 mb-3 @[820px]:ml-[100px] rounded-lg border bg-muted/40 p-2 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">Location
              <LocationBox value={item.location} fallback={item.roomName} disabled={!canEdit}
                onCommit={(v) => onUpdate({ location: v || null })} />
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
              {sizeUnitOf(item.unit) && <span title={`Enter the size in ${sizeUnitOf(item.unit)} for ${item.unit}`}>{sizeUnitOf(item.unit)}</span>}
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
                  quantity: item.quantity ?? 1, unit: normalizeUnit(p.unit) || item.unit, wastePercent: 0,
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
          <SlidersHorizontal className="h-4 w-4 mr-2" /> {open ? "Hide details" : "Location & cost breakdown"}
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

/** A table cell on desktop; a labelled field on phones / tablets (with a divider before it once they sit in one row). */
function Cell({ label, className = "", divider, children }: { label: string; className?: string; divider?: boolean; children: React.ReactNode }) {
  return (
    <div className={`min-w-0 ${divider ? "@[520px]:border-l @[520px]:pl-3 @[820px]:border-l-0 @[820px]:pl-0" : ""} ${className}`}>
      {label && <span className="@[820px]:hidden block text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1">{label}</span>}
      {children}
    </div>
  );
}

/** Item description under the name: quiet until you click it; grows with its text; saves on blur. */
function DescriptionBox({ value, disabled, onCommit, autoFocus, onDone, quiet, table }: {
  value?: string | null; disabled: boolean; onCommit: (v: string) => void;
  autoFocus?: boolean; onDone?: () => void;
  /** Small muted text under the product name — no box until hovered / focused. */
  quiet?: boolean;
  /** Its own table column: plain text that outlines when the row is hovered. */
  table?: boolean;
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
      placeholder={disabled ? "" : "Description"}
      title="Shows on the quotation, print and PDF"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { if (draft.trim() !== (value ?? "").trim()) onCommit(draft.trim()); onDone?.(); }}
      onKeyDown={(e) => { if (e.key === "Escape") { setDraft(value ?? ""); e.currentTarget.blur(); } }}
      className={`resize-none overflow-hidden rounded-md border px-2 outline-none focus:border-ring focus:bg-background focus:text-foreground focus:ring-2 focus:ring-ring/20 placeholder:text-muted-foreground/60 disabled:border-transparent disabled:bg-transparent ${
        quiet
          ? "w-full @[820px]:w-auto min-h-7 min-w-[6rem] max-w-full @[820px]:[field-sizing:content] py-1 text-xs leading-snug text-muted-foreground border-transparent bg-transparent hover:border-border disabled:hover:border-transparent"
          : table
            ? "w-full min-h-8 py-1.5 text-sm leading-snug border-transparent bg-transparent group-hover:border-border group-hover:bg-background disabled:group-hover:border-transparent disabled:group-hover:bg-transparent"
            : "w-full min-h-8 py-1.5 text-sm leading-snug border-border bg-background"
      }`} />
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
        <span className="w-24"><UnitCell value={m.unit} disabled={!canEdit} className={f} onCommit={(v) => onUpdate({ unit: v })} /></span>
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
                <UnitOptions value={unit} />
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


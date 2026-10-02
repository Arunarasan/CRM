import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, Copy, Hammer, Loader2, MoreVertical, Package, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { boqApi } from "@/api/boqApi";
import {
  BOQ_CATEGORIES, BOQ_UNITS,
  type Boq, type BoqItem, type BoqItemLabour, type BoqItemMaterial, type ProductRef,
} from "@/types/boq";
import { NumCell, ProductSearch, SelectCell, TextCell } from "./cells";

// Spreadsheet-style BOQ editor: every item, material and labour line is edited in place, saved on
// blur, and the BOQ is re-fetched after each save so server-calculated totals stay authoritative.

const inr = (v?: number | null) =>
  "₹" + Number(v ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const errMsg = (e: any, fallback: string) =>
  e?.response?.data?.message || (typeof e?.response?.data === "string" ? e.response.data : "") || fallback;

const AREA_UNITS = ["Sqft", "Sqm"];
const LABOUR_RATES_KEY = "boqLabourRates";
const LABOUR_TYPES_LIST = "boq-labour-types";
const FLOORS_LIST = "boq-floor-names";

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

/** Payload for the full-replace item update — children are managed by their own endpoints. */
function itemPayload(item: BoqItem, patch: Partial<BoqItem>): Partial<BoqItem> {
  const { materials: _m, labours: _l, ...rest } = item;
  return { ...rest, ...patch };
}
function materialPayload(m: BoqItemMaterial, patch: Partial<BoqItemMaterial>): Partial<BoqItemMaterial> {
  return { ...m, product: m.product?.id ? { id: m.product.id } : undefined, ...patch };
}

type Group = { floor: string; rooms: { room: string; items: BoqItem[] }[] };

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
   * "Type the total": scale the item's material + labour rates so the item adds up to the target.
   * An item with no priced lines gets one material line carrying the whole price.
   */
  const setItemAmount = (item: BoqItem, target: number) => {
    const id = item.id as number;
    const current = Number(item.amount ?? 0);
    if (target < 0 || Math.abs(target - current) < 0.005) return;
    const round2 = (n: number) => Math.round(n * 100) / 100;
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
        if (x.kind === "m") updateMaterial(id, x.id, { quantity: 1, wastePercent: 0, sellingRate: round2(target) });
        else updateLabour(id, x.id, { quantity: 1, rate: round2(target) });
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
        : { quantity: 1, wastePercent: 0, sellingRate: round2(target) });
      return;
    }
    const qty = Number(item.quantity ?? 0) > 0 ? Number(item.quantity) : 1;
    const r = round2(target / qty);
    const even = Math.abs(r * qty - target) < 0.005;
    save("set the amount", () => boqApi.addMaterial(boqId, id, {
      materialName: item.itemName || "Item", quantity: even ? qty : 1, unit: item.unit, wastePercent: 0,
      sellingRate: even ? r : round2(target),
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

  /** Add an item with its price in one go: Rate × Qty becomes one price line on it. */
  const addPricedItem = (it: Partial<BoqItem>, rate: number) =>
    save("add the item", async () => {
      const created = await boqApi.addItem(boqId, it);
      if (rate > 0 && created?.id) {
        await boqApi.addMaterial(boqId, created.id, {
          materialName: it.itemName || "Item", quantity: it.quantity ?? 1, unit: it.unit, wastePercent: 0, sellingRate: rate,
        });
      }
    });

  // ---------------- Derived view data ----------------

  const items = useMemo(() => [...(boq.items || [])].sort(compareItems), [boq.items]);

  const groups: Group[] = useMemo(() => {
    const out: Group[] = [];
    for (const it of items) {
      const floor = it.floorName || "General";
      const room = it.roomName || "General";
      let g = out.find((x) => x.floor === floor);
      if (!g) { g = { floor, rooms: [] }; out.push(g); }
      let r = g.rooms.find((x) => x.room === room);
      if (!r) { r = { room, items: [] }; g.rooms.push(r); }
      r.items.push(it);
    }
    return out;
  }, [items]);

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

  const roomTotal = (list: BoqItem[]) =>
    list.filter((i) => i.isActive !== false).reduce((s, i) => s + Number(i.amount ?? 0), 0);

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
      <datalist id={FLOORS_LIST}>
        {groups.map((g) => <option key={g.floor} value={g.floor} />)}
      </datalist>

      <div className="rounded-xl border overflow-hidden">
        {/* Column header (desktop) */}
        <div className={`hidden md:grid ${ROW} items-center bg-muted/60 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground`}>
          <span title="In the quote">✓</span>
          <span>Item &amp; description</span>
          <span className="text-center">Size (L × W)</span>
          <span className="text-right">Qty</span>
          <span>Unit</span>
          <span className="text-right">Rate ₹</span>
          <span className="text-right">Amount ₹</span>
          <span />
        </div>

        {groups.length === 0 && (
          <p className="text-sm text-muted-foreground p-6 text-center">
            No items yet. Add a room and its first item below.
          </p>
        )}

        {groups.map((g) => (
          <div key={g.floor}>
            {(groups.length > 1 || g.floor !== "General") && (
              <div className="border-t bg-primary/[0.06] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-primary">{g.floor}</div>
            )}
            {g.rooms.map((r) => {
              const on = r.items.filter((i) => i.isActive !== false).length;
              return (
                <div key={r.room} className="border-t">
                  {/* Room row */}
                  <div className="flex items-center gap-2 bg-muted/30 px-3 py-2">
                    <input type="checkbox" className="h-4 w-4 accent-primary" disabled={!canEdit}
                      title="Whole room in the quote" aria-label={`${r.room} in quote`}
                      ref={(el) => { if (el) el.indeterminate = on > 0 && on < r.items.length; }}
                      checked={on === r.items.length} onChange={() => setIncluded(r.items, on !== r.items.length)} />
                    <span className="font-semibold text-sm flex-1">
                      {r.room}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">{r.items.length} item{r.items.length === 1 ? "" : "s"}</span>
                    </span>
                    <span className="text-sm font-bold tabular-nums">{inr(roomTotal(r.items))}</span>
                  </div>

                  <div className="divide-y">
                    {r.items.map((item) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        canEdit={canEdit}
                        showLines={showLines}
                        onUpdate={(patch) => updateItem(item.id as number, patch)}
                        onQty={(v) => updateQty(item, v)}
                        onSize={(f, v) => updateSize(item, f, v)}
                        onSetAmount={(v) => setItemAmount(item, v)}
                        onUpdateMaterial={(mid, patch) => updateMaterial(item.id as number, mid, patch)}
                        onUpdateLabour={(lid, patch) => updateLabour(item.id as number, lid, patch)}
                        rateFor={rateFor}
                        onDeleteMaterial={(mid) => save("remove the material", () => boqApi.deleteMaterial(boqId, item.id as number, mid))}
                        onDeleteLabour={(lid) => save("remove the labour", () => boqApi.deleteLabour(boqId, item.id as number, lid))}
                        onAddMaterial={(m) => save("add the material", () => boqApi.addMaterial(boqId, item.id as number, m))}
                        onAddLabour={(l) => { rememberRate(l.workType, l.rate); return save("add the labour", () => boqApi.addLabour(boqId, item.id as number, l)); }}
                        onDelete={() => {
                          if (!window.confirm(`Remove "${item.itemName}"?`)) return;
                          save("delete the item", () => boqApi.deleteItem(boqId, item.id as number));
                        }}
                        onToggleActive={() => save("update the quote", () => boqApi.toggleItemActive(boqId, item.id as number, item.isActive === false))}
                        onCopyFrom={() => setBulk({ mode: "copy", targets: [item.id as number] })}
                      />
                    ))}
                  </div>
                  {canEdit && (
                    <NewItemRow
                      onAdd={(it, rate) => addPricedItem({ ...it, floorName: g.floor === "General" ? undefined : g.floor, roomName: r.room }, rate)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {canEdit && <NewRoomRow onAdd={(it, rate) => addPricedItem(it, rate)} />}

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

function SaveState({ pending, lastSaved }: { pending: number; lastSaved: number | null }) {
  if (pending > 0) return <span className="flex items-center gap-1"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</span>;
  if (lastSaved) return <span className="flex items-center gap-1 text-green-600"><Check className="h-3.5 w-3.5" /> All changes saved</span>;
  return <span>Type in any box — it saves by itself</span>;
}

// ---------------------------------------------------------------------------
// One item = one table row: tick · name + description · size · qty · unit · rate · amount.
// Rate × Qty = Amount, like an invoice; typing either one sets the price. The material / labour
// cost breakdown sits behind "Details" (or "Show cost breakdown") for whoever prices the work.
// ---------------------------------------------------------------------------

/** Desktop column layout shared by the header and every item row. */
const ROW = "md:grid md:grid-cols-[28px_minmax(0,1fr)_150px_72px_92px_104px_116px_64px] md:gap-2";

/** Visible input styling for editable cells (the bare spreadsheet cells only show a border on hover). */
const FIELD = "!border-border !bg-background";

function ItemRow({
  item, canEdit, showLines, onUpdate, onQty, onSize, onSetAmount,
  onUpdateMaterial, onUpdateLabour, onDeleteMaterial, onDeleteLabour, onAddMaterial, onAddLabour,
  onDelete, onToggleActive, onCopyFrom, rateFor,
}: {
  item: BoqItem;
  canEdit: boolean;
  showLines: boolean;
  onUpdate: (patch: Partial<BoqItem>) => void;
  onQty: (v: number | null) => void;
  onSize: (field: "length" | "width", v: number | null) => void;
  onSetAmount: (target: number) => void;
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
  const amount = Number(item.amount ?? 0);
  const rate = qty > 0 ? Math.round((amount / qty) * 100) / 100 : amount;
  const f = canEdit ? FIELD : "";
  const detailsOpen = open || showLines;

  return (
    <div className={inactive ? "bg-muted/40" : ""}>
      <div className={`grid grid-cols-[28px_minmax(0,1fr)_auto] gap-x-2 gap-y-1.5 items-start px-3 py-2.5 ${ROW} md:items-start`}>
        {/* ✓ in quote */}
        <input type="checkbox" aria-label={`${item.itemName} in quote`} title="In the quote (customer's choice)"
          className="mt-2 h-4 w-4 accent-primary justify-self-center" disabled={!canEdit}
          checked={!inactive} onChange={onToggleActive} />

        {/* Item + description */}
        <div className={`min-w-0 ${inactive ? "opacity-60" : ""}`}>
          <div className="flex items-center gap-1.5">
            <TextCell value={item.itemName} col="itemName" disabled={!canEdit} className={`font-medium ${f}`}
              onCommit={(v) => v && onUpdate({ itemName: v })} />
            {inactive && <span className="shrink-0 text-[10px] uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">Not in quote</span>}
          </div>
          <DescriptionBox value={item.description} disabled={!canEdit}
            onCommit={(v) => onUpdate({ description: v || undefined })} />
        </div>

        {/* Actions (mobile: top-right) */}
        <div className="row-start-1 col-start-3 md:hidden flex items-center">
          <RowActions canEdit={canEdit} open={detailsOpen} lineCount={lineCount} onToggle={() => setOpen((v) => !v)}
            onAddMaterial={() => { setOpen(true); setAdding("material"); }} onAddLabour={() => { setOpen(true); setAdding("labour"); }}
            onCopyFrom={onCopyFrom} onDelete={onDelete} />
        </div>

        {/* Numbers — a labelled 2×2 grid on phones, table cells on desktop */}
        <div className="col-span-3 col-start-1 md:col-span-1 md:col-start-auto grid grid-cols-2 gap-2 md:contents pl-[36px] md:pl-0">
          <Cell label="Size (L × W)">
            <div className="flex items-center gap-1">
              <NumCell value={item.length} col="length" placeholder="L" disabled={!canEdit} className={`text-center ${f}`} onCommit={(v) => onSize("length", v)} />
              <span className="text-muted-foreground text-xs">×</span>
              <NumCell value={item.width} col="width" placeholder="W" disabled={!canEdit} className={`text-center ${f}`} onCommit={(v) => onSize("width", v)} />
            </div>
          </Cell>
          <Cell label="Qty">
            <NumCell value={item.quantity} col="qty" disabled={!canEdit} className={f} onCommit={onQty} />
          </Cell>
          <Cell label="Unit">
            <SelectCell value={item.unit} options={BOQ_UNITS} disabled={!canEdit} className={f} onCommit={(v) => onUpdate({ unit: v })} />
          </Cell>
          <Cell label="Rate ₹">
            <NumCell value={rate} col="rate" disabled={!canEdit} className={f}
              onCommit={(v) => v != null && onSetAmount(Math.round(v * (qty > 0 ? qty : 1) * 100) / 100)} />
          </Cell>
          <Cell label="Amount ₹" className="col-span-2 md:col-span-1">
            <NumCell value={item.amount} col="amount" disabled={!canEdit}
              className={`font-semibold ${canEdit ? "!border-primary/40 !bg-primary/[0.04]" : ""}`}
              onCommit={(v) => v != null && onSetAmount(v)} />
          </Cell>
        </div>

        <div className="hidden md:flex items-center justify-end pt-0.5">
          <RowActions canEdit={canEdit} open={detailsOpen} lineCount={lineCount} onToggle={() => setOpen((v) => !v)}
            onAddMaterial={() => { setOpen(true); setAdding("material"); }} onAddLabour={() => { setOpen(true); setAdding("labour"); }}
            onCopyFrom={onCopyFrom} onDelete={onDelete} />
        </div>
      </div>

      {/* ---- Details: category + material / labour behind the amount ---- */}
      {detailsOpen && (
        <div className="mx-3 mb-3 md:ml-[44px] rounded-lg bg-muted/40 p-2 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 px-1 text-xs text-muted-foreground">
            <span>Cost breakdown</span>
            <span>·</span>
            <span className="flex items-center gap-1">Category
              <SelectCell value={item.category} options={BOQ_CATEGORIES} disabled={!canEdit}
                className="h-6 w-auto rounded-full bg-background px-2 text-[11px]" onCommit={(v) => onUpdate({ category: v })} />
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
    if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; }
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

function NewItemRow({ onAdd }: { onAdd: (item: Partial<BoqItem>, rate: number) => void }) {
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("Nos");
  const [rate, setRate] = useState("");
  const submit = () => {
    if (!name.trim()) return;
    onAdd({ itemName: name.trim(), quantity: Number(qty) || 1, unit, category: "Others" }, Number(rate) || 0);
    setName(""); setQty("1"); setRate("");
  };
  const onKey = (e: React.KeyboardEvent) => e.key === "Enter" && submit();
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-t bg-muted/10">
      <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
      <Input placeholder="Add item to this room…" className="h-8 flex-1 min-w-[10rem]" value={name}
        onChange={(e) => setName(e.target.value)} onKeyDown={onKey} />
      <Input inputMode="decimal" className="h-8 w-16 text-right" value={qty} onChange={(e) => setQty(e.target.value)}
        onKeyDown={onKey} aria-label="Quantity" title="Quantity" />
      <select className="h-8 rounded-md border bg-background px-1 text-sm" value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="Unit">
        {BOQ_UNITS.map((u) => <option key={u}>{u}</option>)}
      </select>
      <Input inputMode="decimal" placeholder="Rate ₹" className="h-8 w-24 text-right" value={rate}
        onChange={(e) => setRate(e.target.value)} onKeyDown={onKey} aria-label="Rate" />
      <Button size="sm" disabled={!name.trim()} onClick={submit}>Add</Button>
    </div>
  );
}

function NewRoomRow({ onAdd }: { onAdd: (item: Partial<BoqItem>, rate: number) => void }) {
  const [floor, setFloor] = useState("");
  const [room, setRoom] = useState("");
  const [name, setName] = useState("");
  const [rate, setRate] = useState("");
  const ready = room.trim() && name.trim();
  const submit = () => {
    if (!ready) return;
    onAdd({ floorName: floor.trim() || undefined, roomName: room.trim(), itemName: name.trim(), quantity: 1, unit: "Nos", category: "Others" }, Number(rate) || 0);
    setRoom(""); setName(""); setRate("");
  };
  const onKey = (e: React.KeyboardEvent) => e.key === "Enter" && submit();
  return (
    <div className="rounded-xl border border-dashed p-3 flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium flex items-center gap-1"><Plus className="h-4 w-4" /> New room</span>
      <Input placeholder="Room name (e.g. Master Bedroom)" className="h-8 w-56" value={room} onChange={(e) => setRoom(e.target.value)} onKeyDown={onKey} />
      <Input placeholder="First item" className="h-8 flex-1 min-w-[10rem]" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onKey} />
      <Input inputMode="decimal" placeholder="Rate ₹" className="h-8 w-24 text-right" value={rate} onChange={(e) => setRate(e.target.value)} onKeyDown={onKey} />
      <Input list={FLOORS_LIST} placeholder="Floor (optional)" className="h-8 w-36" value={floor} onChange={(e) => setFloor(e.target.value)} onKeyDown={onKey} />
      <Button size="sm" disabled={!ready} onClick={submit}>Add room</Button>
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
                  <span className="truncate">{[i.roomName, i.itemName].filter(Boolean).join(" › ")}</span>
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
                      {[i.floorName, i.roomName, i.itemName].filter(Boolean).join(" › ")} ({(i.materials?.length ?? 0) + (i.labours?.length ?? 0)} lines)
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


import { useEffect, useMemo, useRef, useState } from "react";
import { Ban, Check, Copy, Hammer, Loader2, MoreVertical, Package, Plus, RotateCcw, Trash2 } from "lucide-react";
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
    return updateItem(item.id as number, patch);
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

  const [showLines, setShowLines] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const toggleSel = (id: number) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  useEffect(() => {
    // Drop selections for items that no longer exist.
    setSelected((s) => new Set([...s].filter((id) => items.some((i) => i.id === id))));
  }, [items]);

  const [bulk, setBulk] = useState<null | { mode: "labour" } | { mode: "copy"; targets: number[] }>(null);

  const roomTotal = (list: BoqItem[]) =>
    list.filter((i) => i.isActive !== false).reduce((s, i) => s + Number(i.amount ?? 0), 0);

  // ---------------- Render ----------------

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <SaveState pending={pending} lastSaved={lastSaved} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selected.size > 0 && canEdit && (
            <>
              <span className="text-xs font-medium">{selected.size} selected</span>
              <Button size="sm" variant="outline" onClick={() => setBulk({ mode: "labour" })}>
                <Hammer className="h-3.5 w-3.5 mr-1" /> Add labour to selected
              </Button>
              <Button size="sm" variant="outline" onClick={() => setBulk({ mode: "copy", targets: [...selected] })}>
                <Copy className="h-3.5 w-3.5 mr-1" /> Copy lines into selected
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
            </>
          )}
          <Button size="sm" variant="ghost" onClick={() => setShowLines((v) => !v)}>
            {showLines ? "Totals only" : "Show material & labour"}
          </Button>
        </div>
      </div>

      <datalist id={LABOUR_TYPES_LIST}>
        {Object.values(labourRates).map((r) => <option key={r.label} value={r.label}>{`₹${r.rate}`}</option>)}
      </datalist>
      <datalist id={FLOORS_LIST}>
        {groups.map((g) => <option key={g.floor} value={g.floor} />)}
      </datalist>

      {/* Column header (desktop) */}
      <div className="hidden md:grid grid-cols-[28px_minmax(0,1fr)_64px_64px_80px_84px_96px_96px_104px_32px] gap-1 px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <span />
        <span>Item</span>
        <span className="text-right">L</span>
        <span className="text-right">W</span>
        <span className="text-right">Qty</span>
        <span>Unit</span>
        <span className="text-right">Material</span>
        <span className="text-right">Labour</span>
        <span className="text-right">Amount</span>
        <span />
      </div>

      {groups.length === 0 && (
        <p className="text-sm text-muted-foreground border rounded-lg p-4 text-center">
          No items yet. Add a room and its first item below.
        </p>
      )}

      {groups.map((g) => (
        <div key={g.floor} className="space-y-2">
          {groups.length > 1 || g.floor !== "General" ? (
            <div className="text-xs font-semibold uppercase tracking-wide text-primary px-1">{g.floor}</div>
          ) : null}
          {g.rooms.map((r) => (
            <div key={r.room} className="rounded-lg border bg-card overflow-visible">
              <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/40 rounded-t-lg">
                <span className="font-medium text-sm">{r.room}</span>
                <span className="text-sm font-semibold tabular-nums">{inr(roomTotal(r.items))}</span>
              </div>
              <div className="divide-y">
                {r.items.map((item) => (
                  <ItemBlock
                    key={item.id}
                    item={item}
                    canEdit={canEdit}
                    showLines={showLines}
                    selected={selected.has(item.id as number)}
                    onToggleSelect={() => toggleSel(item.id as number)}
                    onUpdate={(patch) => updateItem(item.id as number, patch)}
                    onSize={(f, v) => updateSize(item, f, v)}
                    onUpdateMaterial={(mid, patch) => updateMaterial(item.id as number, mid, patch)}
                    onUpdateLabour={(lid, patch) => updateLabour(item.id as number, lid, patch)}
                    rateFor={rateFor}
                    onDeleteMaterial={(mid) => save("remove the material", () => boqApi.deleteMaterial(boqId, item.id as number, mid))}
                    onDeleteLabour={(lid) => save("remove the labour", () => boqApi.deleteLabour(boqId, item.id as number, lid))}
                    onAddMaterial={(m) => save("add the material", () => boqApi.addMaterial(boqId, item.id as number, m))}
                    onAddLabour={(l) => { rememberRate(l.workType, l.rate); return save("add the labour", () => boqApi.addLabour(boqId, item.id as number, l)); }}
                    onDelete={() => {
                      if (!window.confirm(`Remove "${item.itemName}" from the pricing?`)) return;
                      save("delete the item", () => boqApi.deleteItem(boqId, item.id as number));
                    }}
                    onToggleActive={() => save("update the item", () => boqApi.toggleItemActive(boqId, item.id as number, item.isActive === false))}
                    onCopyFrom={() => setBulk({ mode: "copy", targets: [item.id as number] })}
                  />
                ))}
              </div>
              {canEdit && (
                <NewItemRow
                  onAdd={(it) => save("add the item", () => boqApi.addItem(boqId, { ...it, floorName: g.floor === "General" ? undefined : g.floor, roomName: r.room }))}
                />
              )}
            </div>
          ))}
        </div>
      ))}

      {canEdit && <NewRoomRow onAdd={(it) => save("add the room", () => boqApi.addItem(boqId, it))} />}

      <BulkDialog
        state={bulk}
        items={items}
        selectedCount={selected.size}
        rateFor={rateFor}
        onClose={() => setBulk(null)}
        onAddLabour={(workType, rate) => {
          const targets = items.filter((i) => selected.has(i.id as number));
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
  return <span>Edit any cell — changes save automatically</span>;
}

// ---------------------------------------------------------------------------
// One item with its material + labour lines
// ---------------------------------------------------------------------------

const ROW_GRID = "md:grid md:grid-cols-[28px_minmax(0,1fr)_64px_64px_80px_84px_96px_96px_104px_32px] md:gap-1 md:items-center";

function ItemBlock({
  item, canEdit, showLines, selected, onToggleSelect, onUpdate, onSize,
  onUpdateMaterial, onUpdateLabour, onDeleteMaterial, onDeleteLabour, onAddMaterial, onAddLabour,
  onDelete, onToggleActive, onCopyFrom, rateFor,
}: {
  item: BoqItem;
  canEdit: boolean;
  showLines: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onUpdate: (patch: Partial<BoqItem>) => void;
  onSize: (field: "length" | "width", v: number | null) => void;
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
  const [adding, setAdding] = useState<null | "material" | "labour">(null);
  const lineCount = (item.materials?.length ?? 0) + (item.labours?.length ?? 0);

  return (
    <div className={`px-2 py-2 ${inactive ? "opacity-50" : ""} ${selected ? "bg-primary/[0.04]" : ""}`}>
      {/* Item row */}
      <div className={`grid grid-cols-[28px_1fr_32px] gap-1 items-center ${ROW_GRID}`}>
        <input
          type="checkbox"
          aria-label={`Select ${item.itemName}`}
          className="h-4 w-4 accent-primary justify-self-center"
          checked={selected}
          disabled={!canEdit}
          onChange={onToggleSelect}
        />
        <div className="min-w-0">
          <TextCell value={item.itemName} col="itemName" disabled={!canEdit} className="font-medium"
            onCommit={(v) => v && onUpdate({ itemName: v })} />
          <div className="flex items-center gap-1 px-2">
            <SelectCell value={item.category} options={BOQ_CATEGORIES} disabled={!canEdit}
              className="h-6 w-auto text-[11px] text-muted-foreground px-1"
              onCommit={(v) => onUpdate({ category: v })} />
            {inactive && <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Excluded</span>}
            {!showLines && lineCount > 0 && <span className="text-[11px] text-muted-foreground">{lineCount} line(s)</span>}
          </div>
        </div>

        {/* Mobile: the numeric cells wrap under the name in a labelled grid. */}
        <div className="col-span-3 grid grid-cols-4 gap-1 md:contents">
          <Labelled label="L"><NumCell value={item.length} col="length" disabled={!canEdit} onCommit={(v) => onSize("length", v)} /></Labelled>
          <Labelled label="W"><NumCell value={item.width} col="width" disabled={!canEdit} onCommit={(v) => onSize("width", v)} /></Labelled>
          <Labelled label="Qty"><NumCell value={item.quantity} col="qty" disabled={!canEdit} onCommit={(v) => onUpdate({ quantity: v ?? undefined })} /></Labelled>
          <Labelled label="Unit"><SelectCell value={item.unit} options={BOQ_UNITS} disabled={!canEdit} onCommit={(v) => onUpdate({ unit: v })} /></Labelled>
          <Labelled label="Material" className="col-span-1"><Money v={item.materialTotal} muted /></Labelled>
          <Labelled label="Labour"><Money v={item.labourTotal} muted /></Labelled>
          <Labelled label="Amount" className="col-span-2 md:col-span-1"><Money v={item.amount} strong /></Labelled>
        </div>

        <div className="row-start-1 col-start-3 md:row-auto md:col-auto justify-self-end">
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center" aria-label="Item actions">
                  <MoreVertical className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setAdding("material")}><Package className="h-4 w-4 mr-2" /> Add material</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAdding("labour")}><Hammer className="h-4 w-4 mr-2" /> Add labour</DropdownMenuItem>
                <DropdownMenuItem onClick={onCopyFrom}><Copy className="h-4 w-4 mr-2" /> Copy lines from another item…</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onToggleActive}>
                  {inactive ? <><RotateCcw className="h-4 w-4 mr-2" /> Include in quote</> : <><Ban className="h-4 w-4 mr-2" /> Exclude from quote</>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDelete} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" /> Delete item</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Material + labour lines */}
      {showLines && (
        <div className="mt-1 md:ml-[28px] space-y-0.5 border-l-2 border-muted pl-2">
          {lineCount > 0 && (
            <div className={`hidden sm:grid ${LINE_GRID} text-[10px] uppercase tracking-wide text-muted-foreground`}>
              <span />
              <span className="px-2">Material / labour</span>
              <span className="text-right px-2">Qty</span>
              <span className="text-right px-2">Waste %</span>
              <span className="px-2">Unit</span>
              <span className="text-right px-2">Rate</span>
              <span className="text-right px-1">Amount</span>
              <span />
            </div>
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
            <div className="flex items-center gap-2 py-1">
              <Package className="h-3.5 w-3.5 text-sky-600 shrink-0" />
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
            <div className="flex gap-1 pt-0.5">
              <button type="button" onClick={() => setAdding("material")}
                className="text-[11px] text-sky-700 hover:bg-sky-50 rounded px-1.5 py-0.5 flex items-center gap-1">
                <Plus className="h-3 w-3" /> material
              </button>
              <button type="button" onClick={() => setAdding("labour")}
                className="text-[11px] text-amber-700 hover:bg-amber-50 rounded px-1.5 py-0.5 flex items-center gap-1">
                <Plus className="h-3 w-3" /> labour
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Labelled({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <span className="md:hidden block text-[10px] uppercase text-muted-foreground px-2">{label}</span>
      {children}
    </div>
  );
}

function Money({ v, strong, muted }: { v?: number | null; strong?: boolean; muted?: boolean }) {
  return (
    <div className={`px-2 text-right tabular-nums text-sm ${strong ? "font-semibold" : ""} ${muted ? "text-muted-foreground" : ""}`}>
      {inr(v)}
    </div>
  );
}

const LINE_GRID = "grid-cols-[16px_minmax(0,1fr)_72px_28px] sm:grid-cols-[16px_minmax(0,1fr)_64px_56px_72px_80px_88px_28px] gap-1";

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

  return (
    <div className={`grid ${LINE_GRID} items-center`}>
      <Package className="h-3.5 w-3.5 text-sky-600" />
      <div className="min-w-0">
        <TextCell value={m.materialName} col="matName" disabled={!canEdit} className="h-7 text-[13px]"
          onCommit={(v) => v && onUpdate({ materialName: v })} />
        {m.stockWarning && <p className="text-[10px] text-amber-700 px-2">{m.stockWarning}</p>}
      </div>
      <div className="hidden sm:block"><NumCell value={m.quantity} col="matQty" placeholder="qty" disabled={!canEdit} className="h-7 text-[13px]" onDraft={setQtyDraft} onCommit={(v) => onUpdate({ quantity: v ?? 0 })} /></div>
      <div className="hidden sm:block"><NumCell value={m.wastePercent} col="matWaste" placeholder="waste%" disabled={!canEdit} className="h-7 text-[13px]" onDraft={setWasteDraft} onCommit={(v) => onUpdate({ wastePercent: v ?? 0 })} /></div>
      <div className="hidden sm:block"><SelectCell value={m.unit} options={BOQ_UNITS} disabled={!canEdit} className="h-7 text-[13px]" onCommit={(v) => onUpdate({ unit: v })} /></div>
      <div className="hidden sm:block"><NumCell value={m.sellingRate} col="matRate" placeholder="rate" disabled={!canEdit} className="h-7 text-[13px]" onDraft={setRateDraft} onCommit={(v) => onUpdate({ sellingRate: v ?? 0 })} /></div>
      <div className="text-right text-[13px] tabular-nums px-1">{inr(live)}</div>
      <LineDelete canEdit={canEdit} onDelete={onDelete} />
      {/* Phone: qty / waste / rate on their own row */}
      <div className="col-span-4 grid grid-cols-3 gap-1 sm:hidden pl-4">
        <Labelled label={`Qty${m.unit ? ` (${m.unit})` : ""}`}><NumCell value={m.quantity} placeholder="qty" disabled={!canEdit} className="h-7 text-[13px]" onDraft={setQtyDraft} onCommit={(v) => onUpdate({ quantity: v ?? 0 })} /></Labelled>
        <Labelled label="Waste %"><NumCell value={m.wastePercent} placeholder="waste%" disabled={!canEdit} className="h-7 text-[13px]" onDraft={setWasteDraft} onCommit={(v) => onUpdate({ wastePercent: v ?? 0 })} /></Labelled>
        <Labelled label="Rate ₹"><NumCell value={m.sellingRate} placeholder="rate" disabled={!canEdit} className="h-7 text-[13px]" onDraft={setRateDraft} onCommit={(v) => onUpdate({ sellingRate: v ?? 0 })} /></Labelled>
      </div>
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

  return (
    <div className={`grid ${LINE_GRID} items-center`}>
      <Hammer className="h-3.5 w-3.5 text-amber-600" />
      <TextCell value={l.workType} col="labType" list={LABOUR_TYPES_LIST} disabled={!canEdit} className="h-7 text-[13px]"
        placeholder="Work type"
        onCommit={(v) => {
          // Picking a known work type on a line with no rate fills in the rate you last used.
          const known = rateFor(v);
          onUpdate(!l.rate && known != null ? { workType: v, rate: known } : { workType: v });
        }} />
      <div className="hidden sm:block"><NumCell value={l.quantity} col="labQty" placeholder="qty" disabled={!canEdit} className="h-7 text-[13px]" onDraft={setQtyDraft} onCommit={(v) => onUpdate({ quantity: v ?? 0 })} /></div>
      <div className="hidden sm:block col-span-2">
        <TextCell value={l.contractorName} col="labWho" placeholder="Contractor (optional)" disabled={!canEdit} className="h-7 text-[13px]"
          onCommit={(v) => onUpdate({ contractorName: v || undefined })} />
      </div>
      <div className="hidden sm:block"><NumCell value={l.rate} col="labRate" placeholder="rate" disabled={!canEdit} className="h-7 text-[13px]" onDraft={setRateDraft} onCommit={(v) => onUpdate({ rate: v ?? 0 })} /></div>
      <div className="text-right text-[13px] tabular-nums px-1">{inr(live)}</div>
      <LineDelete canEdit={canEdit} onDelete={onDelete} />
      <div className="col-span-4 grid grid-cols-2 gap-1 sm:hidden pl-4">
        <Labelled label="Qty"><NumCell value={l.quantity} placeholder="qty" disabled={!canEdit} className="h-7 text-[13px]" onDraft={setQtyDraft} onCommit={(v) => onUpdate({ quantity: v ?? 0 })} /></Labelled>
        <Labelled label="Rate ₹"><NumCell value={l.rate} placeholder="rate" disabled={!canEdit} className="h-7 text-[13px]" onDraft={setRateDraft} onCommit={(v) => onUpdate({ rate: v ?? 0 })} /></Labelled>
      </div>
    </div>
  );
}

function LineDelete({ canEdit, onDelete }: { canEdit: boolean; onDelete: () => void }) {
  if (!canEdit) return <span />;
  return (
    <button type="button" onClick={onDelete} aria-label="Remove line"
      className="h-6 w-6 rounded hover:bg-destructive/10 flex items-center justify-center justify-self-end">
      <Trash2 className="h-3 w-3 text-destructive" />
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

function NewItemRow({ onAdd }: { onAdd: (item: Partial<BoqItem>) => void }) {
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("Nos");
  const [category, setCategory] = useState("Others");
  const submit = () => {
    if (!name.trim()) return;
    onAdd({ itemName: name.trim(), quantity: Number(qty) || 1, unit, category });
    setName(""); setQty("1");
  };
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-t bg-muted/20 rounded-b-lg">
      <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
      <Input placeholder="Add item to this room, press Enter" className="h-8 flex-1 min-w-[10rem]" value={name}
        onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
      <Input inputMode="decimal" className="h-8 w-16 text-right" value={qty} onChange={(e) => setQty(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()} aria-label="Quantity" />
      <select className="h-8 rounded-md border bg-background px-1 text-sm" value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="Unit">
        {BOQ_UNITS.map((u) => <option key={u}>{u}</option>)}
      </select>
      <select className="h-8 rounded-md border bg-background px-1 text-sm" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
        {BOQ_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
      </select>
      {name.trim() && <Button size="sm" onClick={submit}>Add</Button>}
    </div>
  );
}

function NewRoomRow({ onAdd }: { onAdd: (item: Partial<BoqItem>) => void }) {
  const [floor, setFloor] = useState("");
  const [room, setRoom] = useState("");
  const [name, setName] = useState("");
  const ready = room.trim() && name.trim();
  const submit = () => {
    if (!ready) return;
    onAdd({ floorName: floor.trim() || undefined, roomName: room.trim(), itemName: name.trim(), quantity: 1, unit: "Nos", category: "Others" });
    setRoom(""); setName("");
  };
  const onKey = (e: React.KeyboardEvent) => e.key === "Enter" && submit();
  return (
    <div className="rounded-lg border border-dashed p-3 flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium flex items-center gap-1"><Plus className="h-4 w-4" /> New room</span>
      <Input list={FLOORS_LIST} placeholder="Floor (optional)" className="h-8 w-36" value={floor} onChange={(e) => setFloor(e.target.value)} onKeyDown={onKey} />
      <Input placeholder="Room name" className="h-8 w-40" value={room} onChange={(e) => setRoom(e.target.value)} onKeyDown={onKey} />
      <Input placeholder="First item" className="h-8 flex-1 min-w-[10rem]" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onKey} />
      <Button size="sm" disabled={!ready} onClick={submit}>Add room</Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bulk actions: add one labour line to many items / copy lines from one item to others
// ---------------------------------------------------------------------------

function BulkDialog({
  state, items, selectedCount, rateFor, onClose, onAddLabour, onCopy,
}: {
  state: null | { mode: "labour" } | { mode: "copy"; targets: number[] };
  items: BoqItem[];
  selectedCount: number;
  rateFor: (workType: string) => number | undefined;
  onClose: () => void;
  onAddLabour: (workType: string, rate: number) => void;
  onCopy: (sourceId: number, targetIds: number[]) => void;
}) {
  const [workType, setWorkType] = useState("");
  const [rate, setRate] = useState("");
  const [sourceId, setSourceId] = useState<number | "">("");
  useEffect(() => { setWorkType(""); setRate(""); setSourceId(""); }, [state]);

  const targets = state?.mode === "copy" ? state.targets : [];
  const sources = items.filter((i) => !targets.includes(i.id as number) && ((i.materials?.length ?? 0) + (i.labours?.length ?? 0)) > 0);
  const src = items.find((i) => i.id === sourceId);

  return (
    <Dialog open={!!state} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        {state?.mode === "labour" && (
          <>
            <DialogHeader><DialogTitle>Add labour to {selectedCount} item(s)</DialogTitle></DialogHeader>
            <p className="text-xs text-muted-foreground">Each item gets one labour line, with quantity taken from that item's own quantity.</p>
            <div className="grid grid-cols-[1fr_120px] gap-2">
              <Input autoFocus list={LABOUR_TYPES_LIST} placeholder="Work type (e.g. Painter)" value={workType}
                onChange={(e) => { setWorkType(e.target.value); const k = rateFor(e.target.value); if (k != null && !rate) setRate(String(k)); }} />
              <Input inputMode="decimal" placeholder="Rate ₹ / unit" value={rate} onChange={(e) => setRate(e.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button disabled={!workType.trim()} onClick={() => onAddLabour(workType.trim(), Number(rate) || 0)}>Add to all</Button>
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


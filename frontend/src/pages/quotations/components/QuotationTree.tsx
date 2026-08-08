import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Pencil, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  buildQuotationTree,
  QUOTATION_ITEM_STATUS_STYLES,
  type QuotationItem,
} from "@/types/quotation";

function formatCurrency(value?: number) {
  if (value === undefined || value === null) return "—";
  return `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

interface Props {
  items: QuotationItem[];
  canApprove: boolean;
  editable: boolean;
  checked: Set<number>;
  onToggle: (id?: number) => void;
  onSaveItem: (item: QuotationItem) => Promise<void>;
  busy: boolean;
}

/** Editable pricing/annotation fields exposed on the work-item detail panel. */
type PricingDraft = Pick<
  QuotationItem,
  | "rate" | "discountPercentage" | "gstPercentage" | "additionalCharges"
  | "brand" | "specification" | "color" | "thickness" | "grade"
  | "estimatedDays" | "assignedContractor" | "remarks"
>;

export default function QuotationTree({ items, canApprove, editable, checked, onToggle, onSaveItem, busy }: Props) {
  const tree = useMemo(() => buildQuotationTree(items), [items]);

  // Floors/rooms are open by default (tracked as a set of *closed* keys) so the full house
  // structure is visible on load without pre-seeding every key.
  const [closedFloors, setClosedFloors] = useState<Set<string>>(new Set());
  const [closedRooms, setClosedRooms] = useState<Set<string>>(new Set());
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [editItem, setEditItem] = useState<number | null>(null);
  const [draft, setDraft] = useState<PricingDraft>({});

  const toggleFloor = (f: string) =>
    setClosedFloors((prev) => { const n = new Set(prev); n.has(f) ? n.delete(f) : n.add(f); return n; });
  const toggleRoom = (key: string) =>
    setClosedRooms((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const startEdit = (it: QuotationItem) => {
    setExpandedItem(it.id ?? null);
    setEditItem(it.id ?? null);
    setDraft({
      rate: it.rate, discountPercentage: it.discountPercentage, gstPercentage: it.gstPercentage,
      additionalCharges: it.additionalCharges, brand: it.brand, specification: it.specification,
      color: it.color, thickness: it.thickness, grade: it.grade, estimatedDays: it.estimatedDays,
      assignedContractor: it.assignedContractor, remarks: it.remarks,
    });
  };

  const saveEdit = async (it: QuotationItem) => {
    await onSaveItem({ ...it, ...draft });
    setEditItem(null);
  };

  if (tree.floors.length === 0) {
    return <div className="text-sm text-muted-foreground p-4 text-center">No items in this quotation.</div>;
  }

  return (
    <div className="space-y-3">
      {tree.floors.map((floor) => {
        const floorClosed = closedFloors.has(floor.floor);
        return (
          <div key={floor.floor} className="border rounded-lg overflow-hidden">
            {/* Floor header */}
            <button
              type="button"
              onClick={() => toggleFloor(floor.floor)}
              className="w-full flex items-center justify-between gap-2 bg-muted/60 px-3 py-2 text-left hover:bg-muted"
            >
              <span className="flex items-center gap-2 font-semibold">
                {floorClosed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {floor.floor}
                <span className="text-xs font-normal text-muted-foreground">({floor.itemCount} item{floor.itemCount === 1 ? "" : "s"})</span>
              </span>
              <span className="text-sm font-semibold">{formatCurrency(floor.total)}</span>
            </button>

            {!floorClosed && (
              <div className="divide-y">
                {floor.rooms.map((room) => {
                  const roomKey = `${floor.floor}::${room.room}`;
                  const roomClosed = closedRooms.has(roomKey);
                  return (
                    <div key={roomKey}>
                      {/* Room header */}
                      <button
                        type="button"
                        onClick={() => toggleRoom(roomKey)}
                        className="w-full flex items-center justify-between gap-2 px-3 py-1.5 pl-6 text-left hover:bg-muted/40"
                      >
                        <span className="flex items-center gap-2 font-medium text-sm">
                          {roomClosed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          {room.room}
                        </span>
                        <span className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Material {formatCurrency(room.material)}</span>
                          <span>Labour {formatCurrency(room.labour)}</span>
                          <span className="font-semibold text-foreground">{formatCurrency(room.total)}</span>
                        </span>
                      </button>

                      {!roomClosed && (
                        <div className="px-3 pb-2 pl-8">
                          {room.categories.map((cat) => (
                            <div key={cat.category} className="mt-2">
                              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                                {cat.category}
                              </div>
                              <table className="w-full text-sm">
                                <tbody>
                                  {cat.items.map((it) => {
                                    const expanded = expandedItem === it.id;
                                    const editing = editItem === it.id;
                                    return (
                                      <Fragment key={it.id}>
                                        <tr className="border-t align-top">
                                          {canApprove && (
                                            <td className="py-1.5 pr-2 w-8">
                                              {it.status === "PENDING" && (
                                                <input
                                                  type="checkbox" className="h-4 w-4"
                                                  checked={it.id !== undefined && checked.has(it.id)}
                                                  onChange={() => onToggle(it.id)}
                                                />
                                              )}
                                            </td>
                                          )}
                                          <td className="py-1.5 pr-2">
                                            <button type="button" className="flex items-start gap-1 text-left"
                                              onClick={() => setExpandedItem(expanded ? null : it.id ?? null)}>
                                              {expanded ? <ChevronDown className="h-3.5 w-3.5 mt-0.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 mt-0.5 shrink-0" />}
                                              <span>
                                                <span className="font-medium">{it.itemName}</span>
                                                {it.specification && <span className="block text-xs text-muted-foreground">{it.specification}</span>}
                                              </span>
                                            </button>
                                          </td>
                                          <td className="py-1.5 px-2 text-right whitespace-nowrap">{it.quantity} {it.unit}</td>
                                          <td className="py-1.5 px-2 text-right whitespace-nowrap text-muted-foreground">{formatCurrency(it.materialCost)}</td>
                                          <td className="py-1.5 px-2 text-right whitespace-nowrap text-muted-foreground">{formatCurrency(it.labourCost)}</td>
                                          <td className="py-1.5 px-2 text-right whitespace-nowrap font-medium">{formatCurrency(it.totalAmount)}</td>
                                          <td className="py-1.5 pl-2">
                                            <span className={`px-1.5 py-0.5 text-[10px] rounded-full font-medium ${QUOTATION_ITEM_STATUS_STYLES[it.status || "PENDING"]}`}>
                                              {it.status || "PENDING"}
                                            </span>
                                          </td>
                                        </tr>
                                        {expanded && (
                                          <tr className="border-t bg-muted/30">
                                            <td colSpan={canApprove ? 7 : 6} className="p-3">
                                              <ItemDetail
                                                item={it} editing={editing} draft={draft} setDraft={setDraft}
                                                editable={editable} busy={busy}
                                                onEdit={() => startEdit(it)}
                                                onCancel={() => setEditItem(null)}
                                                onSave={() => saveEdit(it)}
                                              />
                                            </td>
                                          </tr>
                                        )}
                                      </Fragment>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// --- Work Item detail panel (read-only Basic/Measurement/Material + editable Pricing) ---

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <span className="block text-[11px] text-muted-foreground">{label}</span>
      <span className="text-sm">{value ?? "—"}</span>
    </div>
  );
}

function NumInput({ label, value, onChange }: { label: string; value?: number; onChange: (v: number | undefined) => void }) {
  return (
    <label className="block">
      <span className="block text-[11px] text-muted-foreground mb-0.5">{label}</span>
      <input
        type="number" className="w-full rounded-md border px-2 py-1 text-sm bg-background"
        value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
      />
    </label>
  );
}

function TextInput({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="block text-[11px] text-muted-foreground mb-0.5">{label}</span>
      <input
        type="text" className="w-full rounded-md border px-2 py-1 text-sm bg-background"
        value={value ?? ""} onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

interface DetailProps {
  item: QuotationItem;
  editing: boolean;
  editable: boolean;
  busy: boolean;
  draft: PricingDraft;
  setDraft: React.Dispatch<React.SetStateAction<PricingDraft>>;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
}

function ItemDetail({ item, editing, editable, busy, draft, setDraft, onEdit, onCancel, onSave }: DetailProps) {
  const set = <K extends keyof PricingDraft>(k: K, v: PricingDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Field label="Category" value={item.category} />
        <Field label="Unit" value={item.unit} />
        <Field label="Length" value={item.length} />
        <Field label="Width" value={item.width} />
        <Field label="Height" value={item.height} />
        <Field label="Area" value={item.area} />
        <Field label="Quantity" value={item.quantity} />
        <Field label="Est. Days" value={item.estimatedDays} />
      </div>
      {item.description && <Field label="Description" value={item.description} />}

      {!editing ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Brand" value={item.brand} />
            <Field label="Specification" value={item.specification} />
            <Field label="Color" value={item.color} />
            <Field label="Thickness" value={item.thickness} />
            <Field label="Grade" value={item.grade} />
            <Field label="Assigned Contractor" value={item.assignedContractor} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 border-t pt-2">
            <Field label="Rate" value={formatCurrency(item.rate)} />
            <Field label="Discount %" value={item.discountPercentage} />
            <Field label="GST %" value={item.gstPercentage} />
            <Field label="Additional Charges" value={formatCurrency(item.additionalCharges)} />
            <Field label="Total" value={formatCurrency(item.totalAmount)} />
          </div>
          {item.remarks && <Field label="Remarks" value={item.remarks} />}
          {editable && (
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={onEdit}><Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit Pricing</Button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t pt-2">
            <TextInput label="Brand" value={draft.brand} onChange={(v) => set("brand", v)} />
            <TextInput label="Specification" value={draft.specification} onChange={(v) => set("specification", v)} />
            <TextInput label="Color" value={draft.color} onChange={(v) => set("color", v)} />
            <TextInput label="Thickness" value={draft.thickness} onChange={(v) => set("thickness", v)} />
            <TextInput label="Grade" value={draft.grade} onChange={(v) => set("grade", v)} />
            <TextInput label="Assigned Contractor" value={draft.assignedContractor} onChange={(v) => set("assignedContractor", v)} />
            <NumInput label="Est. Days" value={draft.estimatedDays} onChange={(v) => set("estimatedDays", v)} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <NumInput label="Rate" value={draft.rate} onChange={(v) => set("rate", v)} />
            <NumInput label="Discount %" value={draft.discountPercentage} onChange={(v) => set("discountPercentage", v)} />
            <NumInput label="GST %" value={draft.gstPercentage} onChange={(v) => set("gstPercentage", v)} />
            <NumInput label="Additional Charges" value={draft.additionalCharges} onChange={(v) => set("additionalCharges", v)} />
          </div>
          <TextInput label="Remarks" value={draft.remarks} onChange={(v) => set("remarks", v)} />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={onCancel} disabled={busy}><X className="mr-1.5 h-3.5 w-3.5" /> Cancel</Button>
            <Button size="sm" onClick={onSave} disabled={busy}><Save className="mr-1.5 h-3.5 w-3.5" /> Save</Button>
          </div>
        </>
      )}
    </div>
  );
}

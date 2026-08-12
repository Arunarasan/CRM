import { useCallback, useEffect, useRef, useState } from "react";
import { Combine, DoorOpen, Home, Image as ImageIcon, Inbox, Pencil, Plus, Ruler, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { measurementApi } from "@/api/measurementApi";
import {
  FLOOR_LEVELS, ITEM_TYPES, MEASUREMENT_UNITS, ROOM_TYPES, type MeasurementDrawing,
  type MeasurementItem, type MeasurementMedia, type MeasurementRoom,
} from "@/types/measurement";
import { CheckboxField, Field, SelectField, TextAreaField, TextField, selectClass } from "../../leads/fields";
import { ListSkeleton } from "../../leads/tabs/shared";
import EmptyState from "../../customer360/components/EmptyState";
import { useMeasurementSubResource } from "../helpers";

const SCOPE_FLAGS: { key: keyof MeasurementRoom; label: string }[] = [
  { key: "falseCeilingRequired", label: "False Ceiling" },
  { key: "flooringRequired", label: "Flooring" },
  { key: "paintingRequired", label: "Painting" },
  { key: "wardrobeRequired", label: "Wardrobe" },
  { key: "kitchenRequired", label: "Kitchen" },
  { key: "tvUnitRequired", label: "TV Unit" },
  { key: "loftRequired", label: "Loft" },
  { key: "storageRequired", label: "Storage" },
];

// roomType of the per-measurement "Unassigned" bucket that holds draft items with no room yet.
// Mirrors MeasurementService.DRAFT_ROOM_TYPE on the backend.
const DRAFT_ROOM_TYPE = "UNASSIGNED";
const isDraftRoom = (r: MeasurementRoom) => r.roomType === DRAFT_ROOM_TYPE;
const NEW_ROOM_OPTION = "__new_room__";

export default function RoomsTab({ measurementId, canWrite, onChanged }: {
  measurementId: number; canWrite: boolean; onChanged: () => void;
}) {
  const { items: rooms, loading, reload } = useMeasurementSubResource<MeasurementRoom>(
    () => measurementApi.getRooms(measurementId), [measurementId]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<MeasurementRoom | null>(null);
  const [detailRoom, setDetailRoom] = useState<MeasurementRoom | null>(null);
  const [startAddItem, setStartAddItem] = useState(false);
  // Every item across every room, so measured elements are visible and editable without
  // drilling into a per-room dialog first.
  const [allItems, setAllItems] = useState<(MeasurementItem & { roomId: number })[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  // Lifted so "Save & Add Items" on the room dialog can open item entry for the room just created.
  const [itemForm, setItemForm] = useState<Partial<MeasurementItem & { roomId: number }> | null>(null);
  // Item-first (bottom-up) is the default; the Floor→Room→Item tree stays available behind the toggle.
  const [view, setView] = useState<"items" | "tree">(
    () => (localStorage.getItem("measurementRoomsView") as "items" | "tree") || "items");
  useEffect(() => { localStorage.setItem("measurementRoomsView", view); }, [view]);
  const [mergeSource, setMergeSource] = useState<MeasurementRoom | null>(null);

  const loadAllItems = useCallback(() => {
    if (rooms.length === 0) { setAllItems([]); return; }
    setItemsLoading(true);
    Promise.all(rooms.map((room) =>
      measurementApi.getItems(measurementId, room.id!)
        .then((list) => list.map((i) => ({ ...i, roomId: room.id! })))
        .catch(() => [])
    ))
      .then((lists) => setAllItems(lists.flat()))
      .finally(() => setItemsLoading(false));
  }, [measurementId, rooms]);

  useEffect(() => { loadAllItems(); }, [loadAllItems]);

  const refresh = () => { reload(); loadAllItems(); onChanged(); };

  const itemCountFor = (roomId?: number) => allItems.filter((i) => i.roomId === roomId).length;

  // The "Unassigned" bucket is a real row but not a user-facing room — split it out everywhere.
  const draftRoom = rooms.find(isDraftRoom);
  const realRooms = rooms.filter((r) => !isDraftRoom(r));
  const unassignedItems = allItems.filter((i) => draftRoom && i.roomId === draftRoom.id);

  const removeRoom = (room: MeasurementRoom) => {
    if (!room.id || !confirm(`Delete room "${room.roomName}"?`)) return;
    measurementApi.deleteRoom(measurementId, room.id).then(refresh).catch(console.error);
  };

  // Floor → rooms, ordered by the standard floor list so Basement..Terrace read in building order.
  const floorGroups = (() => {
    const byFloor = new Map<string, MeasurementRoom[]>();
    realRooms.forEach((room) => {
      const floor = room.floorNumber?.trim() || "Unassigned Floor";
      if (!byFloor.has(floor)) byFloor.set(floor, []);
      byFloor.get(floor)!.push(room);
    });
    const rank = (floor: string) => {
      const i = FLOOR_LEVELS.indexOf(floor);
      return i === -1 ? FLOOR_LEVELS.length : i;
    };
    return [...byFloor.entries()].sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]));
  })();

  if (loading) return <ListSkeleton rows={3} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-semibold text-muted-foreground">
          {realRooms.length} room{realRooms.length === 1 ? "" : "s"}
          {view === "tree" && floorGroups.length > 1 && ` across ${floorGroups.length} floors`}
          {allItems.length > 0 && ` · ${allItems.length} item${allItems.length === 1 ? "" : "s"}`}
        </h3>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border bg-muted/40 p-0.5 text-xs">
            {(["items", "tree"] as const).map((v) => (
              <button key={v} type="button" onClick={() => setView(v)}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  view === v ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {v === "items" ? "Item-first" : "Room tree"}
              </button>
            ))}
          </div>
          {canWrite && view === "tree" && (
            <Button size="sm" onClick={() => { setEditingRoom(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Add Room
            </Button>
          )}
        </div>
      </div>

      {view === "items" ? (
        <ItemFirstView
          measurementId={measurementId}
          canWrite={canWrite}
          realRooms={realRooms}
          items={allItems}
          unassignedCount={unassignedItems.length}
          loading={itemsLoading}
          itemCountFor={itemCountFor}
          onChanged={refresh}
          onAddRoom={() => { setEditingRoom(null); setFormOpen(true); }}
          onEditRoom={(room) => { setEditingRoom(room); setFormOpen(true); }}
          onMergeRoom={(room) => setMergeSource(room)}
          onDeleteRoom={removeRoom}
        />
      ) : realRooms.length === 0 ? (
        <EmptyState icon={Home} title="No rooms added yet" description="Add a room first, then add the items measured inside it — walls, windows, cupboards, screens. Rooms and items both flow into the generated BOQ." />
      ) : (
        floorGroups.map(([floor, floorRooms]) => (
        <div key={floor} className="space-y-3">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{floor}</h4>
            <span className="text-xs text-muted-foreground">· {floorRooms.length} room{floorRooms.length === 1 ? "" : "s"}</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {floorRooms.map((room) => (
            <Card key={room.id} className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => setDetailRoom(room)}>
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold">{room.roomName}</div>
                    <div className="text-xs text-muted-foreground">
                      {room.roomType || "Room"} · {itemCountFor(room.id)} item{itemCountFor(room.id) === 1 ? "" : "s"}
                    </div>
                  </div>
                  {canWrite && (
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); removeRoom(room); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div><span className="text-muted-foreground block">L×W×H</span>
                    <span className="font-medium">{room.length ?? "—"}×{room.width ?? "—"}×{room.height ?? "—"} ft</span></div>
                  <div><span className="text-muted-foreground block">Floor Area</span>
                    <span className="font-medium">{room.floorArea ? `${room.floorArea} sqft` : "—"}</span></div>
                  <div><span className="text-muted-foreground block">Wall Area</span>
                    <span className="font-medium">{room.wallArea ? `${room.wallArea} sqft` : "—"}</span></div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {SCOPE_FLAGS.filter((f) => room[f.key]).map((f) => (
                    <Badge key={String(f.key)} variant="secondary" className="text-[10px]">{f.label}</Badge>
                  ))}
                  {/* Scope flags become derived work items and items copy across — with neither, the
                      room contributes nothing to the BOQ and would silently go missing. */}
                  {itemCountFor(room.id) === 0 && !SCOPE_FLAGS.some((f) => room[f.key]) && (
                    <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700">
                      No BOQ lines — add scope or items
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  {canWrite && (
                    <Button size="sm" className="flex-1"
                      onClick={(e) => { e.stopPropagation(); setDetailRoom(room); setStartAddItem(true); }}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Item
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="flex-1" onClick={(e) => { e.stopPropagation(); setDetailRoom(room); }}>
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          </div>
        </div>
        ))
      )}

      {view === "tree" && realRooms.length > 0 && (
        <MeasuredItemsPanel
          measurementId={measurementId}
          rooms={realRooms}
          items={allItems}
          loading={itemsLoading}
          canWrite={canWrite}
          form={itemForm}
          setForm={setItemForm}
          onChanged={refresh}
        />
      )}

      <RoomFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        measurementId={measurementId}
        room={editingRoom}
        onSaved={(saved, addItems) => {
          refresh();
          if (addItems && saved?.id) {
            setItemForm({ itemType: ITEM_TYPES[0], quantity: 1, roomId: saved.id });
          }
        }}
      />
      {detailRoom && (
        <RoomDetailDialog
          measurementId={measurementId}
          room={detailRoom}
          canWrite={canWrite}
          autoAddItem={startAddItem}
          onClose={() => { setDetailRoom(null); setStartAddItem(false); }}
          onEdit={() => { setEditingRoom(detailRoom); setDetailRoom(null); setStartAddItem(false); setFormOpen(true); }}
          onChanged={refresh}
        />
      )}
      {mergeSource && (
        <MergeRoomDialog
          measurementId={measurementId}
          source={mergeSource}
          targets={realRooms.filter((r) => r.id !== mergeSource.id)}
          onClose={() => setMergeSource(null)}
          onMerged={refresh}
        />
      )}
    </div>
  );
}

type ItemWithRoom = MeasurementItem & { roomId: number };

/**
 * Flat, always-visible list of every measured element across all rooms. Items used to be reachable
 * only by opening a room dialog, which made the tab look like it could record rooms and nothing else.
 */
function MeasuredItemsPanel({ measurementId, rooms, items, loading, canWrite, form, setForm, onChanged }: {
  measurementId: number; rooms: MeasurementRoom[]; items: ItemWithRoom[];
  loading: boolean; canWrite: boolean;
  form: Partial<ItemWithRoom> | null;
  setForm: React.Dispatch<React.SetStateAction<Partial<ItemWithRoom> | null>>;
  onChanged: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  // Opened from the room dialog the form can be well below the fold — bring it to the user.
  useEffect(() => {
    if (form) formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [form]);

  const roomName = (roomId?: number) => rooms.find((r) => r.id === roomId)?.roomName ?? "—";

  const startAdd = () =>
    setForm({ itemType: ITEM_TYPES[0], quantity: 1, roomId: rooms[0]?.id });

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form?.itemType || !form.roomId) return;
    setSaving(true);
    const { roomId, ...payload } = form;
    const request = form.id
      ? measurementApi.updateItem(measurementId, roomId, form.id, payload as MeasurementItem)
      : measurementApi.addItem(measurementId, roomId, payload as MeasurementItem);
    request
      .then(() => { setForm(null); onChanged(); })
      .catch((e) => { console.error(e); alert(e?.response?.data?.message || "Could not save the item."); })
      .finally(() => setSaving(false));
  };

  const remove = (item: ItemWithRoom) => {
    if (!item.id || !confirm(`Delete ${item.itemName || item.itemType}?`)) return;
    measurementApi.deleteItem(measurementId, item.roomId, item.id).then(onChanged).catch(console.error);
  };

  const set = (key: keyof ItemWithRoom) => (value: any) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold flex items-center gap-2"><Ruler className="h-4 w-4" /> Measured Items ({items.length})</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Walls, windows, cupboards, screens — every item here becomes a line on the generated BOQ.
            </p>
          </div>
          {canWrite && <Button size="sm" onClick={startAdd}><Plus className="h-4 w-4 mr-1" /> Add Item</Button>}
        </div>

        {loading ? <ListSkeleton rows={2} /> : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No items measured yet. Add the elements inside each room — their dimensions, material and notes carry into the BOQ.
          </p>
        ) : (
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">Room</th>
                  <th className="text-left px-3 py-2">Type</th>
                  <th className="text-left px-3 py-2">Name</th>
                  <th className="text-left px-3 py-2">Material / Finish</th>
                  <th className="text-right px-3 py-2">Dimensions</th>
                  <th className="text-right px-3 py-2">Qty</th>
                  <th className="text-right px-3 py-2">Area</th>
                  {canWrite && <th className="px-3 py-2" />}
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item) => (
                  <tr key={`${item.roomId}-${item.id}`}
                    className={canWrite ? "cursor-pointer hover:bg-muted/30" : undefined}
                    onClick={canWrite ? () => setForm(item) : undefined}>
                    <td className="px-3 py-2 text-muted-foreground">{roomName(item.roomId)}</td>
                    <td className="px-3 py-2">{item.itemType}</td>
                    <td className="px-3 py-2">
                      {item.itemName || "—"}
                      {item.notes && <div className="text-xs text-muted-foreground truncate max-w-48">{item.notes}</div>}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{item.material || "—"}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {[item.length, item.width, item.height].filter((v) => v != null).join(" × ") || "—"}
                    </td>
                    <td className="px-3 py-2 text-right">{item.quantity ?? 1}{item.unit ? ` ${item.unit}` : ""}</td>
                    <td className="px-3 py-2 text-right font-medium">{item.area ? `${item.area} sqft` : "—"}</td>
                    {canWrite && (
                      <td className="px-3 py-2 text-right">
                        <button type="button" onClick={(e) => { e.stopPropagation(); remove(item); }}
                          className="text-destructive hover:opacity-70">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {form && (
          <form ref={formRef} onSubmit={save} className="p-3 border-2 border-primary/40 rounded-lg bg-muted/30 grid grid-cols-2 md:grid-cols-4 gap-3">
            <p className="col-span-full text-sm font-medium">
              {form.id ? "Edit item" : `New item in ${roomName(form.roomId)}`}
            </p>
            <Field label="Room">
              <select className={selectClass} value={form.roomId ?? ""}
                onChange={(e) => set("roomId")(e.target.value ? Number(e.target.value) : undefined)}>
                {rooms.map((r) => <option key={r.id} value={r.id}>{r.roomName}</option>)}
              </select>
            </Field>
            <Field label="Item Type">
              <select className={selectClass} value={form.itemType} onChange={(e) => set("itemType")(e.target.value)}>
                {ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <TextField label="Name" value={form.itemName} onChange={set("itemName")} placeholder="e.g. W1, Wardrobe A" />
            <Field label="Unit">
              <select className={selectClass} value={form.unit ?? ""} onChange={(e) => set("unit")(e.target.value || undefined)}>
                <option value="">Auto</option>
                {MEASUREMENT_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </Field>
            <TextField label="Length" type="number" value={form.length} onChange={(v) => set("length")(v === "" ? undefined : Number(v))} />
            <TextField label="Width" type="number" value={form.width} onChange={(v) => set("width")(v === "" ? undefined : Number(v))} />
            <TextField label="Height" type="number" value={form.height} onChange={(v) => set("height")(v === "" ? undefined : Number(v))} />
            <TextField label="Quantity" type="number" value={form.quantity} onChange={(v) => set("quantity")(v === "" ? undefined : Number(v))} />
            <div className="col-span-2">
              <TextField label="Material / Finish" value={form.material} onChange={set("material")}
                placeholder="e.g. 8mm toughened glass, Teak ply" />
            </div>
            <div className="col-span-2">
              <TextField label="Notes (carried into the BOQ)" value={form.notes} onChange={set("notes")}
                placeholder="Site observation, access constraint, finish detail…" />
            </div>
            <div className="col-span-full flex justify-end gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setForm(null)}>Cancel</Button>
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? "Saving..." : form.id ? "Save Changes" : "Add Item"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function RoomFormDialog({ open, onOpenChange, measurementId, room, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; measurementId: number;
  room: MeasurementRoom | null; onSaved: (saved?: MeasurementRoom, addItems?: boolean) => void;
}) {
  const [form, setForm] = useState<Partial<MeasurementRoom>>(room || { roomName: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(room || { roomName: "" });
  }, [open, room]);

  const set = (key: keyof MeasurementRoom) => (value: any) => setForm((f) => ({ ...f, [key]: value }));

  /** @param chainToItems open item entry for the room straight after creating it. */
  const persist = (chainToItems: boolean) => {
    if (!form.roomName) return;
    setSaving(true);
    const payload = { ...form } as MeasurementRoom;
    const request = room?.id
      ? measurementApi.updateRoom(measurementId, room.id, payload)
      : measurementApi.addRoom(measurementId, payload);
    request
      .then((saved) => { onOpenChange(false); onSaved(saved, chainToItems && !room?.id); })
      .catch((err) => { console.error(err); alert(err?.response?.data?.message || "Could not save the room."); })
      .finally(() => setSaving(false));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    persist(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{room ? `Edit ${room.roomName}` : "Add Room"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Room Name" required value={form.roomName} onChange={set("roomName")} />
            <SelectField label="Room Type" value={form.roomType} onChange={set("roomType")} options={ROOM_TYPES} />
            <SelectField label="Floor" value={form.floorNumber} onChange={set("floorNumber")} options={FLOOR_LEVELS} />
          </div>
          <div className="grid grid-cols-4 gap-4">
            <TextField label="Length (ft)" type="number" value={form.length} onChange={set("length")} />
            <TextField label="Width (ft)" type="number" value={form.width} onChange={set("width")} />
            <TextField label="Height (ft)" type="number" value={form.height} onChange={set("height")} />
            <TextField label="Ceiling Height (ft)" type="number" value={form.ceilingHeight} onChange={set("ceilingHeight")} />
          </div>
          <div className="grid grid-cols-4 gap-4">
            <TextField label="Door Count" type="number" value={form.doorCount} onChange={set("doorCount")} />
            <TextField label="Window Count" type="number" value={form.windowCount} onChange={set("windowCount")} />
            <TextField label="Column Count" type="number" value={form.columnCount} onChange={set("columnCount")} />
            <TextField label="Beam Count" type="number" value={form.beamCount} onChange={set("beamCount")} />
          </div>
          <Field label="Scope of Work">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {SCOPE_FLAGS.map((f) => (
                <CheckboxField key={String(f.key)} label={f.label} checked={form[f.key] as boolean | undefined}
                  onChange={set(f.key) as (v: boolean) => void} />
              ))}
            </div>
          </Field>
          <TextAreaField label="Notes" value={form.notes} onChange={set("notes")} />
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            {!room?.id && (
              <Button type="button" variant="secondary" disabled={saving || !form.roomName} onClick={() => persist(true)}>
                Save &amp; Add Items
              </Button>
            )}
            <Button type="submit" disabled={saving || !form.roomName}>{saving ? "Saving..." : room ? "Save Changes" : "Add Room"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RoomDetailDialog({ measurementId, room, canWrite, autoAddItem, onClose, onEdit, onChanged }: {
  measurementId: number; room: MeasurementRoom; canWrite: boolean; autoAddItem?: boolean;
  onClose: () => void; onEdit: () => void; onChanged: () => void;
}) {
  const { items, loading, reload } = useMeasurementSubResource<MeasurementItem>(
    () => measurementApi.getItems(measurementId, room.id!), [measurementId, room.id]);
  const { items: allMedia } = useMeasurementSubResource<MeasurementMedia>(
    () => measurementApi.getMedia(measurementId), [measurementId]);
  const { items: drawings } = useMeasurementSubResource<MeasurementDrawing>(
    () => measurementApi.getDrawings(measurementId), [measurementId]);
  const [itemForm, setItemForm] = useState<Partial<MeasurementItem> | null>(
    autoAddItem ? { itemType: ITEM_TYPES[0], quantity: 1 } : null);

  const roomPhotos = allMedia.filter((m) => m.measurementRoom?.id === room.id);

  const saveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemForm?.itemType) return;
    const payload = { ...itemForm } as MeasurementItem;
    const request = payload.id
      ? measurementApi.updateItem(measurementId, room.id!, payload.id, payload)
      : measurementApi.addItem(measurementId, room.id!, payload);
    request.then(() => { setItemForm(null); reload(); onChanged(); }).catch(console.error);
  };

  const removeItem = (item: MeasurementItem) => {
    if (!item.id || !confirm(`Delete ${item.itemType}?`)) return;
    measurementApi.deleteItem(measurementId, room.id!, item.id).then(() => { reload(); onChanged(); }).catch(console.error);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between pr-6">
          <DialogTitle>{room.roomName}</DialogTitle>
          {canWrite && <Button variant="outline" size="sm" onClick={onEdit}>Edit Room</Button>}
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Summary</h4>
            <div className="grid grid-cols-3 md:grid-cols-4 gap-4 text-sm">
              <Info label="Dimensions" value={`${room.length ?? "—"}×${room.width ?? "—"}×${room.height ?? "—"} ft`} />
              <Info label="Floor Area" value={room.floorArea ? `${room.floorArea} sqft` : "—"} />
              <Info label="Wall Area" value={room.wallArea ? `${room.wallArea} sqft` : "—"} />
              <Info label="Ceiling Area" value={room.ceilingArea ? `${room.ceilingArea} sqft` : "—"} />
              <Info label="Paintable Area" value={room.paintableArea ? `${room.paintableArea} sqft` : "—"} />
              <Info label="False Ceiling Area" value={room.falseCeilingArea ? `${room.falseCeilingArea} sqft` : "—"} />
              <Info label="Tile Area" value={room.tileArea ? `${room.tileArea} sqft` : "—"} />
              <Info label="Woodwork Area" value={room.woodworkArea ? `${room.woodworkArea} sqft` : "—"} />
            </div>
          </div>

          {room.notes && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Notes</h4>
              <p className="text-sm text-muted-foreground">{room.notes}</p>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Items ({items.length})</h4>
              {canWrite && (
                <Button size="sm" variant="outline" onClick={() => setItemForm({ itemType: ITEM_TYPES[0], quantity: 1 })}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
                </Button>
              )}
            </div>
            {loading ? <ListSkeleton rows={2} /> : items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No items recorded for this room yet. Each item you add here becomes a line on the generated BOQ.
              </p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2">Type</th>
                      <th className="text-left px-3 py-2">Name</th>
                      <th className="text-left px-3 py-2">Material / Finish</th>
                      <th className="text-right px-3 py-2">Dimensions</th>
                      <th className="text-right px-3 py-2">Qty</th>
                      <th className="text-right px-3 py-2">Area</th>
                      {canWrite && <th className="px-3 py-2" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.map((item) => (
                      <tr key={item.id} className={canWrite ? "cursor-pointer hover:bg-muted/30" : undefined}
                        onClick={canWrite ? () => setItemForm(item) : undefined}>
                        <td className="px-3 py-2">{item.itemType}</td>
                        <td className="px-3 py-2">
                          {item.itemName || "—"}
                          {item.notes && <div className="text-xs text-muted-foreground truncate max-w-48">{item.notes}</div>}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{item.material || "—"}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">
                          {[item.length, item.width, item.height].filter((v) => v != null).join(" × ") || "—"}
                        </td>
                        <td className="px-3 py-2 text-right">{item.quantity ?? 1}{item.unit ? ` ${item.unit}` : ""}</td>
                        <td className="px-3 py-2 text-right font-medium">{item.area ? `${item.area} sqft` : "—"}</td>
                        {canWrite && (
                          <td className="px-3 py-2 text-right">
                            <button type="button" onClick={(e) => { e.stopPropagation(); removeItem(item); }} className="text-destructive hover:opacity-70">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {itemForm && (
              <form onSubmit={saveItem} className="mt-3 p-3 border rounded-lg bg-muted/30 grid grid-cols-2 md:grid-cols-3 gap-3">
                <Field label="Item Type">
                  <select className={selectClass} value={itemForm.itemType} onChange={(e) => setItemForm((f) => ({ ...f, itemType: e.target.value }))}>
                    {ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <TextField label="Name" value={itemForm.itemName} onChange={(v) => setItemForm((f) => ({ ...f, itemName: v }))} />
                <Field label="Unit">
                  <select className={selectClass} value={itemForm.unit ?? ""} onChange={(e) => setItemForm((f) => ({ ...f, unit: e.target.value || undefined }))}>
                    <option value="">Auto</option>
                    {MEASUREMENT_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </Field>
                <TextField label="Length" type="number" value={itemForm.length} onChange={(v) => setItemForm((f) => ({ ...f, length: v === "" ? undefined : Number(v) }))} />
                <TextField label="Width" type="number" value={itemForm.width} onChange={(v) => setItemForm((f) => ({ ...f, width: v === "" ? undefined : Number(v) }))} />
                <TextField label="Height" type="number" value={itemForm.height} onChange={(v) => setItemForm((f) => ({ ...f, height: v === "" ? undefined : Number(v) }))} />
                <TextField label="Quantity" type="number" value={itemForm.quantity} onChange={(v) => setItemForm((f) => ({ ...f, quantity: v === "" ? undefined : Number(v) }))} />
                {/* Both carry through to the generated BOQ — material seeds a material line, notes become the item description. */}
                <TextField label="Material / Finish" value={itemForm.material}
                  onChange={(v) => setItemForm((f) => ({ ...f, material: v }))}
                  placeholder="e.g. 8mm toughened glass, Teak ply" />
                <div className="col-span-full">
                  <TextAreaField label="Notes (carried into the BOQ)" rows={2} value={itemForm.notes}
                    onChange={(v) => setItemForm((f) => ({ ...f, notes: v }))}
                    placeholder="Site observation, access constraint, finish detail…" />
                </div>
                <div className="col-span-full flex justify-end gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => setItemForm(null)}>Cancel</Button>
                  <Button type="submit" size="sm">{itemForm.id ? "Save Changes" : "Save Item"}</Button>
                </div>
              </form>
            )}
          </div>

          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ImageIcon className="h-3.5 w-3.5" /> Photos ({roomPhotos.length})
            </h4>
            {roomPhotos.length === 0 ? (
              <p className="text-sm text-muted-foreground">No photos tagged to this room yet — upload from the Media tab.</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {roomPhotos.map((m) => (
                  <a key={m.id} href={m.filePath} target="_blank" rel="noreferrer"
                    title={m.fileName}
                    className="aspect-square rounded-lg border bg-muted flex items-center justify-center text-[10px] text-muted-foreground overflow-hidden p-1 text-center hover:border-primary">
                    <span className="line-clamp-3 break-all">{m.fileName}</span>
                  </a>
                ))}
              </div>
            )}
          </div>

          {drawings.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <DoorOpen className="h-3.5 w-3.5" /> Measurement Drawings
              </h4>
              <div className="flex flex-wrap gap-2">
                {drawings.map((d) => (
                  <a key={d.id} href={d.filePath} target="_blank" rel="noreferrer" title={d.fileName}
                    className="text-xs px-2 py-1 border rounded-full hover:border-primary flex items-center gap-1 max-w-[200px]">
                    <Ruler className="h-3 w-3 shrink-0" /> <span className="truncate">{d.fileName}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <span className="text-muted-foreground block text-xs mb-0.5">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

/**
 * Bottom-up entry: record every measured item into a flat list first (they land in an "Unassigned"
 * draft bucket), then group them into rooms via the per-row Room dropdown and merge rooms as needed.
 * Rooms still hold the dimensions/scope that drive the area-based BOQ lines — captured on the room cards.
 */
function ItemFirstView({
  measurementId, canWrite, realRooms, items, unassignedCount, loading, itemCountFor,
  onChanged, onAddRoom, onEditRoom, onMergeRoom, onDeleteRoom,
}: {
  measurementId: number; canWrite: boolean; realRooms: MeasurementRoom[]; items: ItemWithRoom[];
  unassignedCount: number; loading: boolean; itemCountFor: (roomId?: number) => number;
  onChanged: () => void; onAddRoom: () => void; onEditRoom: (room: MeasurementRoom) => void;
  onMergeRoom: (room: MeasurementRoom) => void; onDeleteRoom: (room: MeasurementRoom) => void;
}) {
  const [form, setForm] = useState<Partial<ItemWithRoom> | null>(null);
  const [saving, setSaving] = useState(false);
  const realRoomIds = new Set(realRooms.map((r) => r.id));
  const roomLabel = (roomId?: number) => realRooms.find((r) => r.id === roomId)?.roomName ?? "Unassigned";

  const set = (key: keyof ItemWithRoom) => (value: any) => setForm((f) => ({ ...f, [key]: value }));

  // Multi-select → bulk-assign into an existing room, or a freshly auto-named "Room N".
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [grouping, setGrouping] = useState(false);
  const selectedItems = items.filter((i) => i.id != null && selectedIds.has(i.id));
  const allSelected = items.length > 0 && items.every((i) => i.id != null && selectedIds.has(i.id));

  const toggleSelect = (id?: number) => {
    if (id == null) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () =>
    setSelectedIds(allSelected ? new Set() : new Set(items.map((i) => i.id!).filter((id) => id != null)));

  /** Next unused "Room N" name, continuing the existing numbering. */
  const nextRoomName = () => {
    const used = realRooms
      .map((r) => /^room\s*0*(\d+)$/i.exec((r.roomName || "").trim()))
      .filter((m): m is RegExpExecArray => m != null)
      .map((m) => Number(m[1]));
    return `Room ${(used.length ? Math.max(...used) : 0) + 1}`;
  };

  // Move sequentially: each moveItem recomputes rooms and may delete the emptied draft bucket,
  // so parallel calls could race on that cleanup.
  const moveSelectedInto = async (targetRoomId: number) => {
    setGrouping(true);
    try {
      for (const it of selectedItems) {
        if (it.roomId !== targetRoomId) await measurementApi.moveItem(measurementId, it.id!, targetRoomId);
      }
      setSelectedIds(new Set());
      onChanged();
    } catch (e: any) {
      alert(e?.response?.data?.message || "Could not assign the selected items.");
    } finally {
      setGrouping(false);
    }
  };

  const groupIntoNewRoom = async () => {
    if (selectedItems.length === 0) return;
    setGrouping(true);
    try {
      const room = await measurementApi.addRoom(measurementId, { roomName: nextRoomName() } as MeasurementRoom);
      for (const it of selectedItems) await measurementApi.moveItem(measurementId, it.id!, room.id!);
      setSelectedIds(new Set());
      onChanged();
    } catch (e: any) {
      alert(e?.response?.data?.message || "Could not create the room.");
    } finally {
      setGrouping(false);
    }
  };

  const changeRoom = (item: ItemWithRoom, value: string) => {
    if (value === NEW_ROOM_OPTION) {
      const name = window.prompt("New room name")?.trim();
      if (!name) return;
      measurementApi.addRoom(measurementId, { roomName: name } as MeasurementRoom)
        .then((room) => measurementApi.moveItem(measurementId, item.id!, room.id!))
        .then(onChanged)
        .catch((e) => alert(e?.response?.data?.message || "Could not create the room."));
      return;
    }
    if (!value) return; // "Unassigned" is display-only — items leave the bucket by picking a real room
    measurementApi.moveItem(measurementId, item.id!, Number(value)).then(onChanged).catch(console.error);
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form?.itemType) return;
    setSaving(true);
    const { roomId, id, ...payload } = form;
    const request = id
      ? measurementApi.updateItem(measurementId, roomId!, id, payload as MeasurementItem)
      : roomId
        ? measurementApi.addItem(measurementId, roomId, payload as MeasurementItem)
        : measurementApi.addDraftItem(measurementId, payload as MeasurementItem);
    request
      .then(() => { setForm(null); onChanged(); })
      .catch((e) => alert(e?.response?.data?.message || "Could not save the item."))
      .finally(() => setSaving(false));
  };

  const remove = (item: ItemWithRoom) => {
    if (!item.id || !confirm(`Delete ${item.itemName || item.itemType}?`)) return;
    measurementApi.deleteItem(measurementId, item.roomId, item.id).then(onChanged).catch(console.error);
  };

  return (
    <div className="space-y-4">
      {unassignedCount > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 flex items-center gap-2">
          <Inbox className="h-4 w-4 shrink-0" />
          {unassignedCount} item{unassignedCount === 1 ? "" : "s"} not yet assigned to a room — pick a room in the table below so they group correctly on the BOQ.
        </div>
      )}

      {/* Rooms strip — dimensions & scope live here (the per-room details step) */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2"><Home className="h-4 w-4" /> Rooms ({realRooms.length})</h3>
            {canWrite && <Button size="sm" variant="outline" onClick={onAddRoom}><Plus className="h-4 w-4 mr-1" /> Add Room</Button>}
          </div>
          {realRooms.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No rooms yet. Add items below, then group them into rooms with the Room dropdown — or add a room here and fill in its dimensions & scope.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {realRooms.map((room) => (
                <div key={room.id} className="border rounded-lg p-3 space-y-2 bg-muted/20">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{room.roomName}</div>
                      <div className="text-xs text-muted-foreground">
                        {[room.roomType, room.floorNumber].filter(Boolean).join(" · ") || "Room"} · {itemCountFor(room.id)} item{itemCountFor(room.id) === 1 ? "" : "s"}
                      </div>
                    </div>
                    <div className="text-xs text-right text-muted-foreground shrink-0">
                      {room.length ?? "—"}×{room.width ?? "—"}×{room.height ?? "—"} ft
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {SCOPE_FLAGS.filter((f) => room[f.key]).map((f) => (
                      <Badge key={String(f.key)} variant="secondary" className="text-[10px]">{f.label}</Badge>
                    ))}
                    {itemCountFor(room.id) === 0 && !SCOPE_FLAGS.some((f) => room[f.key]) && (
                      <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700">No BOQ lines yet</Badge>
                    )}
                  </div>
                  {canWrite && (
                    <div className="flex gap-1.5 pt-1">
                      <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => onEditRoom(room)}>
                        <Pencil className="h-3 w-3 mr-1" /> Edit
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" disabled={realRooms.length < 2}
                        onClick={() => onMergeRoom(room)}>
                        <Combine className="h-3 w-3 mr-1" /> Merge
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => onDeleteRoom(room)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Flat item list — the primary bottom-up surface */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold flex items-center gap-2"><Ruler className="h-4 w-4" /> Measured Items ({items.length})</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Add everything you measure here; set each item's room with the dropdown. Every item becomes a line on the BOQ.</p>
            </div>
            {canWrite && (
              <Button size="sm" onClick={() => setForm({ itemType: ITEM_TYPES[0], quantity: 1 })}>
                <Plus className="h-4 w-4 mr-1" /> Add Item
              </Button>
            )}
          </div>

          {canWrite && selectedItems.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-2">
              <span className="text-sm font-medium">{selectedItems.length} selected</span>
              <Button size="sm" disabled={grouping} onClick={groupIntoNewRoom}>
                <Home className="h-4 w-4 mr-1" /> Group into new room ({nextRoomName()})
              </Button>
              <span className="text-xs text-muted-foreground">or</span>
              <select className={`${selectClass} h-8 w-auto`} value="" disabled={grouping || realRooms.length === 0}
                onChange={(e) => { if (e.target.value) moveSelectedInto(Number(e.target.value)); }}>
                <option value="">Add to existing room…</option>
                {realRooms.map((r) => <option key={r.id} value={r.id}>{r.roomName}</option>)}
              </select>
              <Button size="sm" variant="ghost" disabled={grouping} onClick={() => setSelectedIds(new Set())}>Clear</Button>
            </div>
          )}

          {loading ? <ListSkeleton rows={2} /> : items.length === 0 ? (
            <EmptyState icon={Ruler} title="No items yet"
              description="Start by adding the elements you measured — walls, windows, cupboards, screens. Assign them to rooms afterwards." />
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    {canWrite && (
                      <th className="px-3 py-2 w-8">
                        <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} aria-label="Select all items" />
                      </th>
                    )}
                    <th className="text-left px-3 py-2 w-44">Room</th>
                    <th className="text-left px-3 py-2">Type</th>
                    <th className="text-left px-3 py-2">Name</th>
                    <th className="text-left px-3 py-2">Material / Finish</th>
                    <th className="text-right px-3 py-2">Dimensions</th>
                    <th className="text-right px-3 py-2">Qty</th>
                    <th className="text-right px-3 py-2">Area</th>
                    {canWrite && <th className="px-3 py-2" />}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((item) => (
                    <tr key={`${item.roomId}-${item.id}`}
                      className={`hover:bg-muted/30 ${item.id != null && selectedIds.has(item.id) ? "bg-primary/5" : ""}`}>
                      {canWrite && (
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={item.id != null && selectedIds.has(item.id)}
                            onClick={(e) => e.stopPropagation()} onChange={() => toggleSelect(item.id)} aria-label="Select item" />
                        </td>
                      )}
                      <td className="px-3 py-2">
                        {canWrite ? (
                          <select
                            className={`${selectClass} h-8 ${realRoomIds.has(item.roomId) ? "" : "text-amber-700"}`}
                            value={realRoomIds.has(item.roomId) ? String(item.roomId) : ""}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => changeRoom(item, e.target.value)}>
                            <option value="">Unassigned</option>
                            {realRooms.map((r) => <option key={r.id} value={r.id}>{r.roomName}</option>)}
                            <option value={NEW_ROOM_OPTION}>＋ New room…</option>
                          </select>
                        ) : roomLabel(item.roomId)}
                      </td>
                      <td className="px-3 py-2 cursor-pointer" onClick={canWrite ? () => setForm(item) : undefined}>{item.itemType}</td>
                      <td className="px-3 py-2 cursor-pointer" onClick={canWrite ? () => setForm(item) : undefined}>
                        {item.itemName || "—"}
                        {item.notes && <div className="text-xs text-muted-foreground truncate max-w-48">{item.notes}</div>}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{item.material || "—"}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">
                        {[item.length, item.width, item.height].filter((v) => v != null).join(" × ") || "—"}
                      </td>
                      <td className="px-3 py-2 text-right">{item.quantity ?? 1}{item.unit ? ` ${item.unit}` : ""}</td>
                      <td className="px-3 py-2 text-right font-medium">{item.area ? `${item.area} sqft` : "—"}</td>
                      {canWrite && (
                        <td className="px-3 py-2 text-right">
                          <button type="button" onClick={(e) => { e.stopPropagation(); remove(item); }} className="text-destructive hover:opacity-70">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {form && (
            <form onSubmit={save} className="p-3 border-2 border-primary/40 rounded-lg bg-muted/30 grid grid-cols-2 md:grid-cols-4 gap-3">
              <p className="col-span-full text-sm font-medium">{form.id ? "Edit item" : "New item"}</p>
              {!form.id && (
                <Field label="Room">
                  <select className={selectClass} value={form.roomId ?? ""}
                    onChange={(e) => set("roomId")(e.target.value ? Number(e.target.value) : undefined)}>
                    <option value="">Unassigned (draft)</option>
                    {realRooms.map((r) => <option key={r.id} value={r.id}>{r.roomName}</option>)}
                  </select>
                </Field>
              )}
              <Field label="Item Type">
                <select className={selectClass} value={form.itemType} onChange={(e) => set("itemType")(e.target.value)}>
                  {ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <TextField label="Name" value={form.itemName} onChange={set("itemName")} placeholder="e.g. W1, Wardrobe A" />
              <Field label="Unit">
                <select className={selectClass} value={form.unit ?? ""} onChange={(e) => set("unit")(e.target.value || undefined)}>
                  <option value="">Auto</option>
                  {MEASUREMENT_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </Field>
              <TextField label="Length" type="number" value={form.length} onChange={(v) => set("length")(v === "" ? undefined : Number(v))} />
              <TextField label="Width" type="number" value={form.width} onChange={(v) => set("width")(v === "" ? undefined : Number(v))} />
              <TextField label="Height" type="number" value={form.height} onChange={(v) => set("height")(v === "" ? undefined : Number(v))} />
              <TextField label="Quantity" type="number" value={form.quantity} onChange={(v) => set("quantity")(v === "" ? undefined : Number(v))} />
              <div className="col-span-2">
                <TextField label="Material / Finish" value={form.material} onChange={set("material")} placeholder="e.g. 8mm toughened glass, Teak ply" />
              </div>
              <div className="col-span-2">
                <TextField label="Notes (carried into the BOQ)" value={form.notes} onChange={set("notes")} placeholder="Site observation, access constraint, finish detail…" />
              </div>
              <div className="col-span-full flex justify-end gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setForm(null)}>Cancel</Button>
                <Button type="submit" size="sm" disabled={saving}>{saving ? "Saving..." : form.id ? "Save Changes" : "Add Item"}</Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MergeRoomDialog({ measurementId, source, targets, onClose, onMerged }: {
  measurementId: number; source: MeasurementRoom; targets: MeasurementRoom[];
  onClose: () => void; onMerged: () => void;
}) {
  const [targetId, setTargetId] = useState("");
  const [saving, setSaving] = useState(false);

  const merge = () => {
    if (!targetId) return;
    setSaving(true);
    measurementApi.mergeRooms(measurementId, source.id!, Number(targetId))
      .then(() => { onClose(); onMerged(); })
      .catch((e) => alert(e?.response?.data?.message || "Could not merge the rooms."))
      .finally(() => setSaving(false));
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Merge “{source.roomName}” into…</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            All items in <span className="font-medium text-foreground">{source.roomName}</span> move into the room you choose.
            That room keeps its own dimensions and scope; <span className="font-medium text-foreground">{source.roomName}</span> is then deleted.
          </p>
          <Field label="Merge into">
            <select className={selectClass} value={targetId} onChange={(e) => setTargetId(e.target.value)}>
              <option value="">Select a room…</option>
              {targets.map((r) => <option key={r.id} value={r.id}>{r.roomName}</option>)}
            </select>
          </Field>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant="destructive" disabled={!targetId || saving} onClick={merge}>
              {saving ? "Merging..." : "Merge Rooms"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

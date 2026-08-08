import { useEffect, useMemo, useState, type ReactNode } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { ChevronDown, ChevronRight, Layers, DoorOpen, Package, HardHat, Plus, Trash2, EyeOff, Eye, Ruler, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BOQ_ITEM_STATUS_STYLES, type BoqItem, type BoqReorderEntry } from "@/types/boq";

function formatCurrency(value?: number) {
  if (value === undefined || value === null) return "₹0";
  return `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

/**
 * Items generated from a measurement arrive quantified but un-priced — cost only exists once
 * material/labour lines carry rates. Flagging them turns "where do I start?" into a visible list.
 */
function needsPricing(item: BoqItem) {
  return item.isActive !== false && !Number(item.amount);
}

const UNASSIGNED_FLOOR = "Unassigned Floor";
const UNASSIGNED_ROOM = "Unassigned Room";

interface BoqTreeProps {
  items: BoqItem[];
  mode?: "view" | "select";
  selectedIds?: Set<number>;
  onToggleSelect?: (ids: number[], selected: boolean) => void;
  onAddItem?: (floor: string, room: string) => void;
  onEditItem?: (item: BoqItem) => void;
  onDeleteItem?: (item: BoqItem) => void;
  onAddMaterial?: (item: BoqItem) => void;
  onDeleteMaterial?: (item: BoqItem, materialId: number) => void;
  onAddLabour?: (item: BoqItem) => void;
  onDeleteLabour?: (item: BoqItem, labourId: number) => void;
  onToggleItemActive?: (item: BoqItem) => void;
  /** When provided (editable, view mode), floors/rooms/items become drag-and-drop reorderable. */
  onReorder?: (items: BoqReorderEntry[]) => void;
}

interface RoomNode { room: string; items: BoqItem[] }
interface FloorNode { floor: string; rooms: RoomNode[] }

const cmp = (a: BoqItem, b: BoqItem) =>
  (a.floorOrder ?? 0) - (b.floorOrder ?? 0) ||
  (a.roomOrder ?? 0) - (b.roomOrder ?? 0) ||
  (a.itemOrder ?? 0) - (b.itemOrder ?? 0) ||
  (a.id ?? 0) - (b.id ?? 0);

/** Ordered floor → room → items, preserving insertion order (Map, so numeric-looking names are safe). */
function buildFloorNodes(items: BoqItem[]): FloorNode[] {
  const floorMap = new Map<string, Map<string, BoqItem[]>>();
  for (const item of items) {
    const floor = item.floorName || UNASSIGNED_FLOOR;
    const room = item.roomName || UNASSIGNED_ROOM;
    if (!floorMap.has(floor)) floorMap.set(floor, new Map());
    const rooms = floorMap.get(floor)!;
    if (!rooms.has(room)) rooms.set(room, []);
    rooms.get(room)!.push(item);
  }
  return [...floorMap.entries()].map(([floor, rooms]) => ({
    floor,
    rooms: [...rooms.entries()].map(([room, roomItems]) => ({ room, items: roomItems })),
  }));
}

const splitKey = (key: string) => {
  const i = key.indexOf("::");
  return [key.slice(0, i), key.slice(i + 2)] as const;
};

export default function BoqTree({
  items, mode = "view", selectedIds, onToggleSelect,
  onAddItem, onEditItem, onDeleteItem, onAddMaterial, onDeleteMaterial, onAddLabour, onDeleteLabour,
  onToggleItemActive, onReorder,
}: BoqTreeProps) {
  const isSelectable = mode === "select";
  const dndEnabled = !!onReorder && !isSelectable;

  const sorted = useMemo(() => [...items].sort(cmp), [items]);
  // Local copy so a drop updates instantly; re-synced whenever the server returns fresh items.
  const [localItems, setLocalItems] = useState<BoqItem[]>(sorted);
  useEffect(() => setLocalItems(sorted), [sorted]);

  const floors = useMemo(() => buildFloorNodes(localItems), [localItems]);

  const [openFloors, setOpenFloors] = useState<Set<string>>(() => new Set(buildFloorNodes(sorted).map((f) => f.floor)));
  // In drag mode every floor/room drop target must be mounted, so default rooms open too.
  const [openRooms, setOpenRooms] = useState<Set<string>>(() =>
    dndEnabled ? new Set(buildFloorNodes(sorted).flatMap((f) => f.rooms.map((r) => `${f.floor}::${r.room}`))) : new Set());
  const [openItems, setOpenItems] = useState<Set<number>>(new Set());

  const toggle = (set: Set<string>, setFn: (s: Set<string>) => void, key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key); else next.add(key);
    setFn(next);
  };
  const toggleItem = (id?: number) => {
    if (id === undefined) return;
    const next = new Set(openItems);
    if (next.has(id)) next.delete(id); else next.add(id);
    setOpenItems(next);
  };

  const idsFor = (list: BoqItem[]) => list.map((i) => i.id).filter((v): v is number => v !== undefined);
  const allSelected = (list: BoqItem[]) => list.length > 0 && idsFor(list).every((id) => selectedIds?.has(id));
  const someSelected = (list: BoqItem[]) => idsFor(list).some((id) => selectedIds?.has(id));

  const strip = (s: string) => (s === UNASSIGNED_FLOOR || s === UNASSIGNED_ROOM ? "" : s);

  const persist = (nodes: FloorNode[]) => {
    const flat = nodes.flatMap((f) => f.rooms.flatMap((r) => r.items));
    setLocalItems(flat);
    onReorder?.(flat.map((it) => ({
      itemId: it.id!,
      floorName: strip(it.floorName || UNASSIGNED_FLOOR),
      roomName: strip(it.roomName || UNASSIGNED_ROOM),
    })));
  };

  const onDragEnd = (result: DropResult) => {
    const { source, destination, type } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const nodes = buildFloorNodes(localItems);

    if (type === "FLOOR") {
      const [moved] = nodes.splice(source.index, 1);
      nodes.splice(destination.index, 0, moved);
    } else if (type === "ROOM") {
      const srcFloorName = source.droppableId.slice(3); // "FR::" prefix
      const dstFloorName = destination.droppableId.slice(3);
      const srcFloor = nodes.find((f) => f.floor === srcFloorName);
      const dstFloor = nodes.find((f) => f.floor === dstFloorName);
      if (!srcFloor || !dstFloor) return;
      const [movedRoom] = srcFloor.rooms.splice(source.index, 1);
      movedRoom.items = movedRoom.items.map((it) => ({ ...it, floorName: dstFloorName }));
      dstFloor.rooms.splice(destination.index, 0, movedRoom);
      if (srcFloor.rooms.length === 0) nodes.splice(nodes.indexOf(srcFloor), 1);
    } else { // ITEM
      const [srcFloorName, srcRoomName] = splitKey(source.droppableId.slice(4)); // "RI::" prefix
      const [dstFloorName, dstRoomName] = splitKey(destination.droppableId.slice(4));
      const srcRoom = nodes.find((f) => f.floor === srcFloorName)?.rooms.find((r) => r.room === srcRoomName);
      const dstFloorNode = nodes.find((f) => f.floor === dstFloorName);
      const dstRoom = dstFloorNode?.rooms.find((r) => r.room === dstRoomName);
      if (!srcRoom || !dstRoom) return;
      const [movedItem] = srcRoom.items.splice(source.index, 1);
      dstRoom.items.splice(destination.index, 0, { ...movedItem, floorName: dstFloorName, roomName: dstRoomName });
      // Drop empty rooms / floors so they don't linger as empty buckets.
      if (srcRoom.items.length === 0) {
        const sf = nodes.find((f) => f.floor === srcFloorName)!;
        sf.rooms.splice(sf.rooms.findIndex((r) => r.room === srcRoomName), 1);
        if (sf.rooms.length === 0) nodes.splice(nodes.indexOf(sf), 1);
      }
    }
    persist(nodes);
  };

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground p-4">No items yet.</p>;
  }

  const unpriced = localItems.filter(needsPricing).length;
  const measured = localItems.filter((i) => i.measurementItemId || i.measurementRoomId).length;

  // ---- shared content renderers (identical in DnD and plain modes) --------------------------------
  const grip = (handleProps: any) => (
    <span {...handleProps} className="cursor-grab active:cursor-grabbing text-muted-foreground/60 hover:text-foreground" title="Drag to move / reorder">
      <GripVertical className="h-4 w-4" />
    </span>
  );

  const itemInner = (item: BoqItem, gripNode?: ReactNode) => {
    const itemOpen = item.id !== undefined && openItems.has(item.id);
    const isActive = item.isActive !== false;
    return (
      <>
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => toggleItem(item.id)}>
          {gripNode}
          {itemOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <Package className="h-3.5 w-3.5 text-muted-foreground" />
          {isSelectable && item.id !== undefined && (
            <input type="checkbox" className="h-4 w-4" checked={selectedIds?.has(item.id) ?? false}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => onToggleSelect?.([item.id!], e.target.checked)} />
          )}
          <span className="text-xs text-muted-foreground w-20 shrink-0">{item.itemCode}</span>
          <span className={`text-sm flex-1 ${!isActive ? "line-through" : ""}`}>
            {item.itemName}
            {item.category && <span className="ml-2 text-[10px] text-muted-foreground">{item.category}</span>}
          </span>
          {(item.measurementItemId || item.measurementRoomId) && (
            <span title="Measured on site — dimensions came from the measurement">
              <Ruler className="h-3 w-3 text-primary shrink-0" />
            </span>
          )}
          {needsPricing(item) && (
            <span className="px-1.5 py-0.5 text-[10px] rounded-full font-medium bg-amber-100 text-amber-700 shrink-0">RATE PENDING</span>
          )}
          <span className={`px-1.5 py-0.5 text-[10px] rounded-full font-medium ${BOQ_ITEM_STATUS_STYLES[item.status || "PENDING"]}`}>
            {item.status || "PENDING"}
          </span>
          {!isActive && <span className="px-1.5 py-0.5 text-[10px] rounded-full font-medium bg-slate-200 text-slate-600">DISABLED</span>}
          <span className="text-sm font-medium w-24 text-right">{formatCurrency(item.amount)}</span>
          {!isSelectable && (
            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              {onToggleItemActive && (
                <Button size="sm" variant="ghost" className="h-6 px-1.5" title={isActive ? "Disable item" : "Enable item"} onClick={() => onToggleItemActive(item)}>
                  {isActive ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3 text-emerald-600" />}
                </Button>
              )}
              {onEditItem && <Button size="sm" variant="ghost" className="h-6 px-1.5 text-xs" onClick={() => onEditItem(item)}>Edit</Button>}
              {onDeleteItem && <Button size="sm" variant="ghost" className="h-6 px-1.5" onClick={() => onDeleteItem(item)}><Trash2 className="h-3 w-3 text-destructive" /></Button>}
            </div>
          )}
        </div>
        {itemOpen && (
          <div className="ml-9 mt-1.5 space-y-2 text-xs">
            {(item.length || item.width || item.height || item.area || item.perimeter) && (
              <div className="text-muted-foreground">
                {item.length ? `L: ${item.length} ` : ""}
                {item.width ? `W: ${item.width} ` : ""}
                {item.height ? `H: ${item.height} ` : ""}
                {item.area ? `Area: ${item.area} ` : ""}
                {item.perimeter ? `Perimeter: ${item.perimeter} ` : ""}
                {item.quantity ? `Qty: ${item.quantity} ${item.unit || ""}` : ""}
              </div>
            )}
            {item.description && (
              <div className="rounded border-l-2 border-primary/40 bg-muted/40 px-2 py-1 text-muted-foreground">
                <span className="font-medium text-foreground">Site note: </span>{item.description}
              </div>
            )}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-muted-foreground">Materials ({item.materials?.length || 0}) — {formatCurrency(item.materialTotal)}</span>
                {!isSelectable && onAddMaterial && (
                  <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[11px]" onClick={() => onAddMaterial(item)}>
                    <Plus className="h-3 w-3 mr-1" /> Material
                  </Button>
                )}
              </div>
              {item.materials && item.materials.length > 0 && (
                <table className="w-full">
                  <tbody>
                    {item.materials.map((m) => (
                      <tr key={m.id} className="border-t border-dashed">
                        <td className="py-1">{m.materialName}</td>
                        <td className="py-1 text-muted-foreground">{m.finalQuantity ?? m.quantity} {m.unit}</td>
                        <td className="py-1 text-right">{formatCurrency(m.amount)}</td>
                        <td className="py-1 pl-2">{m.stockWarning && <span className="text-amber-600" title={m.stockWarning}>⚠ low stock</span>}</td>
                        {!isSelectable && onDeleteMaterial && (
                          <td className="py-1 text-right">
                            <button className="text-destructive" onClick={() => m.id && onDeleteMaterial(item, m.id)}><Trash2 className="h-3 w-3" /></button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-muted-foreground flex items-center gap-1">
                  <HardHat className="h-3 w-3" /> Labour ({item.labours?.length || 0}) — {formatCurrency(item.labourTotal)}
                </span>
                {!isSelectable && onAddLabour && (
                  <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[11px]" onClick={() => onAddLabour(item)}>
                    <Plus className="h-3 w-3 mr-1" /> Labour
                  </Button>
                )}
              </div>
              {item.labours && item.labours.length > 0 && (
                <table className="w-full">
                  <tbody>
                    {item.labours.map((l) => (
                      <tr key={l.id} className="border-t border-dashed">
                        <td className="py-1">{l.workType}</td>
                        <td className="py-1 text-muted-foreground">{l.quantity}</td>
                        <td className="py-1 text-right">{formatCurrency(l.amount)}</td>
                        {!isSelectable && onDeleteLabour && (
                          <td className="py-1 text-right">
                            <button className="text-destructive" onClick={() => l.id && onDeleteLabour(item, l.id)}><Trash2 className="h-3 w-3" /></button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </>
    );
  };

  const floorHeaderInner = (floor: string, floorItems: BoqItem[], floorOpen: boolean, gripNode?: ReactNode) => (
    <div className="flex items-center gap-2 bg-muted/40 p-2.5 cursor-pointer" onClick={() => toggle(openFloors, setOpenFloors, floor)}>
      {gripNode}
      {floorOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      <Layers className="h-4 w-4 text-primary" />
      {isSelectable && (
        <input type="checkbox" className="h-4 w-4" checked={allSelected(floorItems)}
          ref={(el) => { if (el) el.indeterminate = !allSelected(floorItems) && someSelected(floorItems); }}
          onClick={(e) => e.stopPropagation()} onChange={(e) => onToggleSelect?.(idsFor(floorItems), e.target.checked)} />
      )}
      <span className="font-semibold text-sm flex-1">{floor}</span>
      <span className="text-xs text-muted-foreground">{floorItems.length} item(s)</span>
    </div>
  );

  const roomHeaderInner = (floor: string, room: string, roomItems: BoqItem[], roomOpen: boolean, roomKey: string, gripNode?: ReactNode) => (
    <div className="flex items-center gap-2 p-2 pl-6 cursor-pointer hover:bg-muted/20" onClick={() => toggle(openRooms, setOpenRooms, roomKey)}>
      {gripNode}
      {roomOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      <DoorOpen className="h-3.5 w-3.5 text-muted-foreground" />
      {isSelectable && (
        <input type="checkbox" className="h-4 w-4" checked={allSelected(roomItems)}
          ref={(el) => { if (el) el.indeterminate = !allSelected(roomItems) && someSelected(roomItems); }}
          onClick={(e) => e.stopPropagation()} onChange={(e) => onToggleSelect?.(idsFor(roomItems), e.target.checked)} />
      )}
      <span className="text-sm font-medium flex-1">{room}</span>
      <span className="text-xs text-muted-foreground">{roomItems.length} item(s)</span>
      {!isSelectable && onAddItem && (
        <Button size="sm" variant="ghost" className="h-6 px-2" onClick={(e) => { e.stopPropagation(); onAddItem(floor, room); }}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );

  // Item list inside a room — either a Droppable of Draggables, or plain rows.
  const renderItems = (floor: string, room: string, roomItems: BoqItem[]) => {
    if (!dndEnabled) {
      return (
        <div className="pl-10 pb-1">
          {roomItems.map((item) => (
            <div key={item.id} className={`border-t first:border-t-0 py-1.5 ${item.isActive === false ? "opacity-50" : ""}`}>
              {itemInner(item)}
            </div>
          ))}
        </div>
      );
    }
    return (
      <Droppable droppableId={`RI::${floor}::${room}`} type="ITEM">
        {(prov, snap) => (
          <div ref={prov.innerRef} {...prov.droppableProps} className={`pl-10 pb-1 ${snap.isDraggingOver ? "bg-primary/5" : ""}`}>
            {roomItems.map((item, i) => (
              <Draggable key={item.id ?? i} draggableId={`I::${item.id ?? i}`} index={i}>
                {(p) => (
                  <div ref={p.innerRef} {...p.draggableProps}
                    className={`border-t first:border-t-0 py-1.5 bg-background ${item.isActive === false ? "opacity-50" : ""}`}>
                    {itemInner(item, grip(p.dragHandleProps))}
                  </div>
                )}
              </Draggable>
            ))}
            {prov.placeholder}
          </div>
        )}
      </Droppable>
    );
  };

  // Rooms inside a floor.
  const renderRooms = (floor: string, rooms: RoomNode[]) => {
    const body = rooms.map((rn, roomIndex) => {
      const roomKey = `${floor}::${rn.room}`;
      const roomOpen = openRooms.has(roomKey);
      if (!dndEnabled) {
        return (
          <div key={roomKey}>
            {roomHeaderInner(floor, rn.room, rn.items, roomOpen, roomKey)}
            {roomOpen && renderItems(floor, rn.room, rn.items)}
          </div>
        );
      }
      return (
        <Draggable key={roomKey} draggableId={`R::${roomKey}`} index={roomIndex}>
          {(p) => (
            <div ref={p.innerRef} {...p.draggableProps} className="bg-background">
              {roomHeaderInner(floor, rn.room, rn.items, roomOpen, roomKey, grip(p.dragHandleProps))}
              {roomOpen && renderItems(floor, rn.room, rn.items)}
            </div>
          )}
        </Draggable>
      );
    });

    if (!dndEnabled) return <div className="divide-y">{body}</div>;
    return (
      <Droppable droppableId={`FR::${floor}`} type="ROOM">
        {(prov, snap) => (
          <div ref={prov.innerRef} {...prov.droppableProps} className={`divide-y ${snap.isDraggingOver ? "bg-primary/5" : ""}`}>
            {body}
            {prov.placeholder}
          </div>
        )}
      </Droppable>
    );
  };

  const banner = (unpriced > 0 || measured > 0) && (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border bg-muted/30 px-3 py-2 text-xs">
      {measured > 0 && (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Ruler className="h-3.5 w-3.5 text-primary" />
          {measured} of {localItems.length} item(s) came from the measurement — dimensions already filled in
        </span>
      )}
      {unpriced > 0 && <span className="font-medium text-amber-700">{unpriced} item(s) still need rates</span>}
      {dndEnabled && <span className="text-muted-foreground">· drag the <GripVertical className="inline h-3 w-3" /> handles to move or reorder floors, rooms and items</span>}
    </div>
  );

  const floorBlocks = floors.map((fn, floorIndex) => {
    const floorItems = fn.rooms.flatMap((r) => r.items);
    const floorOpen = openFloors.has(fn.floor);
    if (!dndEnabled) {
      return (
        <div key={fn.floor} className="border rounded-lg overflow-hidden">
          {floorHeaderInner(fn.floor, floorItems, floorOpen)}
          {floorOpen && renderRooms(fn.floor, fn.rooms)}
        </div>
      );
    }
    return (
      <Draggable key={fn.floor} draggableId={`F::${fn.floor}`} index={floorIndex}>
        {(p) => (
          <div ref={p.innerRef} {...p.draggableProps} className="border rounded-lg overflow-hidden bg-background">
            {floorHeaderInner(fn.floor, floorItems, floorOpen, grip(p.dragHandleProps))}
            {floorOpen && renderRooms(fn.floor, fn.rooms)}
          </div>
        )}
      </Draggable>
    );
  });

  if (!dndEnabled) {
    return <div className="space-y-2">{banner}{floorBlocks}</div>;
  }

  return (
    <DragDropContext onDragStart={() => setOpenItems(new Set())} onDragEnd={onDragEnd}>
      <div className="space-y-2">
        {banner}
        <Droppable droppableId="BOARD" type="FLOOR">
          {(prov) => (
            <div ref={prov.innerRef} {...prov.droppableProps} className="space-y-2">
              {floorBlocks}
              {prov.placeholder}
            </div>
          )}
        </Droppable>
      </div>
    </DragDropContext>
  );
}

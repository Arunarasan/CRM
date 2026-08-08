import { useEffect, useState } from "react";
import { inventoryApi } from "@/api/inventoryApi";
import type { Warehouse, WarehouseStockSummary } from "@/types/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Warehouse as WarehouseIcon, MapPin, User as UserIcon } from "lucide-react";

export default function Warehouses() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [summaries, setSummaries] = useState<Record<number, WarehouseStockSummary>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<Warehouse>>({});

  const load = () => {
    inventoryApi.getWarehouses().then((list) => {
      setWarehouses(list);
      list.forEach((w) => {
        inventoryApi.getWarehouseStockSummary(w.id).then((s) =>
          setSummaries((prev) => ({ ...prev, [w.id]: s }))
        );
      });
    });
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm({}); setEditingId(null); setDialogOpen(true); };
  const openEdit = (w: Warehouse) => { setForm(w); setEditingId(w.id); setDialogOpen(true); };

  const save = () => {
    const action = editingId ? inventoryApi.updateWarehouse(editingId, form) : inventoryApi.createWarehouse(form);
    action.then(() => { setDialogOpen(false); load(); }).catch(() => alert("Failed to save warehouse"));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" /> Add Warehouse</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {warehouses.map((w) => {
          const s = summaries[w.id];
          return (
            <div key={w.id} className="bg-white border rounded-2xl shadow-sm p-5 cursor-pointer hover:shadow-md transition-shadow" onClick={() => openEdit(w)}>
              <div className="flex items-center gap-2 mb-1">
                <WarehouseIcon className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-slate-800">{w.name}</h3>
              </div>
              {w.location && <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1"><MapPin className="w-3 h-3" /> {w.location}</div>}
              {w.managerName && <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3"><UserIcon className="w-3 h-3" /> {w.managerName}</div>}
              <div className="grid grid-cols-2 gap-2 text-xs mt-3">
                <div className="bg-emerald-50 rounded-lg p-2">
                  <div className="text-emerald-600 font-bold uppercase text-[10px]">Available</div>
                  <div className="font-black text-emerald-700 text-lg">{s?.availableStock ?? "—"}</div>
                </div>
                <div className="bg-amber-50 rounded-lg p-2">
                  <div className="text-amber-600 font-bold uppercase text-[10px]">Reserved</div>
                  <div className="font-black text-amber-700 text-lg">{s?.reservedStock ?? "—"}</div>
                </div>
                <div className="bg-red-50 rounded-lg p-2">
                  <div className="text-red-600 font-bold uppercase text-[10px]">Damaged</div>
                  <div className="font-black text-red-700 text-lg">{s?.damagedStock ?? "—"}</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-2">
                  <div className="text-blue-600 font-bold uppercase text-[10px]">In Transit</div>
                  <div className="font-black text-blue-700 text-lg">{s?.inTransitStock ?? "—"}</div>
                </div>
              </div>
            </div>
          );
        })}
        {warehouses.length === 0 && <div className="text-sm text-muted-foreground col-span-full text-center py-8">No warehouses yet.</div>}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingId ? "Edit Warehouse" : "Add Warehouse"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Location</Label>
              <Input value={form.location || ""} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Manager Name</Label>
              <Input value={form.managerName || ""} onChange={(e) => setForm({ ...form, managerName: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={!form.name}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

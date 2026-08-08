import { useEffect, useState } from "react";
import { inventoryApi } from "@/api/inventoryApi";
import type { DamageEntry, Product, Warehouse } from "@/types/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, AlertTriangle } from "lucide-react";
import ProductSearchSelect from "./components/ProductSearchSelect";

export default function DamageEntries() {
  const [entries, setEntries] = useState<DamageEntry[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [product, setProduct] = useState<Product | null>(null);
  const [warehouseId, setWarehouseId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");

  const load = () => inventoryApi.getDamageEntries().then(setEntries);

  useEffect(() => {
    inventoryApi.getWarehouses().then(setWarehouses);
    load();
  }, []);

  const submit = () => {
    if (!product || !warehouseId) { alert("Material and warehouse are required"); return; }
    inventoryApi.reportDamage({ productId: product.id, warehouseId: Number(warehouseId), quantity, reason, photoUrl: photoUrl || undefined })
      .then(() => {
        setDialogOpen(false); setProduct(null); setWarehouseId(""); setQuantity(1); setReason(""); setPhotoUrl("");
        load();
      }).catch((e) => alert(e?.response?.data?.message || "Failed to report damage"));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 mr-2" /> Report Damage</Button>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden divide-y">
        {entries.map((d) => (
          <div key={d.id} className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-100 text-red-600 flex items-center justify-center"><AlertTriangle className="w-5 h-5" /></div>
              <div>
                <div className="font-bold text-slate-800 text-sm">{d.product?.name} × {d.quantity}</div>
                <div className="text-xs text-muted-foreground">{d.warehouse?.name} · {d.reason || "No reason given"}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={d.status === "WRITTEN_OFF" ? "secondary" : "default"}>{d.status}</Badge>
              {d.status === "REPORTED" && (
                <Button size="sm" variant="outline" onClick={() => inventoryApi.writeOffDamage(d.id).then(load)}>Write Off</Button>
              )}
            </div>
          </div>
        ))}
        {entries.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No damage reported.</div>}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Report Damage</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Material</Label>
              <ProductSearchSelect value={product} onChange={setProduct} />
            </div>
            <div className="space-y-1">
              <Label>Warehouse</Label>
              <select className="w-full border rounded-md h-9 px-2 text-sm bg-white" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                <option value="">Select...</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Quantity</Label>
              <Input type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Reason</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Photo URL (optional)</Label>
              <Input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="Paste an uploaded photo URL" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={submit}>Report Damage</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

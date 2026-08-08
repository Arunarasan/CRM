import { useEffect, useState } from "react";
import { inventoryApi } from "@/api/inventoryApi";
import type { Product, StockTransfer, Warehouse } from "@/types/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import ProductSearchSelect from "./components/ProductSearchSelect";

const STATUS_TONE: Record<string, string> = {
  REQUESTED: "bg-slate-100 text-slate-700",
  APPROVED: "bg-blue-100 text-blue-700",
  IN_TRANSIT: "bg-amber-100 text-amber-700",
  RECEIVED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-red-100 text-red-700",
};

export default function StockTransfers() {
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [sourceId, setSourceId] = useState("");
  const [destId, setDestId] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<{ product: Product; quantity: number }[]>([]);
  const [lineProduct, setLineProduct] = useState<Product | null>(null);
  const [lineQty, setLineQty] = useState(1);

  const load = () => inventoryApi.getTransfers().then(setTransfers);

  useEffect(() => {
    inventoryApi.getWarehouses().then(setWarehouses);
    load();
  }, []);

  const addLine = () => {
    if (!lineProduct) return;
    setLines([...lines, { product: lineProduct, quantity: lineQty }]);
    setLineProduct(null);
    setLineQty(1);
  };

  const create = () => {
    if (!sourceId || !destId || lines.length === 0) { alert("Source, destination and at least one material line are required"); return; }
    inventoryApi.createTransfer({
      sourceWarehouseId: Number(sourceId),
      destinationWarehouseId: Number(destId),
      items: lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
      notes,
    }).then(() => {
      setDialogOpen(false); setSourceId(""); setDestId(""); setNotes(""); setLines([]);
      load();
    }).catch((e) => alert(e?.response?.data?.message || "Failed to create transfer"));
  };

  const act = (action: (id: number) => Promise<unknown>, id: number) => {
    action(id).then(load).catch((e) => alert(e?.response?.data?.message || "Action failed"));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 mr-2" /> New Transfer</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {transfers.map((t) => (
          <div key={t.id} className="bg-white border rounded-2xl shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-slate-500">{t.transferNumber}</span>
              <Badge className={STATUS_TONE[t.status]}>{t.status.replace("_", " ")}</Badge>
            </div>
            <div className="text-sm">
              <span className="font-semibold text-red-600">{t.sourceWarehouse?.name}</span>
              <span className="mx-2 text-slate-400">→</span>
              <span className="font-semibold text-emerald-600">{t.destinationWarehouse?.name}</span>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              {t.items?.map((i, idx) => <div key={idx}>{i.product?.name} × {i.quantity}</div>)}
            </div>
            <div className="flex gap-2 flex-wrap pt-2 border-t">
              {t.status === "REQUESTED" && (
                <>
                  <Button size="sm" onClick={() => act(inventoryApi.approveTransfer, t.id)}>Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => act(inventoryApi.rejectTransfer, t.id)}>Reject</Button>
                </>
              )}
              {t.status === "APPROVED" && (
                <Button size="sm" onClick={() => act(inventoryApi.markTransferInTransit, t.id)}>Mark In-Transit</Button>
              )}
              {t.status === "IN_TRANSIT" && (
                <Button size="sm" onClick={() => act(inventoryApi.receiveTransfer, t.id)}>Receive</Button>
              )}
            </div>
          </div>
        ))}
        {transfers.length === 0 && <div className="text-sm text-muted-foreground col-span-full text-center py-8">No transfers yet.</div>}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Stock Transfer</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Source Warehouse</Label>
                <select className="w-full border rounded-md h-9 px-2 text-sm bg-white" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
                  <option value="">Select...</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Destination Warehouse</Label>
                <select className="w-full border rounded-md h-9 px-2 text-sm bg-white" value={destId} onChange={(e) => setDestId(e.target.value)}>
                  <option value="">Select...</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            </div>

            <div className="border rounded-lg p-3 space-y-2">
              <Label>Materials</Label>
              {lines.map((l, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm bg-muted/30 rounded-md p-2">
                  <span>{l.product.name} × {l.quantity}</span>
                  <button onClick={() => setLines(lines.filter((_, i) => i !== idx))}><Trash2 className="w-4 h-4 text-red-500" /></button>
                </div>
              ))}
              <div className="flex gap-2 items-end">
                <div className="flex-1"><ProductSearchSelect value={lineProduct} onChange={setLineProduct} /></div>
                <Input type="number" className="w-20" value={lineQty} onChange={(e) => setLineQty(Number(e.target.value))} />
                <Button variant="outline" onClick={addLine}>Add</Button>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={create}>Create Transfer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

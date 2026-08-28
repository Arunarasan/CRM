import { useEffect, useState } from "react";
import { inventoryApi } from "@/api/inventoryApi";
import { toast } from "@/components/ui/toast";
import { apiError } from "@/lib/apiError";
import type { MaterialRequest, Product, Warehouse } from "@/types/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import ProductSearchSelect from "./components/ProductSearchSelect";
import SearchableSelect from "@/components/ui/searchable-select";

const STATUS_TONE: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
  ISSUED: "bg-emerald-100 text-emerald-700",
};

export default function MaterialRequests() {
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filter, setFilter] = useState<string>("");

  const [warehouseId, setWarehouseId] = useState("");
  const [remarks, setRemarks] = useState("");
  const [lines, setLines] = useState<{ product: Product; quantity: number }[]>([]);
  const [lineProduct, setLineProduct] = useState<Product | null>(null);
  const [lineQty, setLineQty] = useState(1);

  const load = (status?: string) => inventoryApi.getMaterialRequests(status || undefined).then(setRequests);

  useEffect(() => {
    inventoryApi.getWarehouses().then(setWarehouses);
    load();
  }, []);

  useEffect(() => { load(filter); }, [filter]);

  const addLine = () => {
    if (!lineProduct) return;
    setLines([...lines, { product: lineProduct, quantity: lineQty }]);
    setLineProduct(null);
    setLineQty(1);
  };

  const create = () => {
    if (lines.length === 0) { toast.error("Add at least one material."); return; }
    inventoryApi.createMaterialRequest({
      warehouseId: warehouseId ? Number(warehouseId) : undefined,
      items: lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
      remarks,
    }).then(() => {
      setDialogOpen(false); setWarehouseId(""); setRemarks(""); setLines([]);
      load(filter); toast.success("Material request created.");
    }).catch((e) => toast.error(apiError(e, "Failed to create request.")));
  };

  const act = (action: (id: number) => Promise<unknown>, id: number) => {
    action(id).then(() => load(filter)).catch((e) => toast.error(apiError(e, "Action failed.")));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          {["", "PENDING", "APPROVED", "ISSUED", "REJECTED"].map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold ${filter === s ? "bg-primary text-primary-foreground" : "bg-white border text-slate-600"}`}>
              {s || "All"}
            </button>
          ))}
        </div>
        <Button onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 mr-2" /> New Request</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {requests.map((r) => (
          <div key={r.id} className="bg-white border rounded-2xl shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-slate-500">{r.requestNumber}</span>
              <Badge className={STATUS_TONE[r.status]}>{r.status}</Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              {r.project?.projectName && <div>Project: {r.project.projectName}</div>}
              {r.task?.taskName && <div>Task: {r.task.taskName}</div>}
              {r.warehouse?.name && <div>Warehouse: {r.warehouse.name}</div>}
            </div>
            <div className="text-xs space-y-1">
              {r.items?.map((i, idx) => <div key={idx}>{i.product?.name} × {i.quantity} {i.issuedQuantity > 0 && `(issued ${i.issuedQuantity})`}</div>)}
            </div>
            <div className="flex gap-2 flex-wrap pt-2 border-t">
              {r.status === "PENDING" && (
                <>
                  <Button size="sm" onClick={() => act(inventoryApi.approveMaterialRequest, r.id)}>Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => act((id) => inventoryApi.rejectMaterialRequest(id), r.id)}>Reject</Button>
                </>
              )}
              {r.status === "APPROVED" && (
                <Button size="sm" onClick={() => act(inventoryApi.issueMaterialRequest, r.id)}>Issue</Button>
              )}
            </div>
          </div>
        ))}
        {requests.length === 0 && <div className="text-sm text-muted-foreground col-span-full text-center py-8">No material requests.</div>}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Material Request</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Warehouse</Label>
              <SearchableSelect value={warehouseId} onChange={setWarehouseId}
                options={warehouses.map((w) => ({ value: String(w.id), label: w.name }))}
                placeholder="Search warehouse…" clearLabel="— none —" />
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
              <Label>Remarks</Label>
              <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={create}>Create Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

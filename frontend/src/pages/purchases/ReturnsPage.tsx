import { useEffect, useState } from "react";
import { format } from "date-fns";
import { purchaseApi } from "@/api/purchaseApi";
import { inventoryApi } from "@/api/inventoryApi";
import type { PurchaseOrder, PurchaseOrderItem, PurchaseReturn, PurchaseReturnItem } from "@/types/purchase";
import type { Warehouse } from "@/types/inventory";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Undo2 } from "lucide-react";

const currency = (n?: number) => `₹${(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const REASONS = [
  { value: "DAMAGED", label: "Damaged Material" },
  { value: "WRONG_MATERIAL", label: "Wrong Material" },
  { value: "EXCESS_QUANTITY", label: "Excess Quantity" },
];

const STATUS_TONE: Record<string, string> = {
  DRAFT: "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-slate-200 text-slate-500",
};

export default function ReturnsPage() {
  const [returns, setReturns] = useState<PurchaseReturn[]>([]);
  const [expandedItems, setExpandedItems] = useState<Record<number, PurchaseReturnItem[]>>({});
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [poItems, setPoItems] = useState<PurchaseOrderItem[]>([]);
  const [form, setForm] = useState<any>({ reasonType: "DAMAGED" });
  const [returnQty, setReturnQty] = useState<Record<number, number>>({});

  const load = () => purchaseApi.getAllReturns().then(setReturns).catch(console.error);
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!isCreateOpen) return;
    purchaseApi.getPurchaseOrders({ size: 100 }).then((res) => setOrders(res.content || [])).catch(console.error);
    inventoryApi.getWarehouses().then(setWarehouses).catch(console.error);
  }, [isCreateOpen]);

  useEffect(() => {
    if (!form.purchaseOrderId) { setPoItems([]); return; }
    purchaseApi.getPurchaseOrderItems(Number(form.purchaseOrderId))
      .then((items) => { setPoItems(items); setReturnQty({}); })
      .catch(console.error);
  }, [form.purchaseOrderId]);

  const toggleItems = (id: number) => {
    if (expandedItems[id]) {
      const next = { ...expandedItems }; delete next[id]; setExpandedItems(next);
    } else {
      purchaseApi.getReturnItems(id).then((items) => setExpandedItems({ ...expandedItems, [id]: items })).catch(console.error);
    }
  };

  const create = () => {
    if (!form.purchaseOrderId) return alert("Select the purchase order");
    if (!form.warehouseId) return alert("Select the warehouse the material leaves from");
    const items = poItems
      .filter((it) => (returnQty[it.id] || 0) > 0)
      .map((it) => ({ product: { id: it.product.id }, quantity: returnQty[it.id], unitPrice: it.unitPrice }));
    if (items.length === 0) return alert("Enter a return quantity for at least one line");
    purchaseApi.createReturn({
      purchaseOrder: { id: Number(form.purchaseOrderId) },
      warehouse: { id: Number(form.warehouseId) },
      reasonType: form.reasonType,
      notes: form.notes,
    }, items)
      .then(() => { setIsCreateOpen(false); setForm({ reasonType: "DAMAGED" }); setReturnQty({}); load(); })
      .catch((e) => alert(e?.response?.data?.message || "Failed to create return"));
  };

  const confirm = (id: number) => {
    purchaseApi.confirmReturn(id)
      .then(() => { alert("Return confirmed — stock deducted from inventory."); load(); })
      .catch((e) => alert(e?.response?.data?.message || "Failed to confirm return"));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Send damaged, wrong or excess material back to the supplier. Confirming a return deducts the stock automatically.</p>
        <Button onClick={() => setIsCreateOpen(true)}><Plus className="w-4 h-4 mr-2" /> New Return</Button>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden divide-y">
        {returns.map((r) => (
          <div key={r.id}>
            <div className="p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0"><Undo2 className="w-5 h-5" /></div>
                <div className="min-w-0">
                  <div className="font-bold text-slate-800 text-sm">{r.returnNumber} <span className="font-normal text-xs text-slate-400">· {r.purchaseOrder?.poNumber}</span></div>
                  <div className="text-xs text-muted-foreground truncate">
                    {r.supplier?.name} · {r.warehouse?.name} · {REASONS.find((x) => x.value === r.reasonType)?.label}
                    {r.createdAt ? ` · ${format(new Date(r.createdAt), "MMM d, yyyy")}` : ""}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-black text-slate-800 text-sm">{currency(r.totalAmount)}</span>
                <Badge className={STATUS_TONE[r.status]}>{r.status}</Badge>
                {r.status === "DRAFT" && <Button size="sm" onClick={() => confirm(r.id)}>Confirm & Deduct Stock</Button>}
                <Button size="sm" variant="ghost" onClick={() => toggleItems(r.id)}>{expandedItems[r.id] ? "Hide" : "Items"}</Button>
              </div>
            </div>
            {expandedItems[r.id] && (
              <div className="px-4 pb-4">
                <div className="border rounded-lg bg-slate-50/60 divide-y">
                  {expandedItems[r.id].map((it, i) => (
                    <div key={i} className="p-2.5 flex justify-between text-sm">
                      <span className="font-semibold text-slate-700">{it.product?.name}</span>
                      <span>{it.quantity} × {currency(it.unitPrice)} = <b>{currency(it.totalPrice)}</b></span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
        {returns.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No purchase returns yet.</div>}
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Purchase Return</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5 sm:col-span-1">
                <Label className="text-xs">Purchase Order *</Label>
                <select className="w-full h-10 rounded-md border border-input px-3 text-sm" value={form.purchaseOrderId || ""}
                  onChange={(e) => setForm({ ...form, purchaseOrderId: e.target.value })}>
                  <option value="">— Select —</option>
                  {orders.map((po) => <option key={po.id} value={po.id}>{po.poNumber} · {po.supplier?.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">From Warehouse *</Label>
                <select className="w-full h-10 rounded-md border border-input px-3 text-sm" value={form.warehouseId || ""}
                  onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}>
                  <option value="">— Select —</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Reason *</Label>
                <select className="w-full h-10 rounded-md border border-input px-3 text-sm" value={form.reasonType}
                  onChange={(e) => setForm({ ...form, reasonType: e.target.value })}>
                  {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            </div>

            {poItems.length > 0 && (
              <div className="border rounded-xl overflow-hidden">
                <div className="p-2.5 bg-slate-50 border-b text-xs font-bold text-slate-600">Received lines on this PO — enter quantities to return</div>
                <div className="divide-y">
                  {poItems.map((it) => {
                    const returnable = it.receivedQuantity - it.returnedQuantity;
                    return (
                      <div key={it.id} className="p-2.5 flex items-center justify-between gap-3 text-sm">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-700 truncate">{it.product?.name}</div>
                          <div className="text-xs text-slate-400">received {it.receivedQuantity} · already returned {it.returnedQuantity}</div>
                        </div>
                        <Input type="number" min={0} max={returnable} className="w-24" placeholder="0"
                          value={returnQty[it.id] ?? ""} disabled={returnable <= 0}
                          onChange={(e) => setReturnQty({ ...returnQty, [it.id]: Math.min(parseInt(e.target.value) || 0, returnable) })} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Input value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <Button className="w-full" onClick={create}>Create Return (Draft)</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingCart, Plus, IndianRupee, Wallet, Truck } from "lucide-react";
import { purchaseApi, ProjectPurchases } from "@/api/purchaseApi";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { apiError } from "@/lib/apiError";
import { PoListTable, poMoney } from "@/components/purchases/po-ui";

export { PoStatusBadge } from "@/components/purchases/po-ui";

function Stat({ label, value, sub, icon: Icon }: { label: string; value: React.ReactNode; sub?: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><Icon className="h-3.5 w-3.5 text-emerald-600" />{label}</div>
      <div className="mt-1 text-xl font-black leading-tight tabular-nums text-slate-900">{value}</div>
      {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}

/**
 * Project → Purchase Orders: every PO raised for this project in the same table as Purchasing → Orders.
 * Clicking an order opens the one purchase-order page (items, shipments, goods received, payments, returns).
 */
export default function ProjectPurchaseOrdersTab({ projectId }: { projectId: number }) {
  const navigate = useNavigate();
  const [data, setData] = useState<ProjectPurchases | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    return purchaseApi.getProjectPurchases(projectId)
      .then(setData)
      .catch((e) => toast.error(apiError(e, "Could not load purchase orders.")))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const s = data?.summary;
  const rows = (data?.orders || []).map((o) => ({
    id: o.id,
    poNumber: o.poNumber,
    date: o.date,
    supplierName: o.supplierName,
    expectedDeliveryDate: o.expectedDeliveryDate,
    status: o.status,
    totalAmount: o.totalAmount,
    paid: o.paid,
    balance: o.balance,
    receivedPct: o.qtyOrdered ? (o.qtyReceived / o.qtyOrdered) * 100 : 0,
    shippingIds: o.shipments.map((sh) => sh.shippingId),
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-800"><ShoppingCart className="h-5 w-5 text-emerald-600" /> Purchase Orders</h2>
        <Button onClick={() => navigate(`/purchases/orders/new?projectId=${projectId}`)}><Plus className="mr-1.5 h-4 w-4" /> New Purchase Order</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Orders" value={s?.orderCount ?? 0} sub="for this project" icon={ShoppingCart} />
        <Stat label="Ordered value" value={poMoney(s?.totalOrdered)} icon={IndianRupee} />
        <Stat label="Paid to suppliers" value={poMoney(s?.totalPaid)} icon={Wallet} />
        <Stat label="Balance due" value={poMoney(s?.balance)} sub={s?.shipmentsInTransit ? `${s.shipmentsInTransit} shipment(s) on the way` : undefined} icon={Truck} />
      </div>

      <PoListTable rows={rows} loading={loading}
        empty={<>No purchase orders yet<div className="text-xs font-normal text-slate-400">Raise one to buy products for this project.</div></>} />
    </div>
  );
}

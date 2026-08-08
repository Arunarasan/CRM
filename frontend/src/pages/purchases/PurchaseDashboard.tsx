import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { purchaseApi } from "@/api/purchaseApi";
import type { PurchaseDashboard as Dashboard } from "@/types/purchase";
import { PO_STATUS_TONE } from "@/types/purchase";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardList, FileText, PackageCheck, Receipt, AlertTriangle, CalendarClock, Boxes,
} from "lucide-react";

const currency = (n?: number) => `₹${(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export default function PurchaseDashboard() {
  const [data, setData] = useState<Dashboard | null>(null);

  useEffect(() => { purchaseApi.getDashboard().then(setData).catch(console.error); }, []);

  if (!data) return <div className="p-8 text-sm text-muted-foreground">Loading purchase dashboard…</div>;

  const tiles = [
    { label: "Pending Requests", value: data.pendingPurchaseRequests, icon: ClipboardList, to: "/purchases/requests", tone: "bg-amber-50 text-amber-600" },
    { label: "Approved Requests", value: data.approvedPurchaseRequests, icon: ClipboardList, to: "/purchases/requests", tone: "bg-blue-50 text-blue-600" },
    { label: "Draft / Awaiting POs", value: data.pendingPurchaseOrders, icon: FileText, to: "/purchases/orders", tone: "bg-slate-100 text-slate-600" },
    { label: "Open POs", value: data.openPurchaseOrders, icon: FileText, to: "/purchases/orders", tone: "bg-indigo-50 text-indigo-600" },
    { label: "Pending GRNs", value: data.pendingGrns, icon: PackageCheck, to: "/purchases/grns", tone: "bg-cyan-50 text-cyan-600" },
    { label: "Unpaid Invoices", value: data.pendingBills, icon: Receipt, to: "/purchases/invoices", tone: "bg-rose-50 text-rose-600" },
    { label: "Outstanding", value: currency(data.outstandingPayments), icon: Receipt, to: "/purchases/payments", tone: "bg-red-50 text-red-600" },
    { label: "Low Stock Materials", value: data.lowStockMaterials, icon: Boxes, to: "/inventory/purchase-requests", tone: "bg-purple-50 text-purple-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {tiles.map((t) => (
          <Link key={t.label} to={t.to} className="bg-white border rounded-2xl p-5 shadow-sm hover:shadow transition-shadow">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${t.tone}`}>
              <t.icon className="w-5 h-5" />
            </div>
            <div className="text-2xl font-black text-slate-900">{t.value}</div>
            <div className="text-xs font-semibold text-slate-500 mt-1">{t.label}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-slate-50 flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-slate-500" />
            <h3 className="font-bold text-slate-800 text-sm">Today's Expected Deliveries</h3>
          </div>
          <div className="divide-y">
            {data.todaysDeliveries.map((po) => (
              <Link key={po.id} to={`/purchases/orders/${po.id}`} className="p-4 flex items-center justify-between hover:bg-slate-50">
                <div>
                  <div className="font-bold text-sm text-slate-800">{po.poNumber}</div>
                  <div className="text-xs text-muted-foreground">{po.supplier?.name}</div>
                </div>
                <Badge className={PO_STATUS_TONE[po.status]}>{po.status}</Badge>
              </Link>
            ))}
            {data.todaysDeliveries.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">No deliveries expected today.</div>
            )}
          </div>
        </div>

        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-slate-50 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <h3 className="font-bold text-slate-800 text-sm">Delayed Deliveries</h3>
          </div>
          <div className="divide-y">
            {data.delayedDeliveries.map((po) => (
              <Link key={po.id} to={`/purchases/orders/${po.id}`} className="p-4 flex items-center justify-between hover:bg-slate-50">
                <div>
                  <div className="font-bold text-sm text-slate-800">{po.poNumber}</div>
                  <div className="text-xs text-muted-foreground">
                    {po.supplier?.name} · expected {po.expectedDeliveryDate}
                  </div>
                </div>
                <Badge className="bg-red-100 text-red-700">{po.status}</Badge>
              </Link>
            ))}
            {data.delayedDeliveries.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">No delayed deliveries. 🎉</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

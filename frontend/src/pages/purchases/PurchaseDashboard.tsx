import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { purchaseApi } from "@/api/purchaseApi";
import type { PurchaseOverview } from "@/types/purchase";
import {
  ShoppingCart, PackageCheck, Wallet, Receipt, Truck, AlertTriangle,
} from "lucide-react";

const currency = (n?: number) => `₹${(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export default function PurchaseDashboard() {
  const [data, setData] = useState<PurchaseOverview | null>(null);

  useEffect(() => { purchaseApi.getPurchaseOverview().then(setData).catch(console.error); }, []);

  if (!data) return <div className="p-8 text-sm text-muted-foreground">Loading purchase overview…</div>;

  const { totals, suppliers, buyNow, incoming } = data;

  const money = [
    { label: "Ordered", value: totals.ordered, icon: ShoppingCart, tone: "bg-slate-100 text-slate-600" },
    { label: "Material landed", value: totals.landed, icon: PackageCheck, tone: "bg-emerald-50 text-emerald-600" },
    { label: "Paid to suppliers", value: totals.paid, icon: Wallet, tone: "bg-sky-50 text-sky-600" },
    { label: "Still to pay", value: totals.toPay, icon: Receipt, tone: "bg-red-50 text-red-600" },
  ];

  return (
    <div className="space-y-6">
      {/* Plain-language summary */}
      <div className="bg-white border rounded-2xl shadow-sm p-5">
        <p className="text-sm text-slate-600 leading-relaxed">
          You've ordered <b className="text-slate-900">{currency(totals.ordered)}</b> of material.{" "}
          <b className="text-emerald-700">{currency(totals.landed)}</b> has landed
          {totals.yetToLand > 0 && <> ( <b className="text-amber-600">{currency(totals.yetToLand)}</b> still coming )</>}.
          You've paid <b className="text-sky-700">{currency(totals.paid)}</b> and{" "}
          <b className="text-red-600">{currency(totals.toPay)}</b> is still to pay.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          {money.map((m) => (
            <div key={m.label} className="border rounded-xl p-4">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${m.tone}`}>
                <m.icon className="w-4 h-4" />
              </div>
              <div className="text-xl font-black text-slate-900">{currency(m.value)}</div>
              <div className="text-xs font-semibold text-slate-500 mt-0.5">{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Buy now — low stock */}
      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-red-50/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <h3 className="font-bold text-slate-800 text-sm">Buy now — stock running low</h3>
            {buyNow.length > 0 && <span className="text-xs font-bold text-red-600">({buyNow.length})</span>}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b">
                <th className="p-3">Material</th>
                <th className="p-3 text-right">In stock</th>
                <th className="p-3 text-right">Reorder at</th>
                <th className="p-3">Warehouse</th>
                <th className="p-3">Suggested supplier</th>
              </tr>
            </thead>
            <tbody>
              {buyNow.map((r) => (
                <tr key={`${r.productId}-${r.warehouseName}`} className="border-b last:border-0">
                  <td className="p-3 font-semibold text-slate-800">{r.productName}</td>
                  <td className="p-3 text-right font-bold text-red-600">{r.currentStock} {r.unit}</td>
                  <td className="p-3 text-right text-slate-500">{r.reorderLevel} {r.unit}</td>
                  <td className="p-3 text-slate-500">{r.warehouseName || "—"}</td>
                  <td className="p-3 text-slate-600">{r.suggestedSupplierName || <span className="text-amber-600">no supplier set</span>}</td>
                </tr>
              ))}
              {buyNow.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-sm text-muted-foreground">Stock levels look good — nothing to reorder. 🎉</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Coming in — ordered, not yet landed */}
      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-slate-50 flex items-center gap-2">
          <Truck className="w-4 h-4 text-slate-500" />
          <h3 className="font-bold text-slate-800 text-sm">Coming in — ordered, not yet landed</h3>
          {incoming.length > 0 && <span className="text-xs font-bold text-slate-500">({incoming.length})</span>}
        </div>
        <div className="divide-y">
          {incoming.map((po) => (
            <Link key={po.poId} to={`/purchases/orders/${po.poId}`} className="p-4 flex items-center justify-between hover:bg-slate-50">
              <div className="min-w-0">
                <div className="font-bold text-sm text-slate-800">{po.poNumber} <span className="font-normal text-slate-400">· {po.supplierName || "—"}</span></div>
                <div className="text-xs text-muted-foreground">
                  {po.expectedDeliveryDate ? `expected ${po.expectedDeliveryDate}` : "no date set"}
                  {po.daysOverdue > 0 && <span className="text-red-600 font-bold"> · {po.daysOverdue}d late</span>}
                </div>
              </div>
              <div className="font-bold text-slate-800 text-sm">{currency(po.totalAmount)}</div>
            </Link>
          ))}
          {incoming.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">Nothing outstanding to receive.</div>
          )}
        </div>
      </div>

      {/* Supplier ledger — who I owe & what I paid */}
      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-slate-500" />
            <h3 className="font-bold text-slate-800 text-sm">Supplier ledger — who I owe &amp; what I paid</h3>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b">
                <th className="p-3">Supplier</th>
                <th className="p-3 text-right">Ordered</th>
                <th className="p-3 text-right">Landed</th>
                <th className="p-3 text-right">Paid</th>
                <th className="p-3 text-right">Still to pay</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.supplierId} className="border-b last:border-0">
                  <td className="p-3 font-semibold text-slate-800">{s.supplierName}</td>
                  <td className="p-3 text-right text-slate-600">{currency(s.ordered)}</td>
                  <td className="p-3 text-right text-emerald-700">{currency(s.landed)}</td>
                  <td className="p-3 text-right text-sky-700">{currency(s.paid)}</td>
                  <td className={`p-3 text-right font-bold ${s.toPay > 0 ? "text-red-600" : "text-slate-400"}`}>{currency(s.toPay)}</td>
                </tr>
              ))}
              {suppliers.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-sm text-muted-foreground">No supplier activity yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

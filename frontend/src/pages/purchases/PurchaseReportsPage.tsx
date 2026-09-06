import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { purchaseApi } from "@/api/purchaseApi";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Star } from "lucide-react";

const currency = (n?: number) => `₹${(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const REPORTS = [
  { key: "summary", label: "Purchase Summary" },
  { key: "suppliers", label: "Supplier Performance" },
  { key: "materials", label: "Material Cost Analysis" },
] as const;

export default function PurchaseReportsPage() {
  const [active, setActive] = useState<(typeof REPORTS)[number]["key"]>("summary");
  const [summary, setSummary] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    setRows([]);
    if (active === "summary") purchaseApi.getPurchaseSummary().then(setSummary).catch(console.error);
    if (active === "suppliers") purchaseApi.getSupplierPerformance().then(setRows).catch(console.error);
    if (active === "materials") purchaseApi.getMaterialCostAnalysis().then(setRows).catch(console.error);
  }, [active]);

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-white border rounded-xl p-1 overflow-x-auto">
        {REPORTS.map((r) => (
          <button key={r.key} onClick={() => setActive(r.key)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap ${active === r.key ? "bg-primary text-primary-foreground" : "text-slate-500 hover:text-slate-800"}`}>
            {r.label}
          </button>
        ))}
      </div>

      {active === "summary" && summary && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border rounded-2xl p-5 shadow-sm">
              <div className="text-2xl font-black text-slate-900">{summary.totalOrders}</div>
              <div className="text-xs font-semibold text-slate-500 mt-1">Purchase Orders</div>
            </div>
            <div className="bg-white border rounded-2xl p-5 shadow-sm">
              <div className="text-2xl font-black text-slate-900">{currency(summary.totalPurchaseValue)}</div>
              <div className="text-xs font-semibold text-slate-500 mt-1">Total Purchase Value</div>
            </div>
          </div>

          {/* Paid vs Pending */}
          <div className="bg-white border rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between text-sm mb-3">
              <span className="font-bold text-slate-700">Paid vs Pending</span>
              <span className="text-slate-400">of {currency(summary.totalPurchaseValue)} ordered</span>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div className="rounded-xl border p-4">
                <div className="text-2xl font-black text-sky-700">{currency(summary.totalPaid)}</div>
                <div className="text-xs font-semibold text-slate-500 mt-1">Paid to suppliers</div>
              </div>
              <div className="rounded-xl border p-4">
                <div className={`text-2xl font-black ${(summary.totalPending ?? 0) > 0 ? "text-red-600" : "text-emerald-600"}`}>{currency(summary.totalPending)}</div>
                <div className="text-xs font-semibold text-slate-500 mt-1">Pending payment</div>
              </div>
            </div>
            {(() => {
              const ordered = summary.totalPurchaseValue || 0;
              const paidPct = ordered > 0 ? Math.min(100, Math.round(((summary.totalPaid || 0) / ordered) * 100)) : 0;
              return (
                <div>
                  <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden flex">
                    <div className="h-full bg-sky-500" style={{ width: `${paidPct}%` }} />
                    <div className="h-full bg-red-400" style={{ width: `${100 - paidPct}%` }} />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                    <span>{paidPct}% paid</span><span>{100 - paidPct}% pending</span>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-slate-50 font-bold text-sm text-slate-700">Orders by Status</div>
            <div className="p-4 flex flex-wrap gap-3">
              {Object.entries(summary.countByStatus || {}).map(([status, count]) => (
                <div key={status} className="border rounded-xl px-4 py-2.5">
                  <div className="text-lg font-black text-slate-900">{count as number}</div>
                  <div className="text-[11px] font-bold text-slate-500">{status}</div>
                  <div className="text-[11px] text-slate-400">{currency((summary.valueByStatus || {})[status])}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {active === "suppliers" && (
        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden overflow-x-auto">
          <Table>
            <TableHeader><TableRow className="bg-slate-50">
              <TableHead>Supplier</TableHead><TableHead>Rating</TableHead><TableHead className="text-right">Orders</TableHead>
              <TableHead className="text-right">Ordered</TableHead><TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Pending</TableHead><TableHead className="text-right">On-time</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map((r: any) => (
                <TableRow key={r.supplierId}>
                  <TableCell className="font-bold text-slate-800">
                    <Link to={`/purchases/suppliers/${r.supplierId}`} className="hover:text-primary hover:underline">{r.supplierName}</Link>
                  </TableCell>
                  <TableCell><span className="inline-flex items-center gap-1 text-amber-500 font-bold">{r.rating ?? "—"} <Star className="w-3 h-3 fill-amber-400 text-amber-400" /></span></TableCell>
                  <TableCell className="text-right">{r.totalOrders}</TableCell>
                  <TableCell className="text-right font-bold">{currency(r.totalValue)}</TableCell>
                  <TableCell className="text-right text-sky-700">{currency(r.paid)}</TableCell>
                  <TableCell className={`text-right font-bold ${r.pending > 0 ? "text-red-600" : "text-slate-400"}`}>{currency(r.pending)}</TableCell>
                  <TableCell className="text-right">
                    {r.onTimeDeliveryPercent != null ? (
                      <span>{r.onTimeDeliveryPercent}%{r.lateOrders > 0 && <span className="text-red-500 text-xs"> · {r.lateOrders} late</span>}</span>
                    ) : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-500">No supplier activity yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      )}

      {active === "materials" && (
        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden overflow-x-auto">
          <Table>
            <TableHeader><TableRow className="bg-slate-50">
              <TableHead>Material</TableHead><TableHead className="text-right">Qty Bought</TableHead>
              <TableHead className="text-right">Total Spend</TableHead><TableHead className="text-right">Avg Price</TableHead>
              <TableHead className="text-right">Min</TableHead><TableHead className="text-right">Max</TableHead>
              <TableHead className="text-right">Last</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map((r: any) => (
                <TableRow key={r.productId}>
                  <TableCell className="font-bold text-slate-800">{r.productName} <span className="text-xs font-normal text-slate-400">{r.materialCode}</span></TableCell>
                  <TableCell className="text-right">{r.totalQuantity} {r.unit}</TableCell>
                  <TableCell className="text-right font-bold">{currency(r.totalValue)}</TableCell>
                  <TableCell className="text-right">{currency(r.averagePrice)}</TableCell>
                  <TableCell className="text-right text-emerald-600">{currency(r.minPrice)}</TableCell>
                  <TableCell className="text-right text-red-600">{currency(r.maxPrice)}</TableCell>
                  <TableCell className="text-right">{currency(r.lastPrice)}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-500">No purchase history yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

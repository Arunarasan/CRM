import { useEffect, useState } from "react";
import { purchaseApi } from "@/api/purchaseApi";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Star } from "lucide-react";

const currency = (n?: number) => `₹${(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const REPORTS = [
  { key: "summary", label: "Purchase Summary" },
  { key: "suppliers", label: "Supplier Performance" },
  { key: "deliveries", label: "Pending Deliveries" },
  { key: "outstanding", label: "Outstanding Payments" },
  { key: "trends", label: "Purchase Trends" },
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
    if (active === "deliveries") purchaseApi.getPendingDeliveries().then(setRows).catch(console.error);
    if (active === "outstanding") purchaseApi.getOutstandingPayments().then(setRows).catch(console.error);
    if (active === "trends") purchaseApi.getPurchaseTrends().then(setRows).catch(console.error);
    if (active === "materials") purchaseApi.getMaterialCostAnalysis().then(setRows).catch(console.error);
  }, [active]);

  const maxTrend = Math.max(1, ...rows.map((r: any) => r.value ?? 0));

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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border rounded-2xl p-5 shadow-sm">
              <div className="text-2xl font-black text-slate-900">{summary.totalOrders}</div>
              <div className="text-xs font-semibold text-slate-500 mt-1">Purchase Orders</div>
            </div>
            <div className="bg-white border rounded-2xl p-5 shadow-sm">
              <div className="text-2xl font-black text-slate-900">{currency(summary.totalPurchaseValue)}</div>
              <div className="text-xs font-semibold text-slate-500 mt-1">Total Purchase Value</div>
            </div>
            <div className="bg-white border rounded-2xl p-5 shadow-sm">
              <div className="text-2xl font-black text-slate-900">{summary.totalRequests}</div>
              <div className="text-xs font-semibold text-slate-500 mt-1">Purchase Requests</div>
            </div>
            <div className="bg-white border rounded-2xl p-5 shadow-sm">
              <div className="text-2xl font-black text-amber-600">{summary.pendingRequests}</div>
              <div className="text-xs font-semibold text-slate-500 mt-1">Pending Requests</div>
            </div>
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
              <TableHead className="text-right">Value</TableHead><TableHead className="text-right">On-time %</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map((r: any) => (
                <TableRow key={r.supplierId}>
                  <TableCell className="font-bold text-slate-800">{r.supplierName}</TableCell>
                  <TableCell><span className="inline-flex items-center gap-1 text-amber-500 font-bold">{r.rating ?? "—"} <Star className="w-3 h-3 fill-amber-400 text-amber-400" /></span></TableCell>
                  <TableCell className="text-right">{r.totalOrders}</TableCell>
                  <TableCell className="text-right font-bold">{currency(r.totalValue)}</TableCell>
                  <TableCell className="text-right">{r.onTimeDeliveryPercent != null ? `${r.onTimeDeliveryPercent}%` : "—"}</TableCell>
                  <TableCell className="text-right text-red-600 font-bold">{currency(r.outstandingBalance)}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-500">No supplier activity yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      )}

      {active === "deliveries" && (
        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden overflow-x-auto">
          <Table>
            <TableHeader><TableRow className="bg-slate-50">
              <TableHead>PO</TableHead><TableHead>Supplier</TableHead><TableHead>Status</TableHead>
              <TableHead>Expected</TableHead><TableHead className="text-right">Days Overdue</TableHead><TableHead className="text-right">Value</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map((r: any) => (
                <TableRow key={r.poId}>
                  <TableCell className="font-bold text-slate-800">{r.poNumber}</TableCell>
                  <TableCell>{r.supplierName}</TableCell>
                  <TableCell><Badge className="bg-indigo-100 text-indigo-700">{r.status}</Badge></TableCell>
                  <TableCell className="text-slate-500">{r.expectedDeliveryDate || "—"}</TableCell>
                  <TableCell className={`text-right font-bold ${r.daysOverdue > 0 ? "text-red-600" : "text-slate-400"}`}>{r.daysOverdue}</TableCell>
                  <TableCell className="text-right font-bold">{currency(r.totalAmount)}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-500">No pending deliveries.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      )}

      {active === "outstanding" && (
        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden overflow-x-auto">
          <Table>
            <TableHeader><TableRow className="bg-slate-50">
              <TableHead>Invoice</TableHead><TableHead>Supplier</TableHead><TableHead>PO</TableHead>
              <TableHead>Due</TableHead><TableHead className="text-right">Billed</TableHead>
              <TableHead className="text-right">Paid</TableHead><TableHead className="text-right">Balance</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map((r: any) => (
                <TableRow key={r.billId}>
                  <TableCell className="font-bold text-slate-800">{r.billNumber}</TableCell>
                  <TableCell>{r.supplierName}</TableCell>
                  <TableCell className="text-slate-500">{r.poNumber || "—"}</TableCell>
                  <TableCell className={r.overdue ? "text-red-600 font-bold" : "text-slate-500"}>{r.dueDate || "—"}</TableCell>
                  <TableCell className="text-right">{currency(r.totalAmount)}</TableCell>
                  <TableCell className="text-right text-emerald-600">{currency(r.paidAmount)}</TableCell>
                  <TableCell className="text-right font-black text-red-600">{currency(r.balance)}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-500">Nothing outstanding.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      )}

      {active === "trends" && (
        <div className="bg-white border rounded-2xl shadow-sm p-6">
          <div className="font-bold text-sm text-slate-700 mb-4">Monthly Purchase Value (last 12 months)</div>
          <div className="flex items-end gap-2 h-48 overflow-x-auto">
            {rows.map((r: any) => (
              <div key={r.month} className="flex flex-col items-center gap-1 min-w-[52px] flex-1">
                <div className="text-[10px] font-bold text-slate-600">{r.value > 0 ? currency(r.value) : ""}</div>
                <div className="w-full bg-primary/80 rounded-t-md" style={{ height: `${Math.max((r.value / maxTrend) * 100, 2)}%` }} />
                <div className="text-[10px] text-slate-400 whitespace-nowrap">{r.month}</div>
              </div>
            ))}
          </div>
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

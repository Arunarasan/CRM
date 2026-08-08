import { useCallback, useEffect, useState } from "react";
import { financeApi } from "@/api/financeApi";
import type { MonthBucket } from "@/types/finance";
import { Button } from "@/components/ui/button";
import { currency, currencyFull, stageLabel } from "./helpers";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from "recharts";

type ReportKey = "revenue" | "expenses" | "pnl" | "gst" | "cashflow" | "pvs";

const REPORTS: { key: ReportKey; label: string }[] = [
  { key: "revenue", label: "Revenue" },
  { key: "expenses", label: "Expenses" },
  { key: "pnl", label: "Profit & Loss" },
  { key: "gst", label: "GST" },
  { key: "cashflow", label: "Cash Flow" },
  { key: "pvs", label: "Purchase vs Sales" },
];

const firstOfYear = () => `${new Date().getFullYear()}-01-01`;
const today = () => new Date().toISOString().slice(0, 10);

export default function FinanceReportsPage() {
  const [report, setReport] = useState<ReportKey>("revenue");
  const [from, setFrom] = useState(firstOfYear());
  const [to, setTo] = useState(today());
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const fetchers: Record<ReportKey, () => Promise<unknown>> = {
        revenue: () => financeApi.getRevenueReport(from, to),
        expenses: () => financeApi.getExpenseReport(from, to),
        pnl: () => financeApi.getProfitLoss(from, to),
        gst: () => financeApi.getGstReport(from, to),
        cashflow: () => financeApi.getCashFlow(from, to),
        pvs: () => financeApi.getPurchaseVsSales(from, to),
      };
      setData(await fetchers[report]() as Record<string, unknown>);
    } catch (e) { console.error(e); setData(null); }
    finally { setLoading(false); }
  }, [report, from, to]);

  useEffect(() => { load(); }, [load]);

  const months = (data?.months ?? []) as MonthBucket[];

  const chart = (bars: { key: string; name: string; color: string }[]) => (
    <div className="h-72 bg-white border rounded-2xl shadow-sm p-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={months}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" fontSize={12} />
          <YAxis fontSize={12} tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} />
          <Tooltip formatter={(v) => currency(Number(v))} />
          <Legend />
          {bars.map((b) => <Bar key={b.key} dataKey={b.key} name={b.name} fill={b.color} radius={[4, 4, 0, 0]} />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border bg-white p-0.5 overflow-x-auto">
          {REPORTS.map((r) => (
            <button key={r.key} onClick={() => setReport(r.key)}
                    className={`px-3 py-1.5 text-sm font-semibold rounded-md whitespace-nowrap ${report === r.key ? "bg-primary text-primary-foreground" : "text-slate-500 hover:text-slate-800"}`}>
              {r.label}
            </button>
          ))}
        </div>
        <input type="date" className="border rounded-lg px-3 py-2 text-sm bg-white" value={from} onChange={(e) => setFrom(e.target.value)} />
        <span className="text-sm text-muted-foreground">to</span>
        <input type="date" className="border rounded-lg px-3 py-2 text-sm bg-white" value={to} onChange={(e) => setTo(e.target.value)} />
        <Button variant="outline" size="sm" onClick={() => window.print()}>Print</Button>
      </div>

      {loading && <div className="p-8 text-sm text-muted-foreground">Building report…</div>}

      {!loading && data && report === "revenue" && chart([
        { key: "invoiced", name: "Invoiced", color: "#3b82f6" },
        { key: "collected", name: "Collected", color: "#10b981" },
      ])}

      {!loading && data && report === "cashflow" && (
        <>
          {chart([
            { key: "moneyIn", name: "Money In", color: "#10b981" },
            { key: "moneyOut", name: "Money Out", color: "#f43f5e" },
          ])}
          <div className="bg-white border rounded-2xl shadow-sm overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr><th className="px-4 py-3">Month</th><th className="px-4 py-3 text-right">Money In</th><th className="px-4 py-3 text-right">Money Out</th><th className="px-4 py-3 text-right">Net</th></tr>
              </thead>
              <tbody className="divide-y">
                {months.map((m) => (
                  <tr key={m.month}>
                    <td className="px-4 py-2.5 font-semibold">{m.month}</td>
                    <td className="px-4 py-2.5 text-right text-emerald-700">{currency(Number(m.moneyIn))}</td>
                    <td className="px-4 py-2.5 text-right text-rose-600">{currency(Number(m.moneyOut))}</td>
                    <td className={`px-4 py-2.5 text-right font-bold ${Number(m.net) >= 0 ? "text-emerald-700" : "text-red-600"}`}>{currency(Number(m.net))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!loading && data && report === "pvs" && chart([
        { key: "sales", name: "Sales (Invoices)", color: "#3b82f6" },
        { key: "purchases", name: "Purchases (Bills)", color: "#f59e0b" },
      ])}

      {!loading && data && report === "expenses" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border rounded-2xl shadow-sm p-5">
            <h3 className="font-bold text-slate-800 text-sm mb-4">Expenses by Category</h3>
            <div className="space-y-2">
              {Object.entries((data.byCategory ?? {}) as Record<string, number>).map(([cat, amt]) => {
                const total = Number(data.total) || 1;
                return (
                  <div key={cat} className="flex items-center gap-3 text-sm">
                    <span className="w-28 font-semibold text-slate-600">{stageLabel(cat)}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div className="h-full bg-rose-500 rounded-full" style={{ width: `${(amt / total) * 100}%` }} />
                    </div>
                    <span className="w-24 text-right font-bold">{currency(amt)}</span>
                  </div>
                );
              })}
            </div>
            <div className="border-t mt-4 pt-3 flex justify-between font-black text-slate-900">
              <span>Total</span><span>{currency(Number(data.total))}</span>
            </div>
          </div>
        </div>
      )}

      {!loading && data && report === "pnl" && (
        <div className="max-w-lg bg-white border rounded-2xl shadow-sm p-6">
          <h3 className="font-bold text-slate-800 mb-4">Profit &amp; Loss · {String(data.from)} → {String(data.to)}</h3>
          <dl className="space-y-2.5 text-sm">
            <div className="flex justify-between"><dt>Revenue (Invoiced)</dt><dd className="font-bold text-blue-700">{currencyFull(Number(data.revenue))}</dd></div>
            <div className="flex justify-between"><dt>Project Expenses</dt><dd className="font-semibold text-rose-600">- {currencyFull(Number(data.projectExpenses))}</dd></div>
            <div className="flex justify-between"><dt>Payroll</dt><dd className="font-semibold text-rose-600">- {currencyFull(Number(data.payroll))}</dd></div>
            <div className="flex justify-between border-t pt-3 text-base">
              <dt className="font-black">Net Profit</dt>
              <dd className={`font-black ${Number(data.netProfit) >= 0 ? "text-emerald-700" : "text-red-600"}`}>{currencyFull(Number(data.netProfit))}</dd>
            </div>
          </dl>
        </div>
      )}

      {!loading && data && report === "gst" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              ["Taxable Value", currency(Number(data.taxableValue))],
              ["CGST", currency(Number(data.cgst))],
              ["SGST", currency(Number(data.sgst))],
              ["IGST", currency(Number(data.igst))],
              ["Total Tax", currency(Number(data.totalTax))],
            ].map(([label, value]) => (
              <div key={label} className="bg-white border rounded-2xl p-4 shadow-sm">
                <div className="text-lg font-black text-slate-900">{value}</div>
                <div className="text-xs font-semibold text-slate-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
          <div className="bg-white border rounded-2xl shadow-sm overflow-x-auto">
            <div className="p-4 border-b bg-slate-50"><h3 className="font-bold text-slate-800 text-sm">HSN-wise Summary</h3></div>
            <table className="w-full text-sm min-w-[480px]">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr><th className="px-4 py-3">HSN</th><th className="px-4 py-3 text-right">GST Rate</th><th className="px-4 py-3 text-right">Taxable Value</th><th className="px-4 py-3 text-right">Tax</th></tr>
              </thead>
              <tbody className="divide-y">
                {((data.hsnSummary ?? []) as { hsnCode: string; gstRate: number; taxableValue: number; taxAmount: number }[]).map((h, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-2.5 font-semibold">{h.hsnCode}</td>
                    <td className="px-4 py-2.5 text-right">{h.gstRate}%</td>
                    <td className="px-4 py-2.5 text-right">{currencyFull(h.taxableValue)}</td>
                    <td className="px-4 py-2.5 text-right">{currencyFull(h.taxAmount)}</td>
                  </tr>
                ))}
                {(!data.hsnSummary || (data.hsnSummary as unknown[]).length === 0) && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No invoice lines in this period.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

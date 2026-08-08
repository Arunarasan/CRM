import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { financeApi } from "@/api/financeApi";
import type { CustomerLedger, CustomerOutstanding } from "@/types/finance";
import { Button } from "@/components/ui/button";
import { currency, currencyFull } from "./helpers";

const TYPE_TONE: Record<string, string> = {
  INVOICE: "text-blue-700",
  PAYMENT: "text-emerald-700",
  CREDIT_NOTE: "text-cyan-700",
  DEBIT_NOTE: "text-orange-700",
  REFUND: "text-rose-700",
  REVERSAL: "text-slate-500",
};

export default function LedgerPage() {
  const [params, setParams] = useSearchParams();
  const customerId = params.get("customerId") ?? "";

  const [customers, setCustomers] = useState<{ id: number; name: string }[]>([]);
  const [ledger, setLedger] = useState<CustomerLedger | null>(null);
  const [outstanding, setOutstanding] = useState<CustomerOutstanding | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    api.get("/customers").then((res) => setCustomers(res.data?.content ?? res.data ?? [])).catch(console.error);
  }, []);

  const load = useCallback(() => {
    if (!customerId) { setLedger(null); setOutstanding(null); return; }
    financeApi.getCustomerLedger(Number(customerId), from || undefined, to || undefined)
      .then(setLedger).catch(console.error);
    financeApi.getCustomerOutstanding(Number(customerId)).then(setOutstanding).catch(console.error);
  }, [customerId, from, to]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="font-semibold text-slate-700 block mb-1">Customer</span>
          <select className="border rounded-lg px-3 py-2 bg-white min-w-[220px]" value={customerId}
                  onChange={(e) => setParams(e.target.value ? { customerId: e.target.value } : {})}>
            <option value="">Select customer…</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="font-semibold text-slate-700 block mb-1">From</span>
          <input type="date" className="border rounded-lg px-3 py-2 bg-white" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="font-semibold text-slate-700 block mb-1">To</span>
          <input type="date" className="border rounded-lg px-3 py-2 bg-white" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        {ledger && (
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => window.print()}>Print Statement</Button>
        )}
      </div>

      {outstanding && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            ["Outstanding", currency(outstanding.totalOutstanding), "text-amber-700"],
            ["Overdue", currency(outstanding.overdueAmount), "text-red-600"],
            ["Upcoming Due", currency(outstanding.upcomingDue), "text-blue-700"],
            ["Last Payment", outstanding.lastPaymentDate ?? "Never", "text-slate-800"],
            ["Credit Limit", outstanding.creditLimit != null ? currency(Number(outstanding.creditLimit)) : "—", "text-slate-800"],
          ].map(([label, value, tone]) => (
            <div key={label as string} className="bg-white border rounded-2xl p-4 shadow-sm">
              <div className={`text-lg font-black ${tone}`}>{value}</div>
              <div className="text-xs font-semibold text-slate-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}

      {ledger ? (
        <div className="bg-white border rounded-2xl shadow-sm overflow-x-auto">
          <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
            <h3 className="font-bold text-slate-800 text-sm">Ledger — {ledger.customerName}</h3>
            <span className="text-sm">Opening: <b>{currencyFull(ledger.openingBalance)}</b></span>
          </div>
          <table className="w-full text-sm min-w-[680px]">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-right">Debit</th>
                <th className="px-4 py-3 text-right">Credit</th>
                <th className="px-4 py-3 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {ledger.entries.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5">{e.date}</td>
                  <td className={`px-4 py-2.5 font-semibold ${TYPE_TONE[e.type] ?? ""}`}>{e.type.replaceAll("_", " ")}</td>
                  <td className="px-4 py-2.5">{e.referenceNumber ?? "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{e.description}</td>
                  <td className="px-4 py-2.5 text-right">{e.debit > 0 ? currencyFull(e.debit) : ""}</td>
                  <td className="px-4 py-2.5 text-right">{e.credit > 0 ? currencyFull(e.credit) : ""}</td>
                  <td className="px-4 py-2.5 text-right font-semibold">{currencyFull(e.balance)}</td>
                </tr>
              ))}
              {ledger.entries.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No ledger activity in this period.</td></tr>
              )}
            </tbody>
            <tfoot className="bg-slate-50 font-bold">
              <tr>
                <td colSpan={4} className="px-4 py-3">Closing Balance</td>
                <td className="px-4 py-3 text-right">{currencyFull(ledger.totalDebit)}</td>
                <td className="px-4 py-3 text-right">{currencyFull(ledger.totalCredit)}</td>
                <td className="px-4 py-3 text-right text-slate-900">{currencyFull(ledger.closingBalance)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="bg-white border rounded-2xl p-10 text-center text-sm text-muted-foreground">
          Pick a customer to see their complete ledger — opening balance, invoices, payments, notes, refunds and running balance.
        </div>
      )}
    </div>
  );
}

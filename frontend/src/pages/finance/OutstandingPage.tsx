import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { financeApi } from "@/api/financeApi";
import type { CustomerOutstanding } from "@/types/finance";
import { currency } from "./helpers";
import { Search } from "lucide-react";

export default function OutstandingPage() {
  const [rows, setRows] = useState<CustomerOutstanding[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    financeApi.getAllOutstanding().then((r) => { setRows(r); setLoaded(true); }).catch(console.error);
  }, []);

  const filtered = rows.filter((r) => r.customerName?.toLowerCase().includes(search.toLowerCase()));
  const totals = filtered.reduce(
    (acc, r) => ({ out: acc.out + r.totalOutstanding, over: acc.over + r.overdueAmount }),
    { out: 0, over: 0 },
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center bg-white border rounded-lg px-3 py-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 mr-2" />
          <input className="outline-none text-sm w-full" placeholder="Search customer…" value={search}
                 onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm">
          Total outstanding: <span className="font-black text-amber-700">{currency(totals.out)}</span>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm">
          Overdue: <span className="font-black text-red-700">{currency(totals.over)}</span>
        </div>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3 text-right">Open Invoices</th>
              <th className="px-4 py-3 text-right">Outstanding</th>
              <th className="px-4 py-3 text-right">Overdue</th>
              <th className="px-4 py-3">Last Payment</th>
              <th className="px-4 py-3 text-right">Credit Limit</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((r) => {
              const overLimit = r.creditLimit != null && r.totalOutstanding > Number(r.creditLimit);
              return (
                <tr key={r.customerId} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-bold text-slate-800">{r.customerName}</div>
                    {r.phone && <div className="text-xs text-muted-foreground">{r.phone}</div>}
                  </td>
                  <td className="px-4 py-3 text-right">{r.openInvoices}</td>
                  <td className="px-4 py-3 text-right font-bold text-amber-700">{currency(r.totalOutstanding)}</td>
                  <td className="px-4 py-3 text-right font-bold text-red-600">{currency(r.overdueAmount)}</td>
                  <td className="px-4 py-3">{r.lastPaymentDate ?? "Never"}</td>
                  <td className={`px-4 py-3 text-right ${overLimit ? "text-red-600 font-bold" : "text-muted-foreground"}`}>
                    {r.creditLimit != null ? currency(Number(r.creditLimit)) : "—"}
                    {overLimit && <div className="text-[10px] uppercase font-black">Over limit</div>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/finance/ledger?customerId=${r.customerId}`} className="text-primary text-xs font-semibold hover:underline">
                      View Ledger
                    </Link>
                  </td>
                </tr>
              );
            })}
            {loaded && filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No outstanding balances. 🎉</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

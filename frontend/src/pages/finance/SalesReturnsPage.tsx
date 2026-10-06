import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { financeApi } from "@/api/financeApi";
import type { SalesReturn, PageResp } from "@/types/finance";
import { Button } from "@/components/ui/button";
import { fmtDay, inr } from "@/components/billing/billing-ui";
import { CheckCircle2, Plus, Undo2 } from "lucide-react";

/** Credit note vs refund, in the same pill style as invoice statuses. */
function Settlement({ mode, method }: { mode?: string | null; method?: string | null }) {
  const refund = mode === "REFUND";
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${refund ? "bg-amber-50 text-amber-700" : "bg-sky-50 text-sky-700"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${refund ? "bg-amber-500" : "bg-sky-500"}`} />
      {refund ? `Refund${method ? ` · ${method.replaceAll("_", " ").toLowerCase()}` : ""}` : "Credit note"}
    </span>
  );
}

export default function SalesReturnsPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<PageResp<SalesReturn> | null>(null);
  const [page, setPage] = useState(0);

  const load = useCallback(() => {
    financeApi.getSalesReturns(page, 15).then(setData).catch(console.error);
  }, [page]);
  useEffect(() => { load(); }, [load]);

  const rows = data?.content ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Undo2 className="w-5 h-5 text-primary" /> Product Returns</h2>
          <p className="text-sm text-muted-foreground">Goods returned by customers — restocked and settled as credit or refund.</p>
        </div>
        <Button onClick={() => navigate("/billing/returns/new")}><Plus className="w-4 h-4 mr-1" /> New Return</Button>
      </div>

      <div className="hidden md:block bg-white border rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Return #</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Against invoice</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3 text-right">Value</th>
              <th className="px-4 py-3 text-center">Settlement</th>
              <th className="px-4 py-3 text-center">Restocked</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/70">
                <td className="px-4 py-3 font-bold text-slate-800">{r.returnNumber}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{fmtDay(r.date)}</td>
                <td className="px-4 py-3">
                  {r.invoice?.id
                    ? <Link to={`/billing/invoices/${r.invoice.id}`} className="font-semibold text-emerald-700 hover:underline">{r.invoice.invoiceNumber}</Link>
                    : <span className="text-slate-400">—</span>}
                </td>
                <td className="px-4 py-3 font-semibold text-slate-700">{r.customer?.name ?? "—"}</td>
                <td className="px-4 py-3 text-right font-bold tabular-nums">{inr(r.totalAmount)}</td>
                <td className="px-4 py-3 text-center"><Settlement mode={r.settlementMode} method={r.refundMethod} /></td>
                <td className="px-4 py-3 text-center">
                  {r.restocked
                    ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Back in stock</span>
                    : <span className="text-xs text-slate-400">Not restocked</span>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center">
                <Undo2 className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2 text-sm font-semibold text-slate-600">No returns recorded yet</p>
                <p className="text-xs text-slate-400">When a customer brings goods back, raise a return against their invoice.</p>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="bg-white border rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800">{r.returnNumber}</span>
              <span className="font-bold tabular-nums">{inr(r.totalAmount)}</span>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">{r.customer?.name} · {r.invoice?.invoiceNumber ?? "—"} · {fmtDay(r.date)}</div>
            <div className="mt-2"><Settlement mode={r.settlementMode} method={r.refundMethod} /></div>
          </div>
        ))}
        {rows.length === 0 && <p className="text-center text-slate-400 py-8">No returns recorded yet.</p>}
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="text-sm text-slate-500">Page {page + 1} of {data.totalPages}</span>
          <Button variant="outline" size="sm" disabled={page + 1 >= data.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { financeApi } from "@/api/financeApi";
import type { SalesReturn, PageResp } from "@/types/finance";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { currency } from "./helpers";
import { Plus, Undo2 } from "lucide-react";

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
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
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
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-semibold text-slate-800">{r.returnNumber}</td>
                <td className="px-4 py-3 text-slate-600">{r.date}</td>
                <td className="px-4 py-3 text-slate-600">{r.invoice?.invoiceNumber ?? "—"}</td>
                <td className="px-4 py-3 text-slate-700">{r.customer?.name ?? "—"}</td>
                <td className="px-4 py-3 text-right font-semibold">{currency(r.totalAmount)}</td>
                <td className="px-4 py-3 text-center">
                  <Badge variant="outline">{r.settlementMode === "REFUND" ? `Refund${r.refundMethod ? ` · ${r.refundMethod}` : ""}` : "Credit note"}</Badge>
                </td>
                <td className="px-4 py-3 text-center">{r.restocked ? "Yes" : "No"}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">No returns recorded yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="bg-white border rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800">{r.returnNumber}</span>
              <span className="font-bold">{currency(r.totalAmount)}</span>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">{r.customer?.name} · {r.invoice?.invoiceNumber ?? "—"} · {r.date}</div>
            <div className="mt-2"><Badge variant="outline">{r.settlementMode === "REFUND" ? "Refund" : "Credit note"}</Badge></div>
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

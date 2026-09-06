import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { purchaseApi } from "@/api/purchaseApi";
import type { GoodsReceiptLogPage } from "@/types/purchase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PackageCheck, Smartphone, Monitor } from "lucide-react";

const fmt = (s?: string | null) => (s ? new Date(s).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—");

const qcTone: Record<string, string> = {
  PASS: "bg-emerald-100 text-emerald-700",
  PARTIAL_PASS: "bg-amber-100 text-amber-700",
  REJECT: "bg-red-100 text-red-700",
};

export default function GoodsReceiptLogPage() {
  const [data, setData] = useState<GoodsReceiptLogPage | null>(null);
  const [page, setPage] = useState(0);

  const load = useCallback(() => {
    purchaseApi.getGoodsReceiptLogs({ page, size: 20 }).then(setData).catch(console.error);
  }, [page]);
  useEffect(() => { load(); }, [load]);

  const logs = data?.content ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <PackageCheck className="w-5 h-5 text-primary" /> Goods Receipt Log
        </h2>
        <p className="text-sm text-muted-foreground">
          Every goods receipt approved by staff — who received it, from where, and what was accepted.
        </p>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white border rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">GRN / Order</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Received by</th>
              <th className="px-4 py-3">Items</th>
              <th className="px-4 py-3 text-center">Qty</th>
              <th className="px-4 py-3 text-center">QC</th>
              <th className="px-4 py-3 text-center">Via</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50 align-top">
                <td className="px-4 py-3 whitespace-nowrap text-slate-600">{fmt(l.approvedAt)}</td>
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-800">{l.grnNumber ?? "—"}</div>
                  {l.purchaseOrderId ? (
                    <Link to={`/purchases/orders/${l.purchaseOrderId}`} className="text-xs text-primary hover:underline">
                      {l.poNumber}
                    </Link>
                  ) : <span className="text-xs text-slate-400">{l.poNumber}</span>}
                  <div className="text-xs text-slate-400">{l.warehouseName}</div>
                </td>
                <td className="px-4 py-3 text-slate-700">{l.supplierName ?? "—"}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800">{l.approvedByName ?? "—"}</div>
                  {l.approvedByRole && <div className="text-xs text-slate-400">{l.approvedByRole.replace("ROLE_", "")}</div>}
                </td>
                <td className="px-4 py-3 max-w-[260px] text-slate-600">{l.itemsSummary || "—"}</td>
                <td className="px-4 py-3 text-center font-semibold">{l.totalAcceptedQty ?? 0}</td>
                <td className="px-4 py-3 text-center">
                  {l.qcStatus && <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${qcTone[l.qcStatus] ?? "bg-slate-100 text-slate-600"}`}>{l.qcStatus.replace("_", " ")}</span>}
                </td>
                <td className="px-4 py-3 text-center">
                  <SourceBadge source={l.source} />
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">No goods receipts logged yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {logs.map((l) => (
          <div key={l.id} className="bg-white border rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800">{l.grnNumber ?? "—"}</span>
              <SourceBadge source={l.source} />
            </div>
            <div className="text-xs text-slate-500 mt-0.5">{l.poNumber} · {l.supplierName}</div>
            <div className="text-sm mt-2 text-slate-600">{l.itemsSummary || "—"}</div>
            <div className="flex items-center justify-between mt-2 text-xs">
              <span className="text-slate-500">By <b className="text-slate-700">{l.approvedByName ?? "—"}</b></span>
              <span className="text-slate-400">{fmt(l.approvedAt)}</span>
            </div>
          </div>
        ))}
        {logs.length === 0 && <p className="text-center text-slate-400 py-8">No goods receipts logged yet.</p>}
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

function SourceBadge({ source }: { source?: string | null }) {
  if (source === "PORTAL") return <Badge variant="outline" className="gap-1"><Smartphone className="w-3 h-3" /> Portal</Badge>;
  return <Badge variant="outline" className="gap-1"><Monitor className="w-3 h-3" /> Desktop</Badge>;
}

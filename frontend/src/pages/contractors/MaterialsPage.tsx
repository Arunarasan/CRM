import { useEffect, useState } from "react";
import { contractorApi } from "@/api/contractorApi";
import type { Contractor } from "@/types/contractor";
import { Label } from "@/components/ui/label";

const currency = (n?: number) => `₹${(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const qty = (v: unknown) => (v == null ? "—" : Number(v).toLocaleString("en-IN"));

/**
 * Material consumption across contractors — issued vs returned vs consumed vs waste/damage.
 * Backed by the same report the Reports tab exposes; the point of this view is the
 * unreconciled column, which is what the store chases.
 */
export default function MaterialsPage() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [contractorId, setContractorId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    contractorApi.list({ size: 200 }).then((p) => setContractors(p.content ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    contractorApi.reportMaterialConsumption(contractorId ? Number(contractorId) : undefined)
      .then(setRows).catch(() => setRows([])).finally(() => setLoading(false));
  }, [contractorId]);

  const totals = rows.reduce<{ value: number; recoverable: number; unreconciled: number }>(
    (acc, r) => ({
      value: acc.value + Number(r.totalValue ?? 0),
      recoverable: acc.recoverable + Number(r.recoverableValue ?? 0),
      unreconciled: acc.unreconciled + (Number(r.unreconciled ?? 0) > 0 ? 1 : 0),
    }),
    { value: 0, recoverable: 0, unreconciled: 0 },
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-end gap-3">
        <div className="space-y-1 md:w-80">
          <Label className="text-xs text-slate-500">Contractor</Label>
          <select className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                  value={contractorId} onChange={(e) => setContractorId(e.target.value)}>
            <option value="">All contractors</option>
            {contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex-1" />
        <div className="flex gap-4">
          <Tile label="Issued value" value={currency(totals.value)} />
          <Tile label="Recoverable" value={currency(totals.recoverable)} tone="rose" />
          <Tile label="Unreconciled lines" value={String(totals.unreconciled)} tone="amber" />
        </div>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="text-left">
                <th className="p-3 font-semibold">Issue</th>
                <th className="p-3 font-semibold">Contractor</th>
                <th className="p-3 font-semibold">Project · Package</th>
                <th className="p-3 font-semibold">Material</th>
                <th className="p-3 font-semibold text-right">Issued</th>
                <th className="p-3 font-semibold text-right">Returned</th>
                <th className="p-3 font-semibold text-right">Consumed</th>
                <th className="p-3 font-semibold text-right">Waste</th>
                <th className="p-3 font-semibold text-right">Damaged</th>
                <th className="p-3 font-semibold text-right">Pending</th>
                <th className="p-3 font-semibold text-right">Recoverable</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading && <tr><td colSpan={11} className="p-8 text-center text-muted-foreground">Loading…</td></tr>}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={11} className="p-8 text-center text-muted-foreground">
                  No materials issued to contractors yet. Issue them from a work package.
                </td></tr>
              )}
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="p-3 font-mono text-xs">{String(r.issueNumber ?? "—")}
                    <div className="text-slate-400">{String(r.issueDate ?? "")}</div>
                  </td>
                  <td className="p-3">{String(r.contractorName ?? "—")}</td>
                  <td className="p-3 text-xs">
                    <div>{String(r.projectName ?? "—")}</div>
                    <div className="text-muted-foreground">{String(r.workPackage ?? "—")}</div>
                  </td>
                  <td className="p-3">{String(r.material ?? "—")}
                    <span className="text-xs text-slate-400"> {String(r.unit ?? "")}</span>
                  </td>
                  <td className="p-3 text-right">{qty(r.issuedQuantity)}</td>
                  <td className="p-3 text-right">{qty(r.returnedQuantity)}</td>
                  <td className="p-3 text-right">{qty(r.consumedQuantity)}</td>
                  <td className="p-3 text-right">{qty(r.wasteQuantity)}</td>
                  <td className="p-3 text-right">{qty(r.damagedQuantity)}</td>
                  <td className={`p-3 text-right ${Number(r.unreconciled ?? 0) > 0 ? "text-amber-600 font-bold" : ""}`}>
                    {qty(r.unreconciled)}
                  </td>
                  <td className={`p-3 text-right ${Number(r.recoverableValue ?? 0) > 0 ? "text-rose-600 font-semibold" : ""}`}>
                    {currency(Number(r.recoverableValue ?? 0))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: "rose" | "amber" }) {
  const color = tone === "rose" ? "text-rose-600" : tone === "amber" ? "text-amber-600" : "text-slate-900";
  return (
    <div className="bg-white border rounded-xl px-4 py-2 shadow-sm">
      <div className="text-[10px] font-semibold uppercase text-slate-400">{label}</div>
      <div className={`text-base font-black ${color}`}>{value}</div>
    </div>
  );
}

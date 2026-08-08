import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { contractorApi } from "@/api/contractorApi";
import type { ContractorWorkPackage } from "@/types/contractor";
import { WP_STATUS_TONE } from "@/types/contractor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wand2, ExternalLink, AlertTriangle } from "lucide-react";

const currency = (n?: number) => `₹${(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

/**
 * Contractor execution inside the Project Command Center. Deliberately read-mostly:
 * the only write here is generating packages from the BOQ — assignment, execution and
 * billing all happen on the work package itself, so there is one place those rules live.
 */
export default function ProjectContractorsTab({ projectId }: { projectId: number }) {
  const [packages, setPackages] = useState<ContractorWorkPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    contractorApi.getWorkPackagesByProject(projectId)
      .then(setPackages).catch(() => setPackages([])).finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    setBusy(true); setMessage(null);
    try {
      const res = await contractorApi.generateFromBoq(projectId);
      const total = res.packagesCreated + res.packagesUpdated + res.itemsLinked;
      setMessage(total === 0
        ? `Already in sync — ${res.boqItemsConsidered} approved BOQ item(s), nothing new to package.`
        : `Created ${res.packagesCreated} package(s), updated ${res.packagesUpdated}, linked ${res.itemsLinked} BOQ item(s)` +
          (res.itemsSkipped ? `, skipped ${res.itemsSkipped} already allocated.` : "."));
      load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not generate work packages.");
    } finally { setBusy(false); }
  };

  const totals = packages.reduce((a, p) => ({
    estimated: a.estimated + Number(p.estimatedCost ?? 0),
    billed: a.billed + Number(p.billedAmount ?? 0),
    paid: a.paid + Number(p.paidAmount ?? 0),
    delayed: a.delayed + (p.delayed ? 1 : 0),
  }), { estimated: 0, billed: 0, paid: 0, delayed: 0 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Contractor Work Packages</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Subcontracted scope on this project — carved from the BOQ by phase, room and trade.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={generate} disabled={busy}>
            <Wand2 className="w-4 h-4 mr-1" /> {busy ? "Generating…" : "Generate from BOQ"}
          </Button>
          <Link to={`/contractors/work-packages?projectId=${projectId}`}>
            <Button variant="outline"><ExternalLink className="w-4 h-4 mr-1" /> Open module</Button>
          </Link>
        </div>
      </div>

      {message && (
        <div className="text-sm bg-blue-50 border border-blue-200 text-blue-800 rounded-md p-3">{message}</div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Tile label="Packages" value={String(packages.length)}
              hint={totals.delayed ? `${totals.delayed} delayed` : undefined} />
        <Tile label="Contracted value" value={currency(totals.estimated)} />
        <Tile label="Billed" value={currency(totals.billed)} />
        <Tile label="Paid" value={currency(totals.paid)}
              hint={`outstanding ${currency(totals.billed - totals.paid)}`} />
      </div>

      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="text-left">
                <th className="p-3 font-semibold">Package</th>
                <th className="p-3 font-semibold">Phase · Room</th>
                <th className="p-3 font-semibold">Trade</th>
                <th className="p-3 font-semibold">Dates</th>
                <th className="p-3 font-semibold">Progress</th>
                <th className="p-3 font-semibold text-right">Estimated</th>
                <th className="p-3 font-semibold text-right">Billed</th>
                <th className="p-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading && <tr><td colSpan={8} className="p-8 text-center text-slate-500">Loading…</td></tr>}
              {!loading && packages.length === 0 && (
                <tr><td colSpan={8} className="p-10 text-center text-slate-500">
                  No contractor packages yet. Use “Generate from BOQ” to carve the approved scope
                  into packages by phase, room and trade.
                </td></tr>
              )}
              {packages.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="p-3">
                    <Link to={`/contractors/work-packages/${p.id}`} className="font-bold text-slate-800 hover:text-primary">
                      {p.packageName}
                    </Link>
                    <div className="font-mono text-[11px] text-slate-400">{p.packageCode}</div>
                  </td>
                  <td className="p-3 text-xs text-slate-600">
                    {[p.phase?.name, p.room?.roomName].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="p-3">
                    {p.trade ? <Badge className="bg-slate-100 text-slate-700">{p.trade.replace(/_/g, " ")}</Badge> : "—"}
                  </td>
                  <td className="p-3 text-xs">
                    <div>{p.startDate ?? "—"}</div>
                    <div className={p.delayed ? "text-rose-600 font-semibold inline-flex items-center gap-1" : "text-slate-400"}>
                      {p.delayed && <AlertTriangle className="w-3 h-3" />}{p.endDate ?? "—"}
                    </div>
                  </td>
                  <td className="p-3 w-28">
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${p.completionPercentage}%` }} />
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">{p.completionPercentage}%</div>
                  </td>
                  <td className="p-3 text-right font-semibold">{currency(p.estimatedCost)}</td>
                  <td className="p-3 text-right">{currency(p.billedAmount)}</td>
                  <td className="p-3">
                    <Badge className={WP_STATUS_TONE[p.status]}>{p.status.replace(/_/g, " ")}</Badge>
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

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-white border rounded-2xl p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase text-slate-400">{label}</div>
      <div className="text-xl font-black text-slate-900 mt-1">{value}</div>
      {hint && <div className="text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

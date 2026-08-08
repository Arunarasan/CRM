import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { contractorApi } from "@/api/contractorApi";
import type { ContractorDailyProgress } from "@/types/contractor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HardHat, Users } from "lucide-react";

/** Today's site progress across every contractor, with the site engineer's verify/reject action. */
export default function ProgressPage() {
  const [rows, setRows] = useState<ContractorDailyProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    contractorApi.getTodaysProgress()
      .then(setRows).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const verify = async (id: number, approve: boolean) => {
    setBusy(id); setError(null);
    try {
      await contractorApi.verifyProgress(id, approve, approve ? undefined : "Does not match site");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the report.");
    } finally { setBusy(null); }
  };

  const workers = rows.reduce((s, r) => s + (r.workersCount ?? 0), 0);
  const pending = rows.filter((r) => r.status === "SUBMITTED").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Tile label="Reports today" value={String(rows.length)} icon={HardHat} />
        <Tile label="Workers on site" value={String(workers)} icon={Users} />
        <Tile label="Awaiting verification" value={String(pending)} icon={HardHat} tone="amber" />
      </div>

      {error && <div className="text-sm bg-rose-50 border border-rose-200 text-rose-700 rounded-md p-3">{error}</div>}

      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-slate-50">
          <h3 className="font-bold text-slate-800 text-sm">Today's contractor progress</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Only verified reports roll up into work package, phase and project progress.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-500 border-b">
              <tr className="text-left">
                <th className="p-3 font-semibold">Work package</th>
                <th className="p-3 font-semibold">Contractor</th>
                <th className="p-3 font-semibold">Work done</th>
                <th className="p-3 font-semibold text-center">%</th>
                <th className="p-3 font-semibold text-center">Workers</th>
                <th className="p-3 font-semibold">Issues</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Loading…</td></tr>}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">
                  No progress reported today.
                </td></tr>
              )}
              {rows.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="p-3">
                    <Link to={`/contractors/work-packages/${p.workPackage.id}`}
                          className="font-bold text-slate-800 hover:text-primary">
                      {p.workPackage.packageName}
                    </Link>
                    <div className="text-[11px] text-slate-400">{p.project?.projectName}</div>
                  </td>
                  <td className="p-3">{p.contractor?.name}</td>
                  <td className="p-3 max-w-xs">{p.workDone ?? "—"}</td>
                  <td className="p-3 text-center font-bold">{p.completionPercentage}%</td>
                  <td className="p-3 text-center">{p.workersCount ?? "—"}</td>
                  <td className="p-3 text-rose-600 text-xs">{p.issues ?? "—"}</td>
                  <td className="p-3">
                    <Badge className={
                      p.status === "VERIFIED" ? "bg-emerald-100 text-emerald-700"
                      : p.status === "REJECTED" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                    }>{p.status}</Badge>
                  </td>
                  <td className="p-3 text-right">
                    {p.status === "SUBMITTED" && (
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" disabled={busy === p.id} onClick={() => verify(p.id, true)}>Verify</Button>
                        <Button size="sm" variant="outline" disabled={busy === p.id} onClick={() => verify(p.id, false)}>
                          Reject
                        </Button>
                      </div>
                    )}
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

function Tile({ label, value, icon: Icon, tone }: {
  label: string; value: string; icon: React.ElementType; tone?: "amber";
}) {
  return (
    <div className="bg-white border rounded-2xl p-5 shadow-sm">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${
        tone === "amber" ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-600"}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-2xl font-black text-slate-900">{value}</div>
      <div className="text-xs font-semibold text-slate-500 mt-1">{label}</div>
    </div>
  );
}

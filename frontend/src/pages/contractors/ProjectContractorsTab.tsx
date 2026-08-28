import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { contractorApi } from "@/api/contractorApi";
import type { ContractorWorkPackage, Contractor } from "@/types/contractor";
import { WP_STATUS_TONE } from "@/types/contractor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import SearchableSelect from "@/components/ui/searchable-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Wand2, ExternalLink, AlertTriangle, UserPlus, Play, CheckCircle2, Loader2 } from "lucide-react";

const currency = (n?: number) => `₹${(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

// Package statuses at which a contractor can still be assigned inline.
const ASSIGNABLE = new Set(["DRAFT", "PENDING_ASSIGNMENT"]);

/**
 * Contractor execution inside the Project Command Center. Practical actions inline — generate
 * packages from the BOQ, assign a contractor, start/complete work — while the detailed
 * acceptance and billing workflow still lives on the work-package page (deep-linked per row).
 */
export default function ProjectContractorsTab({ projectId }: { projectId: number }) {
  const [packages, setPackages] = useState<ContractorWorkPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Inline assign dialog
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [assignFor, setAssignFor] = useState<ContractorWorkPackage | null>(null);
  const [assignForm, setAssignForm] = useState<{ contractorId: string; agreedAmount: number; startDate: string; endDate: string }>(
    { contractorId: "", agreedAmount: 0, startDate: "", endDate: "" });
  const [assigning, setAssigning] = useState(false);

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

  const openAssign = (p: ContractorWorkPackage) => {
    if (contractors.length === 0) {
      contractorApi.list({ status: "ACTIVE", size: 200 })
        .then((res: any) => setContractors(res.content || res || []))
        .catch(() => toast.error("Could not load contractors"));
    }
    setAssignForm({ contractorId: "", agreedAmount: Number(p.estimatedCost) || 0, startDate: p.startDate || "", endDate: p.endDate || "" });
    setAssignFor(p);
  };

  const submitAssign = () => {
    if (!assignFor) return;
    if (!assignForm.contractorId) { toast.error("Select a contractor"); return; }
    setAssigning(true);
    contractorApi.assign(assignFor.id, Number(assignForm.contractorId), {
      agreedAmount: Number(assignForm.agreedAmount) || 0,
      startDate: assignForm.startDate || undefined,
      endDate: assignForm.endDate || undefined,
    })
      .then(() => { setAssignFor(null); load(); toast.success("Contractor assigned"); })
      .catch((e: any) => toast.error(e?.response?.data?.message || "Failed to assign contractor"))
      .finally(() => setAssigning(false));
  };

  const runLifecycle = (id: number, action: "start" | "complete") => {
    setRowBusy(id);
    const call = action === "start" ? contractorApi.startWork(id) : contractorApi.markWorkCompleted(id);
    call.then(() => { load(); toast.success(action === "start" ? "Work started" : "Marked completed"); })
      .catch((e: any) => toast.error(e?.response?.data?.message || "Action failed"))
      .finally(() => setRowBusy(null));
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
        <div className="text-sm bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md p-3">{message}</div>
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
                <th className="p-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading && <tr><td colSpan={9} className="p-8 text-center text-slate-500">Loading…</td></tr>}
              {!loading && packages.length === 0 && (
                <tr><td colSpan={9} className="p-10 text-center text-slate-500">
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
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                      {rowBusy === p.id && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                      {ASSIGNABLE.has(p.status) && rowBusy !== p.id && (
                        <Button size="sm" variant="outline" onClick={() => openAssign(p)} title="Assign a contractor">
                          <UserPlus className="w-3.5 h-3.5 mr-1" /> Assign
                        </Button>
                      )}
                      {p.status === "ACCEPTED" && rowBusy !== p.id && (
                        <Button size="sm" variant="outline" className="text-cyan-700 border-cyan-200 hover:bg-cyan-50" onClick={() => runLifecycle(p.id, "start")} title="Start work">
                          <Play className="w-3.5 h-3.5 mr-1" /> Start
                        </Button>
                      )}
                      {p.status === "IN_PROGRESS" && rowBusy !== p.id && (
                        <Button size="sm" variant="outline" className="text-emerald-700 border-emerald-200 hover:bg-emerald-50" onClick={() => runLifecycle(p.id, "complete")} title="Mark work completed">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Done
                        </Button>
                      )}
                      <Link to={`/contractors/work-packages/${p.id}`}>
                        <Button size="sm" variant="ghost" className="text-slate-500" title="Open package (accept / bill / details)">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inline assign-contractor dialog */}
      <Dialog open={!!assignFor} onOpenChange={(o) => { if (!o) setAssignFor(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign contractor — {assignFor?.packageName}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Contractor</Label>
              <SearchableSelect
                value={assignForm.contractorId}
                onChange={(v) => setAssignForm(s => ({ ...s, contractorId: v }))}
                options={contractors.map(c => ({ value: String(c.id), label: c.name, hint: (c.trade as string) || c.companyName }))}
                placeholder="Select contractor…"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Agreed amount (₹)</Label>
              <Input type="number" min={0} value={assignForm.agreedAmount} onChange={e => setAssignForm(s => ({ ...s, agreedAmount: Number(e.target.value) }))} />
              <p className="text-xs text-slate-400">Estimated for this package: {currency(assignFor?.estimatedCost)}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Start date</Label><Input type="date" value={assignForm.startDate} onChange={e => setAssignForm(s => ({ ...s, startDate: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>End date</Label><Input type="date" value={assignForm.endDate} onChange={e => setAssignForm(s => ({ ...s, endDate: e.target.value }))} /></div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAssignFor(null)} disabled={assigning}>Cancel</Button>
              <Button onClick={submitAssign} disabled={assigning}>{assigning ? "Assigning…" : "Assign contractor"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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

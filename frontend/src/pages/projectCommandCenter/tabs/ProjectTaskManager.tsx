import { useCallback, useEffect, useState } from "react";
import { Loader2, Sparkles, UserPlus, Zap, CheckCircle2, X } from "lucide-react";
import { smartAssignmentApi, type TaskBoardRow, type TaskAssigneeView } from "@/api/smartAssignmentApi";
import { employeeTaskApi } from "@/api/employeeTaskApi";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ResourceSelect, { type ResourceSelection } from "@/components/workforce/ResourceSelect";

const BUCKET_BADGE: Record<string, string> = {
  UNASSIGNED: "bg-rose-100 text-rose-700",
  ASSIGNED: "bg-emerald-100 text-emerald-700",
  IN_PROGRESS: "bg-cyan-100 text-cyan-700",
  NEEDS_APPROVAL: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
};
const bucketLabel = (b: string) => b.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * A simple task board for THIS project — every task with its assignees, plus one-click Auto-assign
 * (best-fit from the smart engine) and manual assign/remove. Scoped to the project so the admin
 * manages people-on-tasks here instead of leaving for the global /tasks page.
 */
export default function ProjectTaskManager({ projectId, onChanged }: { projectId: number; onChanged?: () => void }) {
  const [rows, setRows] = useState<TaskBoardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [manualFor, setManualFor] = useState<TaskBoardRow | null>(null);
  const [manualSel, setManualSel] = useState<ResourceSelection | null>(null);
  const [manualBusy, setManualBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    smartAssignmentApi.taskBoard()
      .then((all) => setRows(all.filter((r) => r.projectId === projectId)))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const counts = rows.reduce<Record<string, number>>((a, r) => { a[r.bucket] = (a[r.bucket] || 0) + 1; return a; }, {});
  const unassigned = rows.filter((r) => r.bucket === "UNASSIGNED");
  // Unassigned first (needs attention), then the rest in their original order.
  const ordered = [...rows].sort((a, b) => (a.bucket === "UNASSIGNED" ? 0 : 1) - (b.bucket === "UNASSIGNED" ? 0 : 1));

  const refresh = () => { load(); onChanged?.(); };

  // Recommend the best-fit resource for a task and assign it — returns the assigned name or null.
  const autoAssignOne = async (taskId: number): Promise<string | null> => {
    const res = await smartAssignmentApi.recommend({ taskId });
    const pick = res.topPicks?.[0] || res.recommendations?.[0];
    if (!pick) return null;
    await smartAssignmentApi.assign(taskId, [{
      resourceType: pick.resourceType, resourceId: pick.resourceId,
      suitabilityScore: pick.suitabilityScore, reason: pick.reasons?.[0],
    }], "AUTO");
    return pick.name;
  };

  const handleAutoAssign = (taskId: number) => {
    setBusyId(taskId);
    autoAssignOne(taskId)
      .then((name) => { if (name) toast.success(`Auto-assigned ${name}`); else toast.info("No suitable resource found for this task."); refresh(); })
      .catch((e: any) => toast.error(e?.response?.data?.message || "Auto-assign failed"))
      .finally(() => setBusyId(null));
  };

  const handleAutoAssignAll = async () => {
    if (unassigned.length === 0) return;
    setBulkRunning(true);
    let assigned = 0, skipped = 0;
    for (const t of unassigned) {
      try { const name = await autoAssignOne(t.id); if (name) assigned++; else skipped++; }
      catch { skipped++; }
    }
    setBulkRunning(false);
    toast.success(`Auto-assigned ${assigned} task(s)${skipped ? `, ${skipped} left (no fit)` : ""}.`);
    refresh();
  };

  const handleRemove = (taskId: number, a: TaskAssigneeView) => {
    setBusyId(taskId);
    employeeTaskApi.unassignResource(taskId, a.resourceType, a.resourceId)
      .then(() => { toast.success(`Removed ${a.name}`); refresh(); })
      .catch((e: any) => toast.error(e?.response?.data?.message || "Failed to remove"))
      .finally(() => setBusyId(null));
  };

  const submitManual = () => {
    if (!manualFor || !manualSel) { toast.error("Pick someone to assign"); return; }
    setManualBusy(true);
    smartAssignmentApi.assign(manualFor.id, [{ resourceType: manualSel.resourceType, resourceId: manualSel.resourceId }], "MANUAL")
      .then(() => { toast.success(`Assigned ${manualSel.name || "resource"}`); setManualFor(null); setManualSel(null); refresh(); })
      .catch((e: any) => toast.error(e?.response?.data?.message || "Failed to assign"))
      .finally(() => setManualBusy(false));
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
      <div className="p-4 border-b bg-slate-50 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-bold text-slate-800 flex items-center"><Sparkles className="w-4 h-4 mr-2 text-emerald-600" /> Project Tasks &amp; Assignment</h3>
        {unassigned.length > 0 && (
          <Button size="sm" onClick={handleAutoAssignAll} disabled={bulkRunning}>
            {bulkRunning ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Zap className="w-4 h-4 mr-1" />}
            Auto-assign all ({unassigned.length})
          </Button>
        )}
      </div>

      {/* Bucket summary */}
      <div className="grid grid-cols-3 sm:grid-cols-5 divide-x divide-slate-100 border-b">
        {([
          ["Unassigned", counts.UNASSIGNED || 0, "text-rose-600"],
          ["Assigned", counts.ASSIGNED || 0, "text-emerald-600"],
          ["In progress", counts.IN_PROGRESS || 0, "text-cyan-600"],
          ["Needs approval", counts.NEEDS_APPROVAL || 0, "text-amber-600"],
          ["Completed", counts.COMPLETED || 0, "text-emerald-600"],
        ] as [string, number, string][]).map(([label, val, cls]) => (
          <div key={label} className="p-3 text-center">
            <div className={`text-xl font-black ${cls}`}>{val}</div>
            <div className="text-[11px] font-medium text-slate-400">{label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-8 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-slate-400">No tasks on this project yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              <tr className="text-left border-b">
                <th className="p-3">Task</th>
                <th className="p-3">Status</th>
                <th className="p-3">Assigned to</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {ordered.map((t) => {
                const busy = busyId === t.id;
                const done = t.bucket === "COMPLETED";
                return (
                  <tr key={t.id} className="align-top hover:bg-slate-50">
                    <td className="p-3">
                      <div className="font-medium text-slate-800">{t.taskName}</div>
                      <div className="text-xs text-slate-400">{t.priority ? `${t.priority} priority` : "—"}{t.dueDate ? ` · due ${t.dueDate}` : ""}</div>
                    </td>
                    <td className="p-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${BUCKET_BADGE[t.bucket] || "bg-slate-100 text-slate-600"}`}>{bucketLabel(t.bucket)}</span>
                    </td>
                    <td className="p-3">
                      {t.assignees.length === 0 ? (
                        <span className="text-xs text-slate-400">Unassigned</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {t.assignees.map((a) => (
                            <span key={`${a.resourceType}-${a.resourceId}`} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                              {a.name}
                              {!done && (
                                <button type="button" onClick={() => handleRemove(t.id, a)} disabled={busy} className="text-slate-400 hover:text-rose-500 disabled:opacity-40" title={`Remove ${a.name}`}>
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        {busy ? (
                          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                        ) : done ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <>
                            {t.assignees.length === 0 && (
                              <Button size="sm" onClick={() => handleAutoAssign(t.id)} disabled={bulkRunning} title="Assign best-fit automatically">
                                <Zap className="w-3.5 h-3.5 mr-1" /> Auto
                              </Button>
                            )}
                            <Button size="sm" variant="outline" onClick={() => { setManualSel(null); setManualFor(t); }} disabled={bulkRunning} title="Choose who to assign">
                              <UserPlus className="w-3.5 h-3.5 mr-1" /> {t.assignees.length === 0 ? "Assign" : "Add"}
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Manual assign dialog */}
      <Dialog open={!!manualFor} onOpenChange={(o) => { if (!o) setManualFor(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign — {manualFor?.taskName}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <ResourceSelect value={manualSel} onChange={setManualSel} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setManualFor(null)} disabled={manualBusy}>Cancel</Button>
              <Button onClick={submitManual} disabled={manualBusy || !manualSel}>{manualBusy ? "Assigning…" : "Assign"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

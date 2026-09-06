import { useEffect, useState } from "react";
import { GitBranch, Lock, CheckCircle2, Zap, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ResourceSelect, { ResourceSelection } from "@/components/workforce/ResourceSelect";
import { employeeTaskApi } from "@/api/employeeTaskApi";
import { smartAssignmentApi } from "@/api/smartAssignmentApi";
import { EmployeeRecommendation } from "@/types/assignment";
import { leadApi } from "../leadApi";
import { PRIORITY_STYLES, formatDateTime } from "../constants";
import { ListSkeleton } from "./shared";

// ---------------------------------------------------------------------------
// Lead Journey — the lead's auto-generated workflow tasks (Collect Requirement →
// Site Visit & Measurement → BOQ → Quotation). Same Task entities as the global
// board, surfaced here so the lead is the single place to see, assign and track
// them. Each actionable step can be assigned one-click (Auto), from the top-5
// (Smart), or by hand. Locked steps unlock as the previous one is completed.
// ---------------------------------------------------------------------------

interface WorkflowRow {
  id: number;
  taskName: string;
  status: string;
  priority: string | null;
  dueDate: string | null;
  projectId: number | null;
  orderIndex: number | null;
  locked: boolean;
  categoryLabel: string;
  assignees: { resourceType: string; resourceId: number; name: string; code: string | null; status: string }[];
}

const STATUS_STYLE: Record<string, string> = {
  COMPLETED: "bg-emerald-100 text-emerald-700",
  WAITING_APPROVAL: "bg-orange-100 text-orange-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  LOCKED: "bg-slate-100 text-slate-400",
};

export default function LeadJourneyTab({ leadId }: { leadId: string }) {
  const [rows, setRows] = useState<WorkflowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualFor, setManualFor] = useState<number | null>(null);
  const [pick, setPick] = useState<ResourceSelection | null>(null);
  const [busyTask, setBusyTask] = useState<number | null>(null);
  const [smartFor, setSmartFor] = useState<WorkflowRow | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    leadApi.getWorkflowTasks(leadId)
      .then((res) => setRows(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };
  useEffect(load, [leadId]);

  const assignManual = (taskId: number) => {
    if (!pick) return;
    setBusyTask(taskId); setErr(null);
    employeeTaskApi.assignResources(taskId, [{ resourceType: pick.resourceType, resourceId: pick.resourceId }])
      .then(() => { setManualFor(null); setPick(null); load(); })
      .catch(() => setErr("Failed to assign"))
      .finally(() => setBusyTask(null));
  };

  // One-click Auto — assign the single best-fit person the engine recommends.
  const autoAssign = (t: WorkflowRow) => {
    setBusyTask(t.id); setErr(null);
    smartAssignmentApi.recommend({ taskId: t.id, projectId: t.projectId, requiredCount: 1, includeExcluded: false })
      .then((res) => {
        const best = (res.recommendations || [])[0];
        if (!best) { setErr("No eligible employee found for auto-assign."); return Promise.reject(); }
        return smartAssignmentApi.assign(
          t.id,
          [{ resourceType: best.resourceType, resourceId: best.resourceId, suitabilityScore: best.suitabilityScore, reason: (best.reasons || []).join("; ") }],
          "AUTO",
        );
      })
      .then(() => load())
      .catch(() => {})
      .finally(() => setBusyTask(null));
  };

  const unassign = (taskId: number, r: WorkflowRow["assignees"][number]) => {
    employeeTaskApi.unassignResource(taskId, r.resourceType, r.resourceId).then(load).catch(console.error);
  };

  if (loading) return <Card><CardContent className="py-4"><ListSkeleton rows={3} /></CardContent></Card>;

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          <GitBranch className="h-6 w-6 mx-auto mb-2 opacity-40" />
          No workflow tasks for this lead yet. They're created automatically as the lead progresses.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <GitBranch className="h-4 w-4 text-primary" /> Lead Journey
          <span className="text-xs font-normal text-muted-foreground">· auto-generated steps, one at a time</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {err && <div className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>}
        {rows.map((t, i) => {
          const status = (t.status || "").toUpperCase();
          const done = status === "COMPLETED";
          const canAssign = !t.locked && !done;
          const busy = busyTask === t.id;
          return (
            <div key={t.id} className={`border rounded-lg p-3 ${t.locked ? "opacity-60 bg-muted/20" : "bg-muted/30"}`}>
              <div className="flex items-start gap-3">
                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-emerald-600 text-white" : "bg-background border text-slate-500"}`}>
                  {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-sm font-medium ${done ? "line-through text-muted-foreground" : ""}`}>{t.taskName}</span>
                    {t.locked
                      ? <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded-full"><Lock className="h-3 w-3" /> Locked</span>
                      : <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded-full font-bold ${STATUS_STYLE[status] || "bg-background border"}`}>{status.replace(/_/g, " ") || "TO DO"}</span>}
                    {t.priority && <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded-full font-bold ${PRIORITY_STYLES[t.priority] || ""}`}>{t.priority}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {t.dueDate ? `Due ${formatDateTime(t.dueDate)}` : "No due date"}
                    {t.locked && " · unlocks when the previous step is completed"}
                  </div>

                  {/* assignees */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {t.assignees.length === 0 && !t.locked && <span className="text-xs text-amber-600 font-medium">Unassigned</span>}
                    {t.assignees.map((a) => (
                      <span key={`${a.resourceType}-${a.resourceId}`} className="inline-flex items-center gap-1 rounded-full bg-background border px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        {a.name}{a.code ? <span className="text-slate-400">· {a.code}</span> : null}
                        <button onClick={() => unassign(t.id, a)} className="text-slate-400 hover:text-red-600" title="Remove"><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>

                  {/* assign actions */}
                  {canAssign && manualFor !== t.id && (
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <Button type="button" size="sm" className="h-8" onClick={() => autoAssign(t)} disabled={busy}>
                        <Zap className="h-3.5 w-3.5 mr-1 text-amber-300" /> {busy ? "Assigning…" : "Auto-assign"}
                      </Button>
                      <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => setSmartFor(t)} disabled={busy}>
                        <Users className="h-3.5 w-3.5 mr-1" /> Smart Assign
                      </Button>
                      <Button type="button" size="sm" variant="ghost" className="h-8 text-muted-foreground" onClick={() => { setManualFor(t.id); setPick(null); }} disabled={busy}>
                        Pick manually
                      </Button>
                    </div>
                  )}
                  {canAssign && manualFor === t.id && (
                    <div className="flex items-center gap-2 mt-2">
                      <ResourceSelect value={pick} onChange={setPick} className="flex-1" placeholder="Assign an employee…" />
                      <Button type="button" size="sm" onClick={() => assignManual(t.id)} disabled={!pick || busy}>{busy ? "…" : "Assign"}</Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => { setManualFor(null); setPick(null); }}>Cancel</Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>

      {smartFor && (
        <SmartAssignChooser task={smartFor} onClose={() => setSmartFor(null)} onAssigned={() => { setSmartFor(null); load(); }} />
      )}
    </Card>
  );
}

// Top-5 ranked chooser — mirrors the global Tasks board's Smart Assign.
function SmartAssignChooser({ task, onClose, onAssigned }: {
  task: WorkflowRow; onClose: () => void; onAssigned: () => void;
}) {
  const [recs, setRecs] = useState<EmployeeRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true); setError(null);
    smartAssignmentApi.recommend({ taskId: task.id, projectId: task.projectId, requiredCount: 5, includeExcluded: false })
      .then((res) => setRecs((res.recommendations || []).slice(0, 5)))
      .catch((e) => setError(e?.message || "Could not load recommendations"))
      .finally(() => setLoading(false));
  }, [task.id, task.projectId]);

  const assign = (r: EmployeeRecommendation) => {
    setBusyId(r.resourceId); setError(null);
    smartAssignmentApi.assign(task.id, [{ resourceType: r.resourceType, resourceId: r.resourceId, suitabilityScore: r.suitabilityScore, reason: (r.reasons || []).join("; ") }], "AUTO")
      .then(onAssigned)
      .catch((e) => setError(e?.message || "Assignment failed"))
      .finally(() => setBusyId(null));
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Zap className="w-4 h-4 text-amber-500" /> Smart Assign — {task.taskName}</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">Top 5 best-fit employees, ranked by availability, workload, skills &amp; performance.</p>
        {error && <div className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
        <div className="space-y-2 max-h-[60vh] overflow-y-auto py-1">
          {loading && <p className="py-8 text-center text-sm text-muted-foreground">Analysing team…</p>}
          {!loading && recs.length === 0 && !error && <p className="py-8 text-center text-sm text-muted-foreground">No eligible employees found.</p>}
          {recs.map((r, i) => (
            <div key={r.resourceId} className="flex items-center gap-3 rounded-lg border p-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">{i + 1}</div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-800 truncate">{r.name}
                  {r.employeeCode ? <span className="ml-1 text-xs font-normal text-slate-400">· {r.employeeCode}</span> : null}</p>
                <p className="text-xs text-slate-500 truncate">{r.designation || "—"} · {r.tasksToday} today · {r.remainingHours}h free</p>
              </div>
              <div className="flex flex-col items-center px-1">
                <span className={`text-sm font-bold ${r.suitabilityScore >= 70 ? "text-emerald-600" : r.suitabilityScore >= 55 ? "text-amber-600" : "text-rose-600"}`}>{Math.round(r.suitabilityScore)}</span>
                <span className="text-[9px] text-slate-400">score</span>
              </div>
              <Button size="sm" onClick={() => assign(r)} disabled={busyId != null}>{busyId === r.resourceId ? "…" : "Assign"}</Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

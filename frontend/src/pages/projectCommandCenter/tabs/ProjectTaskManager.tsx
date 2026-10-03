import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, UserPlus, Zap, X, Plus, ChevronRight, LayoutGrid } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { smartAssignmentApi, type TaskBoardRow, type TaskAssigneeView } from "@/api/smartAssignmentApi";
import { employeeTaskApi } from "@/api/employeeTaskApi";
import { taskApi } from "@/api/taskApi";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ResourceSelect, { type ResourceSelection } from "@/components/workforce/ResourceSelect";
import TaskCard from "@/components/tasks/TaskCard";
import TaskEditor from "@/components/tasks/TaskEditor";
import { bucketToLane, TASK_LANES, LANE_STYLES, type TaskCardModel, type TaskFormValues } from "@/components/tasks/taskShared";

const PROJECT_PRIORITIES = ["LOW", "MEDIUM", "HIGH"];

const pad = (n: number) => String(n).padStart(2, "0");
const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : null;
const isOverdue = (iso?: string | null, done?: boolean) =>
  !!iso && !done && new Date(iso).getTime() < new Date(new Date().toDateString()).getTime();
/** Add one day to a `yyyy-mm-dd` date, returning date-only (project tasks have no time). */
const addOneDay = (iso?: string | null) => {
  const d = iso ? new Date(iso) : new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * The project's task board — every task rendered as a shared TaskCard (same look as the lead
 * tasks tab), with inline edit (rename / priority / reschedule / description / delete) via the
 * shared TaskEditor, plus the existing one-click Auto-assign and manual assign/remove.
 */
export default function ProjectTaskManager({ projectId, onChanged, onAddTask, fieldTasks = [] }: {
  projectId: number;
  onChanged?: () => void;
  /** Opens the page's "create task" sheet. */
  onAddTask?: () => void;
  /** Raw project tasks — supply each card's % progress. */
  fieldTasks?: any[];
}) {
  const navigate = useNavigate();
  const progressOf = useMemo(
    () => Object.fromEntries((fieldTasks || []).map((t: any) => [t.id, Number(t.progress) || 0])) as Record<number, number>,
    [fieldTasks],
  );
  const [rows, setRows] = useState<TaskBoardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [manualFor, setManualFor] = useState<TaskBoardRow | null>(null);
  const [manualSel, setManualSel] = useState<ResourceSelection | null>(null);
  const [manualBusy, setManualBusy] = useState(false);
  // Edit sheet
  const [editorOpen, setEditorOpen] = useState(false);
  const [editRow, setEditRow] = useState<TaskBoardRow | null>(null);
  const [editInitial, setEditInitial] = useState<TaskFormValues | null>(null);

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
  const ordered = useMemo(
    () => [...rows].sort((a, b) => (a.bucket === "UNASSIGNED" ? 0 : 1) - (b.bucket === "UNASSIGNED" ? 0 : 1)),
    [rows],
  );

  const refresh = () => { load(); onChanged?.(); };

  const toModel = (r: TaskBoardRow): TaskCardModel => {
    const done = r.bucket === "COMPLETED";
    return {
      id: r.id,
      title: r.taskName,
      taskType: r.categoryLabel,
      priority: r.priority,
      status: r.status,
      lane: bucketToLane(r.bucket),
      dueLabel: fmtDate(r.dueDate),
      overdue: isOverdue(r.dueDate, done),
      assignees: r.assignees.map((a) => a.name),
      completed: done,
    };
  };

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

  // Fetch full details (board rows omit description) and open the editor prefilled.
  const openEdit = async (r: TaskBoardRow) => {
    setEditRow(r);
    setBusyId(r.id);
    try {
      const detail = await taskApi.details(r.id);
      const t = detail?.task ?? {};
      setEditInitial({
        title: t.taskName ?? r.taskName,
        taskType: "",
        priority: (t.priority ?? r.priority ?? "MEDIUM").toUpperCase(),
        reminderDate: (t.dueDate ?? r.dueDate)?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
        reminderTime: "09:00",
        assignedToId: "",
        status: t.status ?? r.status,
        description: t.description ?? "",
      });
      setEditorOpen(true);
    } catch {
      toast.error("Could not open the task for editing");
    } finally {
      setBusyId(null);
    }
  };

  const saveEdit = async (v: TaskFormValues) => {
    if (!editRow) return;
    await taskApi.editBasics(editRow.id, {
      taskName: v.title,
      priority: v.priority,
      dueDate: v.reminderDate || null,
      description: v.description,
    });
    toast.success("Task updated");
    refresh();
  };

  const deleteEdit = async () => {
    if (!editRow) return;
    await taskApi.remove(editRow.id);
    toast.success("Task deleted");
    refresh();
  };

  // Quick reschedule: push the due date out by one day (leaves everything else intact).
  const snooze = (r: TaskBoardRow) => {
    setBusyId(r.id);
    taskApi.editBasics(r.id, { dueDate: addOneDay(r.dueDate) })
      .then(() => { toast.success("Pushed out by a day"); refresh(); })
      .catch(() => toast.error("Could not reschedule the task"))
      .finally(() => setBusyId(null));
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden @container">
      <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2"><LayoutGrid className="w-5 h-5 text-emerald-700" /> Task Board</h3>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">{rows.length}</span>
          {(counts.UNASSIGNED || 0) > 0 && (
            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-600 ring-1 ring-rose-100">{counts.UNASSIGNED} unassigned</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unassigned.length > 0 && (
            <Button size="sm" variant="outline" onClick={handleAutoAssignAll} disabled={bulkRunning} className="h-9 rounded-xl">
              {bulkRunning ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Zap className="w-4 h-4 mr-1 text-amber-500" />}
              Auto-assign all
            </Button>
          )}
          {onAddTask && (
            <Button size="sm" onClick={onAddTask} className="h-9 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white">
              <Plus className="w-4 h-4 mr-1" /> Add Task
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-slate-400">No tasks on this project yet.</div>
      ) : (
        <div className="p-3 grid grid-cols-1 @2xl:grid-cols-2 @6xl:grid-cols-4 gap-3">
          {TASK_LANES.map((lane) => {
            const style = LANE_STYLES[lane.id];
            const laneRows = ordered.filter((t) => bucketToLane(t.bucket) === lane.id);
            return (
              <div key={lane.id} className="rounded-2xl bg-slate-50/70 border border-slate-100 p-2.5 flex flex-col min-w-0">
                <div className="mb-2 flex items-center gap-2 px-1">
                  <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                  <h4 className="text-xs font-bold uppercase tracking-wide text-slate-600">{lane.label}</h4>
                  <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500 ring-1 ring-slate-200">{laneRows.length}</span>
                </div>
                <div className="space-y-2">
                  {laneRows.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-200 py-5 text-center text-xs text-slate-400">No tasks</div>
                  )}
                  {laneRows.map((t) => {
                    const busy = busyId === t.id;
                    const done = t.bucket === "COMPLETED";
                    const pct = done ? 100 : (progressOf[t.id] ?? 0);
                    return (
                      <TaskCard
                        key={t.id}
                        task={toModel(t)}
                        hideAssignees
                        onEdit={() => openEdit(t)}
                        onSnooze={() => snooze(t)}
                        className="transition-shadow hover:shadow-md"
                        actions={
                          <div className="w-full space-y-2">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                                <div className={`h-full rounded-full ${pct >= 100 ? "bg-emerald-600" : "bg-amber-500"}`} style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[11px] font-bold text-slate-600 w-9 text-right">{pct}%</span>
                            </div>
                            <div className="flex w-full flex-wrap items-center gap-1.5">
                              {t.assignees.length === 0 ? (
                                <span className="text-xs text-slate-400">Unassigned</span>
                              ) : (
                                t.assignees.map((a) => (
                                  <span key={`${a.resourceType}-${a.resourceId}`} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                                    {a.name}
                                    {!done && (
                                      <button type="button" onClick={() => handleRemove(t.id, a)} disabled={busy} className="text-slate-400 hover:text-rose-500 disabled:opacity-40" title={`Remove ${a.name}`}>
                                        <X className="h-3 w-3" />
                                      </button>
                                    )}
                                  </span>
                                ))
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              {busy ? (
                                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                              ) : !done && (
                                <>
                                  {t.assignees.length === 0 && (
                                    <Button size="sm" onClick={() => handleAutoAssign(t.id)} disabled={bulkRunning} title="Assign best-fit automatically" className="h-7 px-2 text-xs">
                                      <Zap className="w-3.5 h-3.5 mr-1" /> Auto
                                    </Button>
                                  )}
                                  <Button size="sm" variant="outline" onClick={() => { setManualSel(null); setManualFor(t); }} disabled={bulkRunning} title="Choose who to assign" className="h-7 px-2 text-xs">
                                    <UserPlus className="w-3.5 h-3.5 mr-1" /> {t.assignees.length === 0 ? "Assign" : "Add"}
                                  </Button>
                                </>
                              )}
                              <button type="button" onClick={() => navigate(`/projects/${projectId}/tasks/${t.id}`)}
                                className="ml-auto inline-flex items-center gap-0.5 text-[11px] font-semibold text-emerald-700 hover:text-emerald-900">
                                Report <ChevronRight className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        }
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
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

      {/* Shared edit sheet — rename / priority / reschedule / description / delete. */}
      <TaskEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        initial={editInitial}
        editing
        users={[]}
        taskTypes={[]}
        priorityOptions={PROJECT_PRIORITIES}
        showType={false}
        showTime={false}
        showAssignee={false}
        showStatus={false}
        onSave={saveEdit}
        onDelete={deleteEdit}
      />
    </div>
  );
}

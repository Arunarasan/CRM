import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles, UserPlus, Zap, X } from "lucide-react";
import { smartAssignmentApi, type TaskBoardRow, type TaskAssigneeView } from "@/api/smartAssignmentApi";
import { employeeTaskApi } from "@/api/employeeTaskApi";
import { taskApi } from "@/api/taskApi";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ResourceSelect, { type ResourceSelection } from "@/components/workforce/ResourceSelect";
import TaskCard from "@/components/tasks/TaskCard";
import TaskEditor from "@/components/tasks/TaskEditor";
import TaskLanes from "@/components/tasks/TaskLanes";
import { bucketToLane, type TaskCardModel, type TaskFormValues } from "@/components/tasks/taskShared";

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
export default function ProjectTaskManager({ projectId, onChanged }: { projectId: number; onChanged?: () => void }) {
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
        <div className="p-4">
        <TaskLanes
          items={ordered}
          laneOf={(t) => bucketToLane(t.bucket)}
          keyOf={(t) => t.id}
          gridClassName="grid gap-2.5 sm:grid-cols-2"
          renderCard={(t) => {
            const busy = busyId === t.id;
            const done = t.bucket === "COMPLETED";
            return (
              <TaskCard
                task={toModel(t)}
                hideAssignees
                onEdit={() => openEdit(t)}
                onSnooze={() => snooze(t)}
                actions={
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
                    <span className="ml-auto flex items-center gap-1.5">
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                      ) : !done && (
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
                    </span>
                  </div>
                }
              />
            );
          }}
        />
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

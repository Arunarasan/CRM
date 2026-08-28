import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { format } from "date-fns";
import {
  Plus, Search, RefreshCw, Zap, Users, CheckCircle2, Inbox, ListChecks,
  AlertTriangle, TriangleAlert, Timer, Check, X, GitBranch, UserCheck, Circle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  smartAssignmentApi, TaskBoardRow, TaskBucket, RosterRow,
} from "@/api/smartAssignmentApi";
import { EmployeeRecommendation } from "@/types/assignment";
import { workflowApi, ConsoleOverview, WorkflowTemplate } from "@/api/workflowApi";
import { employeeTaskApi } from "@/api/employeeTaskApi";
import { TimeLogSummary } from "@/types/employeeTask";
import ResourceSelect, { ResourceSelection } from "@/components/workforce/ResourceSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

// ============================================================ shared helpers

const priorityColor = (p?: string | null) => {
  switch ((p || "").toUpperCase()) {
    case "HIGH": case "URGENT": case "CRITICAL": return "text-red-700 bg-red-100 border-red-200";
    case "MEDIUM": return "text-orange-700 bg-orange-100 border-orange-200";
    case "LOW": return "text-emerald-700 bg-emerald-100 border-emerald-200";
    default: return "text-gray-700 bg-gray-100 border-gray-200";
  }
};

const BUCKETS: { id: TaskBucket | "ALL"; label: string }[] = [
  { id: "ALL", label: "All" },
  { id: "UNASSIGNED", label: "Unassigned" },
  { id: "ASSIGNED", label: "Assigned" },
  { id: "IN_PROGRESS", label: "In Progress" },
  { id: "NEEDS_APPROVAL", label: "Need Approval" },
  { id: "COMPLETED", label: "Completed" },
];

// The three buckets whose tasks can still take a (re)assignment inline via Smart Assign.
const ASSIGNABLE_BUCKETS: TaskBucket[] = ["UNASSIGNED", "ASSIGNED", "IN_PROGRESS"];

type MainTab = "tasks" | "employees" | "approvals" | "risk" | "templates";

// ============================================================ page

export default function Tasks() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState<MainTab>("tasks");
  const [board, setBoard] = useState<TaskBoardRow[]>([]);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [fullTasks, setFullTasks] = useState<Record<number, any>>({});
  const [loading, setLoading] = useState(false);

  const loadBoard = useCallback(() => {
    setLoading(true);
    Promise.all([
      smartAssignmentApi.taskBoard().catch(() => [] as TaskBoardRow[]),
      smartAssignmentApi.roster().catch(() => [] as RosterRow[]),
      api.get(`/tasks/all`).then(r => r.data).catch(() => [] as any[]),
    ]).then(([b, r, full]) => {
      setBoard(b);
      setRoster(r);
      const map: Record<number, any> = {};
      (full as any[]).forEach(t => { map[t.id] = t; });
      setFullTasks(map);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadBoard(); }, [loadBoard]);

  // --- edit / create dialog ---
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentTask, setCurrentTask] = useState<any>({});
  const [assignments, setAssignments] = useState<any[]>([]);
  const [checklists, setChecklists] = useState<any[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [applyingChecklist, setApplyingChecklist] = useState(false);
  const [assignPick, setAssignPick] = useState<ResourceSelection | null>(null);
  const [assigning, setAssigning] = useState(false);

  const openTask = (id: number) => {
    const t = fullTasks[id];
    setCurrentTask(t ? { ...t } : { id });
    setAssignments([]); setAssignPick(null); setChecklists([]); setNewChecklistItem("");
    setIsDialogOpen(true);
    loadAssignments(id); loadChecklist(id);
  };
  const openNew = () => {
    setCurrentTask({ status: "PENDING", priority: "MEDIUM" });
    setAssignments([]); setAssignPick(null); setChecklists([]); setNewChecklistItem("");
    setIsDialogOpen(true);
  };
  const loadAssignments = (id: number) => api.get(`/tasks/${id}/assignments`).then(r => setAssignments(r.data)).catch(() => {});
  const loadChecklist = (id: number) => api.get(`/tasks/${id}/checklist`).then(r => setChecklists(r.data)).catch(() => {});

  const applyStarterChecklist = () => {
    if (!currentTask.id) return;
    setApplyingChecklist(true);
    api.post(`/tasks/${currentTask.id}/checklist/apply`, { template: "AUTO" })
      .then(() => loadChecklist(currentTask.id))
      .catch(() => alert("Failed to add checklist"))
      .finally(() => setApplyingChecklist(false));
  };
  const addChecklistItem = () => {
    if (!currentTask.id || !newChecklistItem.trim()) return;
    api.post(`/tasks/${currentTask.id}/checklist/items`, { content: newChecklistItem.trim() })
      .then(() => { setNewChecklistItem(""); loadChecklist(currentTask.id); })
      .catch(() => alert("Failed to add item"));
  };
  const toggleChecklistItem = (itemId: number) =>
    api.post(`/tasks/checklist-items/${itemId}/toggle`).then(() => loadChecklist(currentTask.id)).catch(() => {});

  const assignPicked = () => {
    if (!currentTask.id || !assignPick) return;
    setAssigning(true);
    employeeTaskApi.assignResources(currentTask.id, [{ resourceType: assignPick.resourceType, resourceId: assignPick.resourceId }])
      .then(() => { setAssignPick(null); loadAssignments(currentTask.id); loadBoard(); })
      .catch(() => alert("Failed to assign"))
      .finally(() => setAssigning(false));
  };
  const unassignEmployee = (employeeId: number) => {
    if (!currentTask.id || !employeeId) return;
    employeeTaskApi.unassign(currentTask.id, employeeId)
      .then(() => { loadAssignments(currentTask.id); loadBoard(); })
      .catch(() => alert("Failed to remove assignment"));
  };
  const approveTask = () =>
    api.post(`/employee-tasks/${currentTask.id}/approve`).then(() => { setIsDialogOpen(false); loadBoard(); }).catch(() => alert("Failed to approve task"));
  const rejectTask = () => {
    const remarks = window.prompt("Rework remarks for the team:") || "";
    api.post(`/employee-tasks/${currentTask.id}/reject`, { remarks }).then(() => { setIsDialogOpen(false); loadBoard(); }).catch(() => alert("Failed to send task back"));
  };
  const handleSave = () => {
    const call = currentTask.id ? api.put(`/tasks/${currentTask.id}`, currentTask) : api.post(`/tasks`, currentTask);
    call.then(() => { setIsDialogOpen(false); setCurrentTask({}); loadBoard(); }).catch(() => alert("Failed to save task"));
  };

  // --- counts for stat row ---
  const counts = useMemo(() => {
    const c: Record<string, number> = { UNASSIGNED: 0, ASSIGNED: 0, IN_PROGRESS: 0, NEEDS_APPROVAL: 0, COMPLETED: 0 };
    board.forEach(t => { c[t.bucket] = (c[t.bucket] || 0) + 1; });
    return c;
  }, [board]);

  const tabs: { id: MainTab; label: string; admin?: boolean; badge?: number }[] = [
    { id: "tasks", label: "Tasks" },
    { id: "employees", label: "Employees" },
    { id: "approvals", label: "Time Approvals", admin: true },
    { id: "risk", label: "Projects at Risk", admin: true },
    { id: "templates", label: "Workflow", admin: true },
  ];
  const visibleTabs = tabs.filter(t => !t.admin || isAdmin);

  return (
    <div className="p-6 flex flex-col gap-5 bg-white min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Tasks &amp; Workforce</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Assign, track and balance work across your team — smart assignment built in.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadBoard} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1.5" /> New Task</Button>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatTile icon={Inbox} tone="text-amber-600" label="Unassigned" value={counts.UNASSIGNED} />
        <StatTile icon={UserCheck} tone="text-primary" label="Assigned" value={counts.ASSIGNED} />
        <StatTile icon={ListChecks} tone="text-emerald-600" label="In Progress" value={counts.IN_PROGRESS} />
        <StatTile icon={AlertTriangle} tone="text-orange-600" label="Need Approval" value={counts.NEEDS_APPROVAL} />
        <StatTile icon={CheckCircle2} tone="text-emerald-600" label="Completed" value={counts.COMPLETED} />
        <StatTile icon={Users} tone="text-slate-700" label="Employees" value={roster.length} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b">
        {visibleTabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-slate-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "tasks" && <TasksTab board={board} counts={counts} onEdit={openTask} onChanged={loadBoard} navigate={navigate} />}
      {tab === "employees" && <EmployeesTab roster={roster} board={board} isAdmin={isAdmin} onChanged={loadBoard} />}
      {tab === "approvals" && isAdmin && <ApprovalsTab />}
      {tab === "risk" && isAdmin && <RiskTab navigate={navigate} />}
      {tab === "templates" && isAdmin && <TemplatesTab />}

      {/* ---- Create / edit task dialog ---- */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{currentTask.id ? "Edit Task" : "Create Task"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-2">
            <div className="space-y-2">
              <Label>Task Title</Label>
              <Input value={currentTask.taskName || ""} onChange={e => setCurrentTask({ ...currentTask, taskName: e.target.value })} placeholder="e.g. Install ceiling lights" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <textarea className="w-full min-h-[90px] p-3 rounded-md border border-input bg-background text-sm"
                value={currentTask.description || ""} onChange={e => setCurrentTask({ ...currentTask, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={currentTask.status || "PENDING"} onChange={e => setCurrentTask({ ...currentTask, status: e.target.value })}>
                  <option value="PENDING">To Do</option><option value="ACCEPTED">Accepted</option>
                  <option value="IN_PROGRESS">In Progress</option><option value="PAUSED">Paused</option>
                  <option value="WAITING_MATERIAL">Waiting Material</option><option value="WAITING_APPROVAL">Waiting Approval</option>
                  <option value="COMPLETED">Done</option><option value="REWORK">Rework</option>
                  <option value="REJECTED">Rejected</option><option value="CANCELLED">Cancelled</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={currentTask.priority || "MEDIUM"} onChange={e => setCurrentTask({ ...currentTask, priority: e.target.value })}>
                  <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Start Date</Label>
                <Input type="date" value={currentTask.startDate || ""} onChange={e => setCurrentTask({ ...currentTask, startDate: e.target.value })} /></div>
              <div className="space-y-2"><Label>Due Date</Label>
                <Input type="date" value={currentTask.dueDate || ""} onChange={e => setCurrentTask({ ...currentTask, dueDate: e.target.value })} /></div>
            </div>

            {currentTask.id && (
              <div className="space-y-2">
                <Label>Assigned Team</Label>
                {assignments.length > 0 ? (
                  <div className="rounded-md border divide-y">
                    {assignments.map((a: any) => (
                      <div key={a.employeeId} className="flex items-center justify-between px-3 py-2 text-sm">
                        <span>{a.employeeName}{a.role ? ` (${a.role})` : ""}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-500">{a.status?.replace("_", " ")}</span>
                          {a.employeeId > 0 && <button onClick={() => unassignEmployee(a.employeeId)} className="text-xs font-medium text-red-500 hover:text-red-700">Remove</button>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-xs text-slate-400">No one assigned yet.</p>}
                <div className="flex items-center gap-2 pt-1">
                  <ResourceSelect value={assignPick} onChange={setAssignPick} className="flex-1" placeholder="Assign an employee…" />
                  <Button type="button" onClick={assignPicked} disabled={!assignPick || assigning}>{assigning ? "Assigning…" : "Assign"}</Button>
                </div>
              </div>
            )}

            {currentTask.id && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Checklist <span className="text-xs font-normal text-slate-400">(work steps)</span></Label>
                  {(() => {
                    const items = checklists.flatMap((c: any) => c.items || []);
                    const done = items.filter((i: any) => i.isCompleted).length;
                    return items.length > 0 ? <span className="text-xs font-semibold text-slate-500">{done}/{items.length} done</span> : null;
                  })()}
                </div>
                {checklists.flatMap((c: any) => c.items || []).length === 0 ? (
                  <div className="rounded-md border border-dashed p-4 text-center">
                    <p className="text-xs text-slate-400 mb-2">No checklist yet.</p>
                    <Button type="button" size="sm" variant="outline" onClick={applyStarterChecklist} disabled={applyingChecklist}>{applyingChecklist ? "Adding…" : "Add starter checklist"}</Button>
                  </div>
                ) : (
                  <div className="rounded-md border divide-y">
                    {checklists.map((c: any) => (
                      <div key={c.id}>
                        {(c.items || []).map((item: any) => (
                          <div key={item.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                            <button onClick={() => toggleChecklistItem(item.id)} className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${item.isCompleted ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300"}`}>
                              {item.isCompleted && <span className="text-xs leading-none">✓</span>}
                            </button>
                            <span className={item.isCompleted ? "text-slate-400 line-through" : "text-slate-700"}>{item.content}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <Input value={newChecklistItem} onChange={e => setNewChecklistItem(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addChecklistItem(); } }} placeholder="Add a checklist step…" className="flex-1" />
                  <Button type="button" variant="outline" onClick={addChecklistItem} disabled={!newChecklistItem.trim()}>Add</Button>
                </div>
              </div>
            )}

            {currentTask.status === "WAITING_APPROVAL" && (
              <div className="flex gap-2">
                <Button onClick={approveTask} className="flex-1 bg-emerald-600 hover:bg-emerald-700">Approve Completion</Button>
                <Button onClick={rejectTask} variant="outline" className="flex-1">Send Back for Rework</Button>
              </div>
            )}
            <Button onClick={handleSave} className="w-full">Save Task</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================ Tasks tab

function TasksTab({ board, counts, onEdit, onChanged, navigate }: {
  board: TaskBoardRow[]; counts: Record<string, number>;
  onEdit: (id: number) => void; onChanged: () => void; navigate: (to: string) => void;
}) {
  const [filter, setFilter] = useState<TaskBucket | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [assignFor, setAssignFor] = useState<TaskBoardRow | null>(null);

  const rows = useMemo(() => board.filter(t =>
    (filter === "ALL" || t.bucket === filter) &&
    t.taskName.toLowerCase().includes(search.toLowerCase())
  ), [board, filter, search]);

  return (
    <div className="flex flex-col gap-3">
      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        {BUCKETS.map(b => {
          const n = b.id === "ALL" ? board.length : (counts[b.id] || 0);
          return (
            <button key={b.id} onClick={() => setFilter(b.id)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${filter === b.id ? "border-primary bg-primary text-primary-foreground" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
              {b.label} <span className={`ml-1 ${filter === b.id ? "opacity-80" : "text-slate-400"}`}>{n}</span>
            </button>
          );
        })}
        <div className="relative ml-auto w-full max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Filter tasks…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
      </div>

      <div className="border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[820px]">
            <thead>
              <tr className="bg-slate-50 border-b text-xs text-slate-500">
                <th className="p-3 font-semibold">Task</th>
                <th className="p-3 font-semibold">Project</th>
                <th className="p-3 font-semibold">Assignee(s)</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold">Priority</th>
                <th className="p-3 font-semibold">Due</th>
                <th className="p-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-slate-400">No tasks in this view.</td></tr>
              )}
              {rows.map(t => (
                <tr key={t.id} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="p-3 font-semibold text-slate-800 cursor-pointer" onClick={() => onEdit(t.id)}>{t.taskName}</td>
                  <td className="p-3 text-slate-500">
                    {t.project ? (t.projectId
                      ? <button className="hover:underline" onClick={() => navigate(`/projects/${t.projectId}`)}>{t.project}</button>
                      : t.project) : "—"}
                  </td>
                  <td className="p-3">
                    {t.assignees.length === 0
                      ? <span className="text-xs text-amber-600 font-medium">Unassigned</span>
                      : (
                        <div className="flex flex-wrap gap-1">
                          {t.assignees.map((a, i) => (
                            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                              {a.name}{a.code ? <span className="text-slate-400">· {a.code}</span> : null}
                            </span>
                          ))}
                        </div>
                      )}
                  </td>
                  <td className="p-3"><span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[11px] rounded-full font-bold">{t.status?.replace(/_/g, " ")}</span></td>
                  <td className="p-3"><span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${priorityColor(t.priority)}`}>{t.priority || "—"}</span></td>
                  <td className="p-3 text-slate-500">{t.dueDate ? format(new Date(t.dueDate), "MMM d") : "—"}</td>
                  <td className="p-3 text-right">
                    {ASSIGNABLE_BUCKETS.includes(t.bucket)
                      ? <Button size="sm" variant="outline" className="h-8" onClick={() => setAssignFor(t)}><Zap className="w-3.5 h-3.5 mr-1 text-amber-500" /> Smart Assign</Button>
                      : <Button size="sm" variant="ghost" className="h-8 text-slate-500" onClick={() => onEdit(t.id)}>Open</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {assignFor && (
        <SmartAssignDialog task={assignFor} onClose={() => setAssignFor(null)} onAssigned={() => { setAssignFor(null); onChanged(); }} />
      )}
    </div>
  );
}

// ---- Inline Smart Assign (top 5 recommendations, same screen) ----

function SmartAssignDialog({ task, onClose, onAssigned }: {
  task: TaskBoardRow; onClose: () => void; onAssigned: () => void;
}) {
  const [recs, setRecs] = useState<EmployeeRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true); setError(null);
    smartAssignmentApi.recommend({ taskId: task.id, projectId: task.projectId, requiredCount: 5, includeExcluded: false })
      .then(res => setRecs((res.recommendations || []).slice(0, 5)))
      .catch(e => setError(e?.message || "Could not load recommendations"))
      .finally(() => setLoading(false));
  }, [task.id, task.projectId]);

  const assign = (r: EmployeeRecommendation) => {
    setBusyId(r.resourceId); setError(null);
    smartAssignmentApi.assign(task.id, [{ resourceType: r.resourceType, resourceId: r.resourceId, suitabilityScore: r.suitabilityScore, reason: (r.reasons || []).join("; ") }], "AUTO")
      .then(onAssigned)
      .catch(e => setError(e?.message || "Assignment failed"))
      .finally(() => setBusyId(null));
  };

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
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
                <p className="text-xs text-slate-500 truncate">
                  {r.designation || "—"} · {r.tasksToday} today · {r.remainingHours}h free
                </p>
              </div>
              <div className="flex flex-col items-center px-1">
                <span className={`text-sm font-bold ${r.suitabilityScore >= 85 ? "text-emerald-600" : r.suitabilityScore >= 70 ? "text-emerald-600" : r.suitabilityScore >= 55 ? "text-amber-600" : "text-rose-600"}`}>{Math.round(r.suitabilityScore)}</span>
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

// ============================================================ Employees tab

function EmployeesTab({ roster, board, isAdmin, onChanged }: {
  roster: RosterRow[]; board: TaskBoardRow[]; isAdmin: boolean; onChanged: () => void;
}) {
  const [search, setSearch] = useState("");
  const [assignTo, setAssignTo] = useState<RosterRow | null>(null);

  const rows = useMemo(() => roster.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.employeeCode || "").toLowerCase().includes(search.toLowerCase())
  ), [roster, search]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative w-full max-w-xs">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input placeholder="Search employees…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
      </div>
      <div className="border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[760px]">
            <thead>
              <tr className="bg-slate-50 border-b text-xs text-slate-500">
                <th className="p-3 font-semibold">Employee</th>
                <th className="p-3 font-semibold">Assigned now</th>
                <th className="p-3 font-semibold">Completed (24h)</th>
                <th className="p-3 font-semibold">Working now</th>
                <th className="p-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400">No employees.</td></tr>}
              {rows.map(r => (
                <tr key={r.employeeId} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="p-3">
                    <div className="font-semibold text-slate-800">{r.name}</div>
                    <div className="text-xs text-slate-400">{r.employeeCode || `#${r.employeeId}`}{r.designation ? ` · ${r.designation}` : ""}</div>
                  </td>
                  <td className="p-3">
                    <span className={`font-bold ${r.atCapacity ? "text-red-600" : "text-slate-700"}`}>{r.tasksAssignedNow}</span>
                    {r.maxTasksPerDay > 0 && <span className="text-xs text-slate-400"> / {r.maxTasksPerDay}</span>}
                    {r.atCapacity && <span className="ml-2 text-[10px] font-bold uppercase text-red-600">at capacity</span>}
                  </td>
                  <td className="p-3 text-slate-700 font-medium">{r.completedLast24h}</td>
                  <td className="p-3">
                    {r.onLeave
                      ? <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600"><Circle className="w-2.5 h-2.5 fill-amber-500 text-amber-500" /> On leave</span>
                      : r.workingNow
                        ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600"><Circle className="w-2.5 h-2.5 fill-emerald-500 text-emerald-500" /> Working</span>
                        : <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400"><Circle className="w-2.5 h-2.5 fill-slate-300 text-slate-300" /> Off</span>}
                  </td>
                  <td className="p-3 text-right">
                    {isAdmin
                      ? <Button size="sm" variant="outline" className="h-8" disabled={!r.assignable} onClick={() => setAssignTo(r)}>Assign task</Button>
                      : <span className="text-xs text-slate-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {!isAdmin && <p className="text-xs text-slate-400">Only admins can assign tasks beyond an employee's capacity.</p>}

      {assignTo && (
        <AssignTaskToEmployeeDialog employee={assignTo} board={board} onClose={() => setAssignTo(null)} onAssigned={() => { setAssignTo(null); onChanged(); }} />
      )}
    </div>
  );
}

// ---- Admin: assign ANY task to an employee, overriding capacity ----

function AssignTaskToEmployeeDialog({ employee, board, onClose, onAssigned }: {
  employee: RosterRow; board: TaskBoardRow[]; onClose: () => void; onAssigned: () => void;
}) {
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Open tasks only (a completed task is not worth assigning).
  const open = useMemo(() => board.filter(t =>
    t.bucket !== "COMPLETED" &&
    t.taskName.toLowerCase().includes(search.toLowerCase())
  ), [board, search]);

  const assign = (t: TaskBoardRow) => {
    if (employee.resourceId == null) return;
    setBusyId(t.id); setError(null);
    smartAssignmentApi.assign(t.id, [{ resourceType: "EMPLOYEE", resourceId: employee.resourceId, reason: "Manual admin assignment (capacity override)" }], "MANUAL")
      .then(onAssigned)
      .catch(e => setError(e?.message || "Assignment failed"))
      .finally(() => setBusyId(null));
  };

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Assign a task to {employee.name}</DialogTitle></DialogHeader>
        {employee.atCapacity && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            ⚠ {employee.name} is already at capacity ({employee.tasksAssignedNow}/{employee.maxTasksPerDay}). Admin override will assign anyway.
          </div>
        )}
        {error && <div className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search tasks…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" autoFocus />
        </div>
        <div className="space-y-1.5 max-h-[50vh] overflow-y-auto py-1">
          {open.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No open tasks match.</p>}
          {open.slice(0, 50).map(t => (
            <div key={t.id} className="flex items-center gap-3 rounded-lg border p-2.5">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-800 truncate text-sm">{t.taskName}</p>
                <p className="text-xs text-slate-400 truncate">{t.project || "No project"} · {t.status?.replace(/_/g, " ")}</p>
              </div>
              <Button size="sm" onClick={() => assign(t)} disabled={busyId != null}>{busyId === t.id ? "…" : "Assign"}</Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================ Admin extra tabs

function ApprovalsTab() {
  const [rows, setRows] = useState<TimeLogSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true);
    employeeTaskApi.pendingTime().then(setRows).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);
  const act = (p: Promise<any>) => p.then(load).catch(() => alert("Action failed"));

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold"><Timer className="h-4 w-4" /> Time Awaiting Approval</h3>
      {loading ? <p className="py-6 text-center text-muted-foreground">Loading…</p>
        : rows.length === 0 ? <p className="py-6 text-center text-muted-foreground">Nothing pending.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2 pr-3">Employee</th><th className="py-2 pr-3">Task</th><th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Hours</th><th className="py-2 pr-3 text-right">Decide</th></tr></thead>
              <tbody>
                {rows.map(l => (
                  <tr key={l.id} className="border-b last:border-0 hover:bg-accent/30">
                    <td className="py-2 pr-3 font-medium">{l.employeeName}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{l.taskName}</td>
                    <td className="py-2 pr-3">{l.workDate}</td>
                    <td className="py-2 pr-3">{Math.floor(l.workingTimeMinutes / 60)}h {l.workingTimeMinutes % 60}m</td>
                    <td className="py-2 pr-3">
                      <div className="flex justify-end gap-1">
                        <button title="Approve" onClick={() => act(employeeTaskApi.approveTime(l.id))} className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50"><Check className="h-4 w-4" /></button>
                        <button title="Reject" onClick={() => { const r = window.prompt("Reason for rejecting?") ?? undefined; act(employeeTaskApi.rejectTime(l.id, r)); }} className="rounded p-1.5 text-destructive hover:bg-destructive/10"><X className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}

function RiskTab({ navigate }: { navigate: (to: string) => void }) {
  const [ov, setOv] = useState<ConsoleOverview | null>(null);
  useEffect(() => { workflowApi.consoleOverview().then(setOv).catch(() => setOv(null)); }, []);
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold"><TriangleAlert className="h-4 w-4 text-red-600" /> Projects at Risk</h3>
      {!ov ? <p className="py-6 text-center text-muted-foreground">Loading…</p>
        : ov.projectsAtRisk.length === 0 ? <p className="py-6 text-center text-muted-foreground">No projects at risk. 🎉</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2 pr-3">Project</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Progress</th><th className="py-2 pr-3">End date</th><th className="py-2 pr-3">Overdue tasks</th></tr></thead>
              <tbody>
                {ov.projectsAtRisk.map(p => (
                  <tr key={p.projectId} className="border-b last:border-0 hover:bg-accent/30 cursor-pointer" onClick={() => navigate(`/projects/${p.projectId}`)}>
                    <td className="py-2 pr-3 font-medium">{p.projectName}</td>
                    <td className="py-2 pr-3">{p.status}</td>
                    <td className="py-2 pr-3">{p.progress ?? 0}%</td>
                    <td className="py-2 pr-3">{p.endDate ?? "—"}</td>
                    <td className="py-2 pr-3 font-semibold text-red-600">{p.overdueTasks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}

function TemplatesTab() {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  useEffect(() => { workflowApi.templates().then(setTemplates).catch(() => setTemplates([])); }, []);
  return (
    <div className="flex flex-col gap-4">
      {templates.length === 0 && <p className="py-6 text-center text-muted-foreground">No workflow templates.</p>}
      {templates.map(tpl => (
        <div key={tpl.id} className="rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <GitBranch className="h-4 w-4 text-primary" /> {tpl.name}
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-normal text-muted-foreground">{tpl.scope}</span>
            {!tpl.active && <span className="text-[11px] text-red-600">inactive</span>}
          </h3>
          <div className="mt-2 flex flex-col gap-2">
            {tpl.phases.map(ph => (
              <div key={ph.id} className="rounded-lg border bg-background p-2">
                <p className="text-xs font-semibold text-muted-foreground">{ph.orderIndex}. {ph.name}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {ph.tasks.map(tk => (
                    <span key={tk.id} title={`${tk.assignmentType} · ${tk.completionRule}${tk.dependsOn.length ? ` · after ${tk.dependsOn.join(", ")}` : ""}`} className="rounded-full border px-2 py-0.5 text-[11px]">
                      {tk.name}{tk.eligibleRoles ? ` · ${tk.eligibleRoles}` : ""}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================ bits

function StatTile({ icon: Icon, tone, label, value }: { icon: any; tone: string; label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card p-3 shadow-sm">
      <Icon className={`h-5 w-5 ${tone}`} />
      <p className="mt-1 text-2xl font-bold leading-none">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

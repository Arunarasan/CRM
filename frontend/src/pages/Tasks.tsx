import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { format } from "date-fns";
import {
  Plus, Search, RefreshCw, Zap, Users, CheckCircle2, Inbox, ListChecks,
  AlertTriangle, TriangleAlert, Timer, Check, X, GitBranch, UserCheck, Circle,
  FolderKanban, Target, ExternalLink, PackageCheck, User, MapPin, Wrench,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { BUNDLE_STATUS_LABELS } from "@/api/bundleApi";
import {
  smartAssignmentApi, TaskBoardRow, TaskBucket, TaskCategory, RosterRow, EmployeeTasksPage,
} from "@/api/smartAssignmentApi";
import { EmployeeRecommendation } from "@/types/assignment";
import { workflowApi, ConsoleOverview, WorkflowTemplate } from "@/api/workflowApi";
import { employeeTaskApi } from "@/api/employeeTaskApi";
import { TimeLogSummary } from "@/types/employeeTask";
import LeadManagerCheck from "@/components/tasks/LeadManagerCheck";
import { leadApi } from "@/pages/leads/leadApi";
import ResourceSelect, { ResourceSelection } from "@/components/workforce/ResourceSelect";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AttendanceAdmin } from "@/pages/hr/HrAttendancePage";
import CallRecordingsTab from "@/components/callRecordings/CallRecordingsTab";
import CallLeadPanel from "@/components/callRecordings/CallLeadPanel";
import { callRecordingApi, type CallRecording } from "@/api/callRecordingApi";

// ============================================================ shared helpers

const priorityColor = (p?: string | null) => {
  switch ((p || "").toUpperCase()) {
    case "HIGH": case "URGENT": case "CRITICAL": return "text-red-700 bg-red-100 border-red-200";
    case "MEDIUM": return "text-orange-700 bg-orange-100 border-orange-200";
    case "LOW": return "text-emerald-700 bg-emerald-100 border-emerald-200";
    default: return "text-gray-700 bg-gray-100 border-gray-200";
  }
};

/**
 * Live countdown for a held data-entry task on the board: ticks down to the moment it auto-releases
 * back to the pool if the assignee hasn't started it. Red in the last two minutes, where a manager
 * can grant more time (the worker's still on it) with a one-click Extend.
 */
function HoldTimer({ expiresAt, onExtend }: { expiresAt: string; onExtend?: () => void | Promise<unknown> }) {
  const [now, setNow] = useState(() => Date.now());
  const [extending, setExtending] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const msLeft = new Date(expiresAt).getTime() - now;
  const expired = msLeft <= 0;
  const totalSec = Math.max(0, Math.floor(msLeft / 1000));
  const label = totalSec >= 3600
    ? `${Math.floor(totalSec / 3600)}h ${Math.floor((totalSec % 3600) / 60)}m`
    : `${Math.floor(totalSec / 60)}:${(totalSec % 60).toString().padStart(2, "0")}`;
  const urgent = expired || msLeft <= 120_000;
  const cls = urgent ? "bg-red-100 text-red-700 border-red-200" : "bg-amber-100 text-amber-700 border-amber-200";

  const extend = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onExtend || extending) return;
    setExtending(true);
    try { await onExtend(); } finally { setExtending(false); }
  };

  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold ${cls}`}>
        <Timer className="h-3 w-3" />
        {expired ? "Releasing…" : `${label} to start`}
      </span>
      {urgent && !expired && onExtend && (
        <button onClick={extend} disabled={extending}
          className="rounded border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
          {extending ? "…" : "Extend"}
        </button>
      )}
    </span>
  );
}

const BUCKETS: { id: TaskBucket | "ALL"; label: string }[] = [
  { id: "ALL", label: "All" },
  { id: "UNASSIGNED", label: "Unassigned" },
  { id: "ASSIGNED", label: "Assigned" },
  { id: "IN_PROGRESS", label: "In Progress" },
  { id: "NEEDS_APPROVAL", label: "Need Approval" },
  { id: "COMPLETED", label: "Completed (30d)" },
];

// The three buckets whose tasks can still take a (re)assignment inline via Smart Assign.
const ASSIGNABLE_BUCKETS: TaskBucket[] = ["UNASSIGNED", "ASSIGNED", "IN_PROGRESS"];

// Task "type" lanes — where a task came from. Keeps the flat queue human-readable: lead-stage
// workflow, project work, on-site field work, walk-in installs, service requests, ad-hoc.
const CATEGORIES: { id: TaskCategory; label: string; hint: string; badge: string }[] = [
  { id: "LEAD",         label: "Lead",         hint: "Requirement · Site Visit · BOQ · Quotation", badge: "bg-violet-100 text-violet-700 border-violet-200" },
  { id: "PROJECT",      label: "Project",      hint: "Main project tasks & rework",                 badge: "bg-blue-100 text-blue-700 border-blue-200" },
  { id: "FIELD_WORK",   label: "Field Work",   hint: "On-site execution from the BOQ",              badge: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { id: "STITCHING",    label: "Stitching",    hint: "Stickered stitching / making bundles",        badge: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  { id: "INSTALLATION", label: "Installation", hint: "Walk-in / counter-sale installs",             badge: "bg-amber-100 text-amber-700 border-amber-200" },
  { id: "ENQUIRY",      label: "Enquiry",      hint: "Website enquiries & customer service requests", badge: "bg-rose-100 text-rose-700 border-rose-200" },
  { id: "CALL",         label: "Call Follow-up", hint: "Uploaded call recordings to turn into leads",   badge: "bg-sky-100 text-sky-700 border-sky-200" },
  { id: "OTHER",        label: "Other",        hint: "Ad-hoc / manually created",                   badge: "bg-slate-100 text-slate-600 border-slate-200" },
];
const CATEGORY_BADGE: Record<string, string> = Object.fromEntries(CATEGORIES.map(c => [c.id, c.badge]));

type MainTab = "tasks" | "employees" | "calls" | "attendance" | "approvals" | "cancels" | "risk" | "templates";

// ============================================================ page

// The board shows open work plus tasks finished in this many days; an employee's full history is in their dialog.
const BOARD_COMPLETED_DAYS = 30;

export default function Tasks() {
  const { isAdmin, hasAnyAuthority } = useAuth();
  const canManageCalls = hasAnyAuthority(["TASK_ASSIGN"]);
  const navigate = useNavigate();

  const [tab, setTab] = useState<MainTab>(() => {
    const q = new URLSearchParams(window.location.search).get("tab");
    return q === "cancels" ? "cancels" : "tasks";
  });
  const [cancelCount, setCancelCount] = useState(0);
  useEffect(() => {
    if (!isAdmin) return;
    api.get("/task-cancel-requests/pending").then(r => setCancelCount((r.data?.data ?? r.data ?? []).length)).catch(() => {});
  }, [isAdmin, tab]);
  const [taskBucket, setTaskBucket] = useState<TaskBucket | "ALL">("ALL"); // Tasks-tab status filter, driven by the stat tiles
  const [board, setBoard] = useState<TaskBoardRow[]>([]);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const boardDirty = useRef(false);
  const [loading, setLoading] = useState(false);

  const loadBoard = useCallback(() => {
    setLoading(true);
    boardDirty.current = false;
    Promise.all([
      smartAssignmentApi.taskBoard(BOARD_COMPLETED_DAYS).catch(() => [] as TaskBoardRow[]),
      smartAssignmentApi.roster().catch(() => [] as RosterRow[]),
    ]).then(([b, r]) => {
      setBoard(b);
      setRoster(r);
    }).finally(() => setLoading(false));
  }, []);

  // The Employees tab only needs the roster counts — a move there must not reload every task.
  // The board is refreshed the next time the Tasks tab is opened instead.
  const loadRoster = useCallback(() => {
    boardDirty.current = true;
    smartAssignmentApi.roster().then(setRoster).catch(() => {});
  }, []);
  useEffect(() => { if (tab === "tasks" && boardDirty.current) loadBoard(); }, [tab, loadBoard]);

  useEffect(() => { loadBoard(); }, [loadBoard]);

  // --- edit / create dialog ---
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentTask, setCurrentTask] = useState<any>({});
  const [assignments, setAssignments] = useState<any[]>([]);
  const [checklists, setChecklists] = useState<any[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [applyingChecklist, setApplyingChecklist] = useState(false);
  const [assignPick, setAssignPick] = useState<ResourceSelection | null>(null);
  const [pickAsManager, setPickAsManager] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [taskCall, setTaskCall] = useState<CallRecording | null>(null);

  const openTask = (id: number) => {
    // The task's full record is fetched when it is opened — not for every task on page load.
    setCurrentTask({ id });
    api.get(`/tasks/${id}`).then(r => setCurrentTask((cur: any) => (cur?.id === id ? { ...(r.data?.task ?? r.data) } : cur))).catch(() => {});
    setAssignments([]); setAssignPick(null); setChecklists([]); setNewChecklistItem("");
    setIsDialogOpen(true);
    loadAssignments(id); loadChecklist(id);
    setTaskCall(null);
    callRecordingApi.forTask(id).then(setTaskCall).catch(() => {});
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
      .then(async () => {
        if (pickAsManager && currentTask.leadId && assignPick.resourceType === "EMPLOYEE") await leadApi.setLeadManager(currentTask.leadId, assignPick.resourceId);
        setAssignPick(null); setPickAsManager(false); loadAssignments(currentTask.id); loadBoard();
      })
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
  const deleteTask = () => {
    if (!currentTask.id) return;
    if (!window.confirm(`Delete "${currentTask.taskName || "this task"}"? It disappears for everyone it is assigned to.`)) return;
    api.delete(`/tasks/${currentTask.id}`)
      .then(() => { toast.success("Task deleted"); setIsDialogOpen(false); setCurrentTask({}); loadBoard(); })
      .catch((e) => toast.error(e?.response?.data?.message || "Could not delete the task"));
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
    { id: "calls", label: "Call Recordings", admin: !canManageCalls },
    { id: "attendance", label: "Attendance", admin: true },
    { id: "approvals", label: "Time Approvals", admin: true },
    { id: "cancels", label: "Cancel Requests", admin: true, badge: cancelCount },
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

      {/* Stat tiles — click to filter the task list (or jump to Employees) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {([
          { icon: Inbox, tone: "text-amber-600", label: "Unassigned", value: counts.UNASSIGNED, bucket: "UNASSIGNED" as const },
          { icon: UserCheck, tone: "text-primary", label: "Assigned", value: counts.ASSIGNED, bucket: "ASSIGNED" as const },
          { icon: ListChecks, tone: "text-emerald-600", label: "In Progress", value: counts.IN_PROGRESS, bucket: "IN_PROGRESS" as const },
          { icon: AlertTriangle, tone: "text-orange-600", label: "Need Approval", value: counts.NEEDS_APPROVAL, bucket: "NEEDS_APPROVAL" as const },
          { icon: CheckCircle2, tone: "text-emerald-600", label: `Completed · ${BOARD_COMPLETED_DAYS}d`, value: counts.COMPLETED, bucket: "COMPLETED" as const },
        ]).map(({ icon, tone, label, value, bucket }) => (
          <StatTile
            key={label} icon={icon} tone={tone} label={label} value={value}
            active={tab === "tasks" && taskBucket === bucket}
            onClick={() => { setTab("tasks"); setTaskBucket(taskBucket === bucket && tab === "tasks" ? "ALL" : bucket); }}
          />
        ))}
        <StatTile
          icon={Users} tone="text-slate-700" label="Employees" value={roster.length}
          active={tab === "employees"}
          onClick={() => setTab("employees")}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b">
        {visibleTabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-slate-700"}`}>
            {t.label}
            {!!t.badge && <span className="ml-1.5 rounded-full bg-red-600 px-1.5 text-[10px] text-white">{t.badge}</span>}
          </button>
        ))}
      </div>

      {tab === "tasks" && <TasksTab board={board} counts={counts} filter={taskBucket} onFilterChange={setTaskBucket} onEdit={openTask} onChanged={loadBoard} navigate={navigate} />}
      {tab === "employees" && <EmployeesTab roster={roster} board={board} isAdmin={isAdmin} onChanged={loadRoster} />}
      {tab === "calls" && (isAdmin || canManageCalls) && <CallRecordingsTab onOpenTask={openTask} onTasksChanged={loadBoard} />}
      {tab === "attendance" && isAdmin && <AttendanceAdmin />}
      {tab === "approvals" && isAdmin && <ApprovalsTab />}
      {tab === "cancels" && isAdmin && <CancelRequestsTab onChanged={loadBoard} />}
      {tab === "risk" && isAdmin && <RiskTab navigate={navigate} />}
      {tab === "templates" && isAdmin && <TemplatesTab />}

      {/* ---- Create / edit task dialog ---- */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{currentTask.id ? "Edit Task" : "Create Task"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-2">
            {(currentTask.project?.id || currentTask.leadId) && (
              <div className="flex flex-wrap gap-2">
                {currentTask.project?.id && (
                  <button type="button" onClick={() => navigate(`/projects/${currentTask.project.id}`)}
                    className="inline-flex items-center gap-1.5 rounded-lg border bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100">
                    <FolderKanban className="h-3.5 w-3.5" /> {currentTask.project.projectName || "Open project"} <ExternalLink className="h-3 w-3" />
                  </button>
                )}
                {currentTask.leadId && (
                  <button type="button" onClick={() => navigate(`/leads/${currentTask.leadId}`)}
                    className="inline-flex items-center gap-1.5 rounded-lg border bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100">
                    <Target className="h-3.5 w-3.5" /> Open lead <ExternalLink className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
            {taskCall && (
              <CallLeadPanel call={taskCall} canOpenLead onChanged={(c) => {
                setTaskCall(c);
                // Closing the call completed the task server-side — keep the open form in step so a
                // later "Save Task" doesn't send the old status back.
                if (c.outcome) setCurrentTask((t: any) => ({ ...t, status: "COMPLETED", leadId: c.lead?.id ?? t.leadId }));
                loadBoard();
              }} />
            )}
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
                {currentTask.leadId && assignPick?.resourceType === "EMPLOYEE" && <LeadManagerCheck checked={pickAsManager} onChange={setPickAsManager} />}
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
            {currentTask.id && isAdmin && (
              <Button onClick={deleteTask} variant="outline" className="w-full border-destructive/40 text-destructive hover:bg-destructive/10">Delete Task</Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================ Tasks tab

function TasksTab({ board, counts, filter, onFilterChange, onEdit, onChanged, navigate }: {
  board: TaskBoardRow[]; counts: Record<string, number>;
  filter: TaskBucket | "ALL"; onFilterChange: (b: TaskBucket | "ALL") => void;
  onEdit: (id: number) => void; onChanged: () => void; navigate: (to: string) => void;
}) {
  const setFilter = onFilterChange;
  const [cat, setCat] = useState<TaskCategory | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [assignFor, setAssignFor] = useState<TaskBoardRow | null>(null);

  // Category counts respect the active status bucket, so the type lane numbers match what you'd see.
  const catCounts = useMemo(() => {
    const c: Record<string, number> = {};
    board.forEach(t => {
      if (filter !== "ALL" && t.bucket !== filter) return;
      c[t.category] = (c[t.category] || 0) + 1;
    });
    return c;
  }, [board, filter]);

  const rows = useMemo(() => board.filter(t =>
    (filter === "ALL" || t.bucket === filter) &&
    (cat === "ALL" || t.category === cat) &&
    t.taskName.toLowerCase().includes(search.toLowerCase())
  ), [board, filter, cat, search]);

  return (
    <div className="flex flex-col gap-3">
      {/* Type lanes — where each task came from */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 mr-0.5">Type</span>
        <button onClick={() => setCat("ALL")}
          className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${cat === "ALL" ? "border-primary bg-primary text-primary-foreground" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
          All types <span className={`ml-1 ${cat === "ALL" ? "opacity-80" : "text-slate-400"}`}>{Object.values(catCounts).reduce((a, b) => a + b, 0)}</span>
        </button>
        {CATEGORIES.map(c => {
          const n = catCounts[c.id] || 0;
          const active = cat === c.id;
          return (
            <button key={c.id} onClick={() => setCat(active ? "ALL" : c.id)} title={c.hint}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : `${c.badge} hover:brightness-95`}`}>
              {c.label} <span className={`ml-1 ${active ? "opacity-80" : "opacity-60"}`}>{n}</span>
            </button>
          );
        })}
      </div>

      {/* Status chips + search */}
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
                <th className="p-3 font-semibold">Project / Lead</th>
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
                  <td className="p-3 cursor-pointer" onClick={() => onEdit(t.id)}>
                    <div className="font-semibold text-slate-800">{t.taskName}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${CATEGORY_BADGE[t.category] || "bg-slate-100 text-slate-600 border-slate-200"}`}>{t.categoryLabel}</span>
                      {t.holdExpiresAt && (
                        <HoldTimer expiresAt={t.holdExpiresAt}
                          onExtend={() => smartAssignmentApi.extendTaskHold(t.id).then(onChanged)} />
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-slate-500">
                    <div className="flex flex-col gap-0.5">
                      {t.projectId ? (
                        <button className="flex items-center gap-1 text-left hover:underline" onClick={() => navigate(`/projects/${t.projectId}`)}>
                          <FolderKanban className="h-3 w-3 text-blue-500 shrink-0" /> {t.project}
                        </button>
                      ) : t.project ? <span>{t.project}</span> : null}
                      {t.leadId && (
                        <button className="flex items-center gap-1 text-left hover:underline" onClick={() => navigate(`/leads/${t.leadId}`)}>
                          <Target className="h-3 w-3 text-violet-500 shrink-0" /> {t.lead || `Lead #${t.leadId}`}
                        </button>
                      )}
                      {t.bundleId && (
                        <button className="flex items-center gap-1 text-left hover:underline" onClick={() => navigate(`/bundles/${t.bundleId}`)}>
                          <PackageCheck className="h-3 w-3 text-indigo-500 shrink-0" />
                          <span className="font-mono">{t.bundleCode}</span>
                          {t.bundleStatus && <span className="text-[11px] text-slate-400">· {BUNDLE_STATUS_LABELS[t.bundleStatus] ?? t.bundleStatus}</span>}
                        </button>
                      )}
                      {!t.projectId && !t.project && !t.leadId && !t.bundleId && "—"}
                    </div>
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
  const [asManager, setAsManager] = useState(false);

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
      .then(async () => { if (asManager && task.leadId && r.resourceType === "EMPLOYEE") await leadApi.setLeadManager(task.leadId, r.resourceId); })
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
        {task.leadId && <LeadManagerCheck checked={asManager} onChange={setAsManager} />}
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
  const [viewing, setViewing] = useState<RosterRow | null>(null);

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
                <tr key={r.employeeId} className="border-b last:border-0 hover:bg-slate-50 cursor-pointer" onClick={() => setViewing(r)}>
                  <td className="p-3">
                    <div className="font-semibold text-emerald-800 hover:underline">{r.name}</div>
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
                  <td className="p-3 text-right" onClick={e => e.stopPropagation()}>
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

      {viewing && (
        <EmployeeTasksDialog employee={viewing} roster={roster} isAdmin={isAdmin}
          onClose={() => setViewing(null)} onChanged={onChanged} />
      )}
      {assignTo && (
        <AssignTaskToEmployeeDialog employee={assignTo} board={board} onClose={() => setAssignTo(null)} onAssigned={() => { setAssignTo(null); onChanged(); }} />
      )}
    </div>
  );
}

// ---- One employee's tasks (Assigned | Completed): filter by type, search, page, move one or many ----

const PAGE_SIZE = 20;
const isOverdue = (d?: string | null) => !!d && new Date(d).getTime() < new Date(new Date().toDateString()).getTime();

function EmployeeTasksDialog({ employee, roster, isAdmin, onClose, onChanged }: {
  employee: RosterRow; roster: RosterRow[]; isAdmin: boolean;
  onClose: () => void; onChanged: () => void;
}) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"assigned" | "completed">("assigned");
  const [cat, setCat] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState(""); // the search text actually sent to the server (debounced)
  const [sort, setSort] = useState<"due" | "priority" | "name">("due");
  const [page, setPage] = useState(0);
  const [picked, setPicked] = useState<Map<number, TaskBoardRow>>(new Map());
  const [moving, setMoving] = useState<TaskBoardRow[] | null>(null);
  const [pickSearch, setPickSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<EmployeeTasksPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const h = setTimeout(() => { setQ(search.trim()); setPage(0); }, 350);
    return () => clearTimeout(h);
  }, [search]);

  // Only this one employee's tasks, one page at a time — nothing else on the board is loaded for this dialog.
  useEffect(() => {
    if (employee.resourceId == null) { setLoading(false); return; }
    let alive = true;
    setLoading(true);
    smartAssignmentApi.employeeTasks(employee.resourceId, {
      scope: tab, category: cat === "ALL" ? undefined : cat, q: q || undefined, sort, page, size: PAGE_SIZE,
    })
      .then(d => { if (alive) setData(d); })
      .catch(() => { if (alive) toast.error("Could not load the tasks"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [employee.resourceId, tab, cat, q, sort, page, reloadKey]);

  const rows = data?.content ?? [];
  const total = data?.total ?? 0;
  const catCounts = data?.categoryCounts ?? {};
  const assignedTotal = data?.assignedTotal ?? 0;
  const completedTotal = data?.completedTotal ?? 0;
  const scopeTotal = tab === "assigned" ? assignedTotal : completedTotal;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const cur = Math.min(page, pages - 1);
  const canMove = isAdmin && tab === "assigned";
  const allOnPage = rows.length > 0 && rows.every(t => picked.has(t.id));
  const filtered = !!q || cat !== "ALL";

  const reset = () => setPage(0);
  const toggle = (t: TaskBoardRow) => setPicked(p => { const n = new Map(p); if (n.has(t.id)) n.delete(t.id); else n.set(t.id, t); return n; });
  const togglePage = () => setPicked(p => {
    const n = new Map(p);
    rows.forEach(t => { if (allOnPage) n.delete(t.id); else n.set(t.id, t); });
    return n;
  });

  const targets = useMemo(() => roster.filter(r =>
    r.employeeId !== employee.employeeId && r.assignable && r.resourceId != null &&
    (r.name.toLowerCase().includes(pickSearch.toLowerCase()) || (r.employeeCode || "").toLowerCase().includes(pickSearch.toLowerCase()))
  ).sort((a, b) => Number(a.onLeave) - Number(b.onLeave) || a.tasksAssignedNow - b.tasksAssignedNow), [roster, employee.employeeId, pickSearch]);

  const move = async (to: RosterRow) => {
    if (!moving || employee.resourceId == null || to.resourceId == null) return;
    setBusy(true);
    let ok = 0; const failed: string[] = [];
    for (const t of moving) {
      try {
        await smartAssignmentApi.replace({
          taskId: t.id, oldResourceId: employee.resourceId, oldResourceType: "EMPLOYEE",
          reason: `Moved from ${employee.name} to ${to.name} (admin)`,
          replacement: { resourceType: "EMPLOYEE", resourceId: to.resourceId, reason: "Manual admin reassignment" },
        });
        ok++;
      } catch { failed.push(t.taskName); }
    }
    setBusy(false);
    if (ok) toast.success(ok === 1 ? `"${moving[0].taskName}" moved to ${to.name}` : `${ok} tasks moved to ${to.name}`);
    if (failed.length) toast.error(`Could not move: ${failed.slice(0, 3).join(", ")}${failed.length > 3 ? ` +${failed.length - 3} more` : ""}`);
    setMoving(null); setPicked(new Map()); setReloadKey(k => k + 1); onChanged();
  };

  const openHref = (t: TaskBoardRow) => t.projectId ? `/projects/${t.projectId}` : t.leadId ? `/leads/${t.leadId}` : null;

  const tabBtn = (k: "assigned" | "completed", label: string, n: number) => (
    <button type="button" onClick={() => { setTab(k); setCat("ALL"); setSearch(""); setQ(""); setMoving(null); setPicked(new Map()); reset(); }}
      className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${tab === k ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-600"}`}>
      {label} ({n})
    </button>
  );
  const chip = (id: string, label: string, n: number) => (
    <button key={id} type="button" onClick={() => { setCat(id); reset(); }}
      className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${cat === id ? "bg-emerald-700 text-white border-emerald-700" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
      {label} <span className="opacity-70">{n}</span>
    </button>
  );

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-5xl w-[96vw] h-[88vh] flex flex-col gap-3 p-4 sm:p-5">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {employee.name}'s tasks
            <span className="text-xs font-normal text-slate-400">
              {employee.employeeCode || `#${employee.employeeId}`}{employee.designation ? ` · ${employee.designation}` : ""}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          {tabBtn("assigned", "Assigned", assignedTotal)}
          {tabBtn("completed", "Completed", completedTotal)}
        </div>

        {moving ? (
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-sm text-slate-600">
                Move {moving.length === 1 ? <b>{moving[0].taskName}</b> : <b>{moving.length} tasks</b>} to…
              </p>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setMoving(null)}>Back</Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input placeholder="Search employees…" value={pickSearch} onChange={e => setPickSearch(e.target.value)} className="pl-9" autoFocus />
            </div>
            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
              {targets.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No employees match.</p>}
              {targets.map(r => (
                <div key={r.employeeId} className="flex items-center gap-3 rounded-lg border p-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{r.name}</p>
                    <p className="truncate text-xs text-slate-400">
                      {r.employeeCode || `#${r.employeeId}`} · {r.tasksAssignedNow}{r.maxTasksPerDay > 0 ? ` / ${r.maxTasksPerDay}` : ""} tasks
                      {r.onLeave ? " · On leave" : r.atCapacity ? " · At capacity" : r.workingNow ? " · Working" : ""}
                    </p>
                  </div>
                  <Button size="sm" disabled={busy} onClick={() => move(r)}>{busy ? "Moving…" : "Move here"}</Button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input placeholder="Search task, project, lead or order…" value={search}
                  onChange={e => setSearch(e.target.value)} className="h-9 pl-9" />
              </div>
              <select value={sort} onChange={e => { setSort(e.target.value as typeof sort); reset(); }}
                className="h-9 rounded-md border bg-white px-2 text-sm text-slate-700">
                <option value="due">Sort: Due date</option>
                <option value="priority">Sort: Priority</option>
                <option value="name">Sort: Name</option>
              </select>
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {chip("ALL", "All", scopeTotal)}
              {CATEGORIES.filter(c => catCounts[c.id]).map(c => chip(c.id, c.label, catCounts[c.id]))}
            </div>

            {canMove && picked.size > 0 && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                <span className="text-sm font-medium text-emerald-800">{picked.size} selected</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setPicked(new Map())}>Clear</Button>
                  <Button size="sm" onClick={() => { setMoving([...picked.values()]); setPickSearch(""); }}>Move selected…</Button>
                </div>
              </div>
            )}

            <div className={`min-h-0 flex-1 overflow-y-auto rounded-lg border transition-opacity ${loading && data ? "opacity-50" : ""}`}>
              {canMove && rows.length > 0 && (
                <label className="sticky top-0 z-10 flex items-center gap-2 border-b bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-500">
                  <input type="checkbox" checked={allOnPage} onChange={togglePage} /> Select this page ({rows.length})
                </label>
              )}
              {rows.length === 0 && (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  {loading ? "Loading…" : !filtered && total === 0 ? (tab === "assigned" ? "No open tasks assigned." : "No completed tasks yet.") : "No tasks match these filters."}
                </p>
              )}
              {rows.map(t => {
                const href = openHref(t);
                const ref = t.project ? `Project: ${t.project}`
                  : t.lead ? `Lead: ${t.lead}`
                  : t.orderRef || t.bundleCode ? `Order: ${[t.orderRef, t.bundleCode].filter(Boolean).join(" · ")}`
                  : null;
                return (
                  <div key={t.id} className="flex items-center gap-3 border-b px-3 py-2 last:border-0 hover:bg-slate-50">
                    {canMove && <input type="checkbox" checked={picked.has(t.id)} onChange={() => toggle(t)} />}
                    <span className={`hidden shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide sm:inline-block ${CATEGORY_BADGE[t.category] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                      {t.categoryLabel || t.category}
                    </span>
                    <div className="min-w-0 flex-1">
                      {/* 1 customer (main) · 2 lead / project / order · 3 location · 4 task */}
                      <p className="flex items-center gap-1.5 truncate text-sm font-bold text-slate-900">
                        <User className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        {t.customerName || t.lead || t.project
                          ? <span className="truncate">{t.customerName || t.lead || t.project}</span>
                          : <span className="truncate font-medium italic text-slate-400">No customer</span>}
                      </p>
                      {ref && <p className="truncate text-xs font-medium text-emerald-800">
                        <span className="sm:hidden">{t.categoryLabel || t.category} · </span>{ref}
                      </p>}
                      {t.city && <p className="flex items-center gap-1 truncate text-xs text-slate-500"><MapPin className="h-3 w-3 shrink-0 text-slate-400" />{t.city}</p>}
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-700">
                        <Wrench className="h-3 w-3 shrink-0 text-slate-400" />
                        <span className="truncate font-medium">{t.taskName}{t.work ? ` — ${t.work}` : ""}</span>
                        <span className="shrink-0 text-slate-400">· {t.status?.replace(/_/g, " ")}</span>
                        {t.dueDate && <span className={`shrink-0 ${isOverdue(t.dueDate) && tab === "assigned" ? "font-semibold text-red-600" : "text-slate-400"}`}>{`· due ${format(new Date(t.dueDate), "d MMM")}`}</span>}
                      </p>
                    </div>
                    {t.priority && <span className={`hidden shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold sm:inline-block ${priorityColor(t.priority)}`}>{t.priority}</span>}
                    {href && (
                      <Button size="sm" variant="ghost" className="h-8 px-2" title="Open" onClick={() => navigate(href)}>
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                    {canMove && (
                      <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={() => { setMoving([t]); setPickSearch(""); }}>Change person</Button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
              <span>
                {total === 0 ? "0 tasks" : `${cur * PAGE_SIZE + 1}–${cur * PAGE_SIZE + rows.length} of ${total}`}
                {tab === "completed" && " · completed work stays with who did it"}
              </span>
              {pages > 1 && (
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="h-8" disabled={cur === 0} onClick={() => setPage(cur - 1)}>Prev</Button>
                  <span>Page {cur + 1} / {pages}</span>
                  <Button size="sm" variant="outline" className="h-8" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>Next</Button>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
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

function CancelRequestsTab({ onChanged }: { onChanged: () => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const load = useCallback(() => {
    setLoading(true);
    api.get("/task-cancel-requests/pending").then(r => setRows(r.data?.data ?? r.data ?? [])).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = (id: number, kind: "approve" | "reject") => {
    let body: any = undefined;
    if (kind === "reject") { const n = window.prompt("Reason for declining? (optional)"); if (n === null) return; body = { note: n }; }
    else if (!window.confirm("Approve? This will update the lead / project / task now.")) return;
    setBusy(id);
    api.post(`/task-cancel-requests/${id}/${kind}`, body)
      .then(() => { toast.success(kind === "approve" ? "Approved" : "Declined"); load(); onChanged(); })
      .catch(e => toast.error(e?.response?.data?.message || "Action failed"))
      .finally(() => setBusy(null));
  };

  const effect = (r: any) => r.targetType === "LEAD" ? `Lead "${r.leadName ?? "#" + r.leadId}" will be marked Lost`
    : r.targetType === "PROJECT" ? `Project "${r.projectName ?? "#" + r.projectId}" will be cancelled`
    : "Only this task will be cancelled";

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold"><AlertTriangle className="h-4 w-4 text-red-600" /> Cancel requests from employees</h3>
      {loading ? <p className="py-6 text-center text-muted-foreground">Loading…</p>
        : rows.length === 0 ? <p className="py-6 text-center text-muted-foreground">Nothing pending.</p> : (
          <div className="flex flex-col gap-3">
            {rows.map(r => (
              <div key={r.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800">{r.taskName}</p>
                    <p className="text-xs text-muted-foreground">{r.requesterName} · {r.reasonCode === "CUSTOMER_CANCELLED" ? "Customer cancelled" : "Other issue"}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" disabled={busy === r.id} onClick={() => act(r.id, "approve")}>Approve</Button>
                    <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => act(r.id, "reject")}>Decline</Button>
                  </div>
                </div>
                <p className="mt-2 text-sm text-slate-700">{r.reason}</p>
                <p className="mt-1 text-xs font-medium text-red-600">{effect(r)}</p>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

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

function StatTile({ icon: Icon, tone, label, value, onClick, active }: {
  icon: any; tone: string; label: string; value: number; onClick?: () => void; active?: boolean;
}) {
  const className = `rounded-xl border bg-card p-3 shadow-sm text-left w-full transition-all ${
    onClick ? "cursor-pointer hover:border-foreground/30 hover:shadow" : ""
  } ${active ? "ring-2 ring-primary" : ""}`;
  const body = (
    <>
      <Icon className={`h-5 w-5 ${tone}`} />
      <p className="mt-1 text-2xl font-bold leading-none">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </>
  );
  return onClick
    ? <button type="button" onClick={onClick} aria-pressed={active} className={className}>{body}</button>
    : <div className={className}>{body}</div>;
}

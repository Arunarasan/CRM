import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Clock, Ban, Inbox, ListChecks, CheckCircle2, Users, TriangleAlert,
  Timer, Check, X, CalendarClock, ArrowUpDown, Undo2, RefreshCw, GitBranch,
} from 'lucide-react';
import { workflowApi, ConsoleOverview, ConsoleTaskCard, WorkflowTemplate } from '@/api/workflowApi';
import { employeeTaskApi } from '@/api/employeeTaskApi';
import { TimeLogSummary } from '@/types/employeeTask';

const TABS = ['OVERVIEW', 'CAPACITY', 'RISK', 'TIME', 'TEMPLATES'] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = {
  OVERVIEW: 'Task Landscape', CAPACITY: 'Capacity', RISK: 'Projects at Risk', TIME: 'Time Approvals', TEMPLATES: 'Workflow Templates',
};

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'];

const COUNT_TILES: { key: string; label: string; icon: typeof Inbox; tone: string }[] = [
  { key: 'available', label: 'Available', icon: Inbox, tone: 'text-primary' },
  { key: 'inProgress', label: 'In Progress', icon: ListChecks, tone: 'text-emerald-600' },
  { key: 'blocked', label: 'Blocked', icon: Ban, tone: 'text-orange-600' },
  { key: 'overdue', label: 'Overdue', icon: AlertTriangle, tone: 'text-red-600' },
  { key: 'unassigned', label: 'Unassigned', icon: Clock, tone: 'text-amber-600' },
  { key: 'completedToday', label: 'Done Today', icon: CheckCircle2, tone: 'text-emerald-600' },
];

export default function WorkflowConsole() {
  const [tab, setTab] = useState<Tab>('OVERVIEW');
  const [ov, setOv] = useState<ConsoleOverview | null>(null);
  const [pendingTime, setPendingTime] = useState<TimeLogSummary[]>([]);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const load = useCallback(() => {
    workflowApi.consoleOverview().then(setOv).catch((e) => setError(e?.message || 'Failed to load'));
    employeeTaskApi.pendingTime().then(setPendingTime).catch(() => {});
    workflowApi.templates().then(setTemplates).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = (fn: () => Promise<unknown>) => fn().then(() => setError('')).catch((e: any) => setError(e?.message || 'Action failed')).finally(load);

  const extend = (t: ConsoleTaskCard) => {
    const d = window.prompt(`New due date for "${t.taskName}" (YYYY-MM-DD)`, t.dueDate ?? '');
    if (d) act(() => workflowApi.extendDueDate(t.id, d));
  };
  const setPriority = (t: ConsoleTaskCard) => {
    const idx = PRIORITIES.indexOf(t.priority);
    const next = PRIORITIES[(idx + 1) % PRIORITIES.length];
    act(() => workflowApi.changePriority(t.id, next));
  };
  const returnToPool = (t: ConsoleTaskCard) => { if (window.confirm(`Return "${t.taskName}" to the pool? Current assignees are released.`)) act(() => workflowApi.returnToPool(t.id)); };
  const cancel = (t: ConsoleTaskCard) => { if (window.confirm(`Cancel "${t.taskName}"?`)) act(() => workflowApi.cancelTask(t.id)); };

  const TaskTable = ({ rows }: { rows: ConsoleTaskCard[] }) => (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="py-2 pr-3">Task</th><th className="py-2 pr-3">Project</th><th className="py-2 pr-3">Status</th>
            <th className="py-2 pr-3">Priority</th><th className="py-2 pr-3">Due</th><th className="py-2 pr-3">Assignee</th>
            <th className="py-2 pr-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">Nothing here.</td></tr>
          ) : rows.map((t) => (
            <tr key={t.id} className="border-b last:border-0 hover:bg-accent/30">
              <td className="py-2 pr-3 font-medium">{t.taskName}</td>
              <td className="py-2 pr-3 text-muted-foreground">{t.projectId ? <button className="hover:underline" onClick={() => navigate(`/projects/${t.projectId}`)}>{t.project}</button> : (t.project ?? '—')}</td>
              <td className="py-2 pr-3"><span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{t.status.replace(/_/g, ' ')}</span></td>
              <td className="py-2 pr-3">{t.priority}</td>
              <td className="py-2 pr-3">{t.dueDate ?? '—'}</td>
              <td className="py-2 pr-3">{t.assignee ?? <span className="text-amber-600">unassigned</span>}</td>
              <td className="py-2 pr-3">
                <div className="flex justify-end gap-1">
                  <button title="Extend due date" onClick={() => extend(t)} className="rounded p-1.5 hover:bg-accent"><CalendarClock className="h-4 w-4" /></button>
                  <button title="Cycle priority" onClick={() => setPriority(t)} className="rounded p-1.5 hover:bg-accent"><ArrowUpDown className="h-4 w-4" /></button>
                  <button title="Return to pool" onClick={() => returnToPool(t)} className="rounded p-1.5 hover:bg-accent"><Undo2 className="h-4 w-4" /></button>
                  <button title="Cancel task" onClick={() => cancel(t)} className="rounded p-1.5 text-destructive hover:bg-destructive/10"><X className="h-4 w-4" /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const Section = ({ title, rows }: { title: string; rows: ConsoleTaskCard[] }) => (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <h3 className="mb-2 text-sm font-semibold">{title} <span className="text-muted-foreground">({rows.length})</span></h3>
      <TaskTable rows={rows} />
    </div>
  );

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Workflow Console</h1>
          <p className="text-sm text-muted-foreground">Monitor the task landscape and handle exceptions. Routine work stays self-service.</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-sm font-medium hover:bg-accent"><RefreshCw className="h-4 w-4" /> Refresh</button>
      </div>

      {error && <p className="rounded-md bg-destructive/15 p-2 text-sm text-destructive">{error}</p>}

      {/* Count tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {COUNT_TILES.map(({ key, label, icon: Icon, tone }) => (
          <div key={key} className="rounded-xl border bg-card p-3 shadow-sm">
            <Icon className={`h-5 w-5 ${tone}`} />
            <p className="mt-1 text-2xl font-bold leading-none">{ov?.counts?.[key] ?? '–'}</p>
            <p className="mt-1 text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto border-b">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`shrink-0 border-b-2 px-3 py-2 text-sm font-medium ${tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>
            {TAB_LABEL[t]}
            {t === 'TIME' && pendingTime.length > 0 && <span className="ml-1.5 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{pendingTime.length}</span>}
          </button>
        ))}
      </div>

      {tab === 'OVERVIEW' && ov && (
        <div className="flex flex-col gap-4">
          <Section title="Overdue" rows={ov.overdue} />
          <Section title="Blocked" rows={ov.blocked} />
          <Section title="Unassigned" rows={ov.unassigned} />
          <Section title="In Progress" rows={ov.inProgress} />
          <Section title="Available (pool)" rows={ov.available} />
        </div>
      )}

      {tab === 'CAPACITY' && ov && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Users className="h-4 w-4" /> Employee Capacity</h3>
          {ov.employeeCapacity.length === 0 ? <p className="py-6 text-center text-muted-foreground">No active workloads.</p> : (
            <div className="flex flex-col gap-2">
              {ov.employeeCapacity.map((c) => (
                <div key={c.employeeId} className="flex items-center gap-3">
                  <span className="w-40 truncate text-sm font-medium">{c.name}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className={`h-full rounded-full ${c.atCapacity ? 'bg-red-500' : 'bg-primary'}`} style={{ width: `${Math.min(100, (c.active / Math.max(1, c.max)) * 100)}%` }} />
                  </div>
                  <span className={`w-14 text-right text-sm font-bold ${c.atCapacity ? 'text-red-600' : ''}`}>{c.active}/{c.max}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'RISK' && ov && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><TriangleAlert className="h-4 w-4 text-red-600" /> Projects at Risk</h3>
          {ov.projectsAtRisk.length === 0 ? <p className="py-6 text-center text-muted-foreground">No projects at risk. 🎉</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2 pr-3">Project</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Progress</th><th className="py-2 pr-3">End date</th><th className="py-2 pr-3">Overdue tasks</th></tr></thead>
                <tbody>
                  {ov.projectsAtRisk.map((p) => (
                    <tr key={p.projectId} className="border-b last:border-0 hover:bg-accent/30 cursor-pointer" onClick={() => navigate(`/projects/${p.projectId}`)}>
                      <td className="py-2 pr-3 font-medium">{p.projectName}</td>
                      <td className="py-2 pr-3">{p.status}</td>
                      <td className="py-2 pr-3">{p.progress ?? 0}%</td>
                      <td className="py-2 pr-3">{p.endDate ?? '—'}</td>
                      <td className="py-2 pr-3 font-semibold text-red-600">{p.overdueTasks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'TIME' && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Timer className="h-4 w-4" /> Time Awaiting Approval</h3>
          {pendingTime.length === 0 ? <p className="py-6 text-center text-muted-foreground">Nothing pending.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2 pr-3">Employee</th><th className="py-2 pr-3">Task</th><th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Hours</th><th className="py-2 pr-3 text-right">Decide</th></tr></thead>
                <tbody>
                  {pendingTime.map((l) => (
                    <tr key={l.id} className="border-b last:border-0 hover:bg-accent/30">
                      <td className="py-2 pr-3 font-medium">{l.employeeName}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{l.taskName}</td>
                      <td className="py-2 pr-3">{l.workDate}</td>
                      <td className="py-2 pr-3">{Math.floor(l.workingTimeMinutes / 60)}h {l.workingTimeMinutes % 60}m</td>
                      <td className="py-2 pr-3">
                        <div className="flex justify-end gap-1">
                          <button title="Approve" onClick={() => act(() => employeeTaskApi.approveTime(l.id))} className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50"><Check className="h-4 w-4" /></button>
                          <button title="Reject" onClick={() => { const r = window.prompt('Reason for rejecting?') ?? undefined; act(() => employeeTaskApi.rejectTime(l.id, r)); }} className="rounded p-1.5 text-destructive hover:bg-destructive/10"><X className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'TEMPLATES' && (
        <div className="flex flex-col gap-4">
          {templates.map((tpl) => (
            <div key={tpl.id} className="rounded-xl border bg-card p-4 shadow-sm">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <GitBranch className="h-4 w-4 text-primary" /> {tpl.name}
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-normal text-muted-foreground">{tpl.scope}</span>
                {!tpl.active && <span className="text-[11px] text-red-600">inactive</span>}
              </h3>
              <div className="mt-2 flex flex-col gap-2">
                {tpl.phases.map((ph) => (
                  <div key={ph.id} className="rounded-lg border bg-background p-2">
                    <p className="text-xs font-semibold text-muted-foreground">{ph.orderIndex}. {ph.name}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {ph.tasks.map((tk) => (
                        <span key={tk.id} title={`${tk.assignmentType} · ${tk.completionRule}${tk.dependsOn.length ? ` · after ${tk.dependsOn.join(', ')}` : ''}`}
                          className="rounded-full border px-2 py-0.5 text-[11px]">
                          {tk.name}{tk.eligibleRoles ? ` · ${tk.eligibleRoles}` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

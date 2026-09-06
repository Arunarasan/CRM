import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Camera, AlertTriangle, Package, Play, Pause, CheckCircle2, ThumbsUp,
  Navigation, ChevronDown, UserPlus, ClipboardList,
} from 'lucide-react';
import api from '@/lib/api';
import { employeeTaskApi } from '@/api/employeeTaskApi';
import { TaskDetail as TaskDetailType } from '@/types/employeeTask';
import { runOrQueue } from '@/hooks/useOfflineQueue';
import ChecklistPanel from './components/ChecklistPanel';
import CheckInBar from './components/CheckInBar';
import ProgressSheet from './components/ProgressSheet';
import IssueReportSheet from './components/IssueReportSheet';
import MaterialUsageSheet from './components/MaterialUsageSheet';
import LeadTaskFormSheet from './components/LeadTaskFormSheet';
import RequirementFormSheet from './components/RequirementFormSheet';
import CompleteSheet from './components/CompleteSheet';
import TimeTracker from './components/TimeTracker';
import HoldTimer from './components/HoldTimer';
import { humanizeDue, dueToneClass, priorityMeta, statusMeta } from './taskUtils';

/** Collapsible section — keeps history/team out of the way until the employee wants them (spec §6). */
function Collapsible({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-[#ECEAE5] bg-white shadow-sm">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-3.5 py-3 text-left">
        <span className="flex items-center gap-2 text-sm font-semibold text-[#111817]">
          {title}{count != null && count > 0 && (
            <span className="rounded-full bg-[#EEF0EE] px-2 py-0.5 text-[11px] text-[#5B625E]">{count}</span>
          )}
        </span>
        <ChevronDown className={`h-4 w-4 text-[#7A817C] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="border-t border-[#F0EFEB] px-3.5 py-3">{children}</div>}
    </div>
  );
}

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const taskId = Number(id);
  const navigate = useNavigate();
  const [task, setTask] = useState<TaskDetailType | null>(null);
  const [note, setNote] = useState('');
  const [sheet, setSheet] = useState<'progress' | 'issue' | 'material' | 'complete' | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionErr, setActionErr] = useState('');

  const load = useCallback(() => {
    employeeTaskApi.detail(taskId).then(setTask).catch(() => {});
  }, [taskId]);

  useEffect(() => { load(); }, [load]);

  if (!task) return <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>;

  const mine = task.myAssignmentStatus;
  // Once the work is submitted/approved the task is read-only for the employee: no more progress,
  // photos, notes, issues, material or checklist edits. A manager "reject → rework" reopens it.
  const locked = mine === 'COMPLETED' || ['WAITING_APPROVAL', 'COMPLETED', 'CANCELLED'].includes(task.status);
  const status = statusMeta(task.status);
  const prio = priorityMeta(task.priority);
  const due = humanizeDue(task.dueDate, task.status);

  const doAction = async (action: 'accept' | 'start' | 'pause' | 'complete' | 'approve') => {
    setBusy(true);
    try {
      await runOrQueue({ method: 'post', url: `/employee-tasks/${taskId}/${action}`, description: `${action} task` });
      load();
    } finally {
      setBusy(false);
    }
  };

  const setProgress = async (pct: number) => {
    setBusy(true);
    try { await employeeTaskApi.addProgress(taskId, { progressPercent: pct }); load(); }
    finally { setBusy(false); }
  };

  const addNote = async () => {
    if (!note.trim()) return;
    await api.post(`/tasks/${taskId}/comments`, { content: note });
    setNote('');
    load();
  };

  const extendHold = async () => {
    await employeeTaskApi.extendHold(taskId);
    load();
  };

  const primaryAction = (() => {
    if (mine === 'ASSIGNED') return { label: 'Accept Task', icon: ThumbsUp, action: 'accept' as const };
    if (mine === 'ACCEPTED') return { label: 'Start Work', icon: Play, action: 'start' as const };
    if (mine === 'IN_PROGRESS') return { label: 'Pause', icon: Pause, action: 'pause' as const };
    if (mine === 'PAUSED') return { label: 'Resume', icon: Play, action: 'start' as const };
    return null;
  })();

  // Lead-workflow tasks capture structured data on completion (writes onto the lead page).
  const isLeadForm = !!task.formType;
  const canSubmitForm = isLeadForm && !locked
    && ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'PAUSED'].includes(mine ?? '');
  // Module-driven tasks (Measurement/BOQ) are done in a dedicated module and close automatically —
  // never completed by hand here.
  const moduleDriven = !!task.moduleDriven;

  // An AVAILABLE task the employee hasn't taken yet — they can pick it up straight from here.
  // Pool tasks carry a backend-only 'AVAILABLE' status not in the TaskStatus union — compare as string.
  const canPick = !mine && !locked && !moduleDriven && (task.status as string) === 'AVAILABLE';
  const pickUp = async () => {
    setBusy(true);
    setActionErr('');
    try {
      await employeeTaskApi.pick(taskId);
      load();
    } catch (e: any) {
      setActionErr(e?.response?.data?.message || 'Could not take this task. It may be at capacity or assigned to someone else.');
    } finally {
      setBusy(false);
    }
  };

  const place = [task.floor, task.room, task.itemName].filter(Boolean).join(' · ');
  const showQuickProgress = !isLeadForm && !moduleDriven && !locked && mine === 'IN_PROGRESS';
  const solid = 'flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold active:scale-[0.99] disabled:opacity-50';

  return (
    <div className="flex flex-col pb-32">
      {/* Sticky focused header */}
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-[#EDEBE6] bg-[#F7F7F5]/95 px-2 py-2.5 backdrop-blur">
        <button onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-full active:bg-black/5" aria-label="Back">
          <ArrowLeft className="h-5 w-5 text-[#111817]" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-[15px] font-semibold text-[#111817]">{task.taskName}</h1>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${status.cls}`}>{status.label}</span>
      </div>

      <div className="flex flex-col gap-3 p-3.5">
        {/* Summary — what to do, where, when */}
        <div className="rounded-2xl border border-[#ECEAE5] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${prio.dot}`} />
            <span className="text-[12px] font-medium text-[#5B625E]">{prio.label} priority</span>
            <span className={`ml-auto text-[12px] font-semibold ${dueToneClass(due.tone)}`}>{due.text}</span>
          </div>
          <h2 className="mt-2 text-[18px] font-bold leading-snug text-[#111817]">{task.taskName}</h2>
          {(task.project?.name || task.customer) && (
            <p className="mt-0.5 text-[14px] text-[#5B625E]">{[task.project?.name, task.customer].filter(Boolean).join(' · ')}</p>
          )}
          {place && <p className="mt-0.5 text-[13px] text-[#7A817C]">{place}</p>}
          {task.location && <p className="mt-0.5 text-[13px] text-[#7A817C]">{task.location}</p>}
          {task.description && (
            <div className="mt-3 rounded-xl bg-[#F5F7F5] p-3">
              <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#7A817C]">What to do</p>
              <p className="text-[14px] leading-relaxed text-[#2C332F]">{task.description}</p>
            </div>
          )}
          {task.location && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.location)}`}
              target="_blank" rel="noopener noreferrer"
              className="mt-3 flex items-center justify-center gap-2 rounded-lg border border-[#DDE2DE] bg-white py-2.5 text-sm font-semibold text-[#0A573B] active:scale-[0.99]"
            >
              <Navigation className="h-4 w-4" /> Navigate to site
            </a>
          )}
        </div>

        {/* Data-entry hold countdown — turns into an "extend time" alert in the last 2 minutes. */}
        {task.holdExpiresAt && <HoldTimer expiresAt={task.holdExpiresAt} onExtend={extendHold} />}

        {moduleDriven && !locked && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
            This task is done in its dedicated module. Open it below — the task closes
            <span className="font-semibold"> automatically</span> once the work is finalized there. It can't be marked done from here.
          </div>
        )}

        {task.status === 'WAITING_APPROVAL' && (
          <div className="rounded-xl border border-purple-200 bg-purple-50 p-3 text-xs text-purple-800">
            Submitted — waiting for manager approval. This task is locked and can’t be updated until a manager reviews it.
          </div>
        )}
        {locked && task.status !== 'WAITING_APPROVAL' && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
            This task is {task.status === 'CANCELLED' ? 'cancelled' : 'completed'} and locked — no further updates can be added.
          </div>
        )}

        {/* Lead-workflow "collect info" tasks are form-first: take the task, then fill the form that
            writes straight onto the lead — no field-work tools (check-in / checklist / progress). */}
        {isLeadForm && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
              <ClipboardList className="h-4 w-4" /> Customer information form
            </div>
            <p className="mt-1 text-xs text-emerald-800">
              Fill in the details you collect from the customer — they save straight onto the lead for the office to see.
            </p>
            {locked ? (
              <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> {task.status === 'WAITING_APPROVAL' ? 'Submitted — awaiting manager approval.' : 'Submitted — this task is done.'}
              </p>
            ) : canPick ? (
              <button onClick={pickUp} disabled={busy}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-3 text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-50">
                <ThumbsUp className="h-4 w-4" /> Take this task
              </button>
            ) : canSubmitForm ? (
              <button onClick={() => setFormOpen(true)} disabled={busy}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-3 text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-50">
                <ClipboardList className="h-4 w-4" /> Fill &amp; Submit Form
              </button>
            ) : primaryAction ? (
              <button onClick={() => doAction(primaryAction.action)} disabled={busy}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-3 text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-50">
                <primaryAction.icon className="h-4 w-4" /> {primaryAction.label}
              </button>
            ) : null}
            {actionErr && <p className="mt-2 rounded-md bg-destructive/15 p-2 text-xs text-destructive">{actionErr}</p>}
          </div>
        )}

        {/* Collaborative tasks: let an eligible employee who isn't already on the team join in. */}
        {!mine && !locked && (task.assignmentType === 'MULTIPLE_EMPLOYEES' || task.assignmentType === 'TEAM') && task.team.length > 0 && (
          <button
            onClick={async () => { setBusy(true); try { await employeeTaskApi.join(taskId); load(); } finally { setBusy(false); } }}
            disabled={busy}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4" /> Join this task
          </button>
        )}

        {/* Field-execution tools — only for real field/site tasks, not lead "collect info" forms. */}
        {!isLeadForm && (<>
        {mine && <TimeTracker taskId={taskId} disabled={locked} />}

        <CheckInBar taskId={taskId} checkins={task.checkins} onChanged={load} locked={locked} />

        <ChecklistPanel taskId={taskId} checklist={task.checklist} onChanged={load} locked={locked} title="Work to Complete" />

        {/* One-tap progress while the work is live. */}
        {showQuickProgress && (
          <div className="rounded-xl border border-[#ECEAE5] bg-white p-3.5 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#111817]">Progress</h3>
              <span className="text-sm font-bold text-[#0A573B]">{task.progressPercent ?? 0}%</span>
            </div>
            <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-[#EDEFEC]">
              <div className="h-full rounded-full bg-[#0A573B]" style={{ width: `${task.progressPercent ?? 0}%` }} />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[25, 50, 75, 100].map((p) => (
                <button key={p} onClick={() => setProgress(p)} disabled={busy}
                  className="rounded-lg border border-[#DDE2DE] bg-white py-2 text-[13px] font-semibold text-[#0A573B] active:scale-95 disabled:opacity-50">
                  {p}%
                </button>
              ))}
            </div>
            <button onClick={() => setSheet('progress')}
              className="mt-2 flex w-full items-center justify-center gap-1.5 text-[12px] font-medium text-[#7A817C]">
              <Camera className="h-3.5 w-3.5" /> Add photo or note
            </button>
          </div>
        )}

        <Collapsible title="Progress & Photos" count={task.progress.length}>
          {task.progress.length === 0 && <p className="text-xs text-muted-foreground">No updates yet.</p>}
          <ul className="flex flex-col gap-2">
            {task.progress.map((p) => (
              <li key={p.id} className="border-b pb-2 last:border-0">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{p.employeeName}</span>
                  <span className="text-muted-foreground">{new Date(p.createdAt).toLocaleString()}</span>
                </div>
                {p.progressPercent != null && <p className="text-xs text-primary">{p.progressPercent}% complete</p>}
                {p.remarks && <p className="text-sm">{p.remarks}</p>}
                {p.media.length > 0 && (
                  <div className="mt-1 flex gap-2 overflow-x-auto">
                    {p.media.map((m, i) => (
                      m.mediaType === 'PHOTO' ? (
                        <img key={i} src={m.fileUrl} alt="progress" className="h-16 w-16 shrink-0 rounded-md object-cover" />
                      ) : (
                        <span key={i} className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-muted text-[10px]">{m.mediaType}</span>
                      )
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Collapsible>

        <Collapsible title="Assigned Team" count={task.team.length}>
          <ul className="flex flex-col gap-1.5">
            {task.team.map((m) => (
              <li key={m.employeeId} className="flex items-center justify-between text-sm">
                <span>{m.employeeName}{m.role ? ` (${m.role})` : ''}</span>
                <span className="text-[11px] text-muted-foreground">{m.status.replace('_', ' ')}</span>
              </li>
            ))}
          </ul>
        </Collapsible>

        {task.issues.length > 0 && (
          <div className="rounded-xl border border-[#ECEAE5] bg-white p-3.5 shadow-sm">
            <h3 className="mb-2 text-sm font-semibold text-[#111817]">Issues</h3>
            <ul className="flex flex-col gap-2">
              {task.issues.map((i) => (
                <li key={i.id} className="text-sm">
                  <span className="font-medium">{i.issueType.replace('_', ' ')}</span> — {i.description}
                  <span className="ml-1 text-[11px] text-muted-foreground">({i.status})</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        </>)}

        <Collapsible title="Remarks" count={task.comments.length}>
          <ul className="mb-2 flex flex-col gap-2">
            {task.comments.length === 0 && <li className="text-xs text-muted-foreground">No remarks yet.</li>}
            {task.comments.map((c) => (
              <li key={c.id} className="text-sm">
                <span className="font-medium">{c.authorName}:</span> {c.content}
              </li>
            ))}
          </ul>
          {locked ? (
            <p className="text-xs text-muted-foreground">Notes are closed — this task is locked.</p>
          ) : (
            <div className="flex gap-2">
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…"
                className="flex-1 rounded-md border px-2 py-1.5 text-sm" />
              <button onClick={addNote} className="rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground">Post</button>
            </div>
          )}
        </Collapsible>
      </div>

      {/* Bottom action bar with field-work buttons — hidden for lead forms (their CTA card is at top). */}
      {!isLeadForm && (
      <div className="fixed bottom-16 left-1/2 z-20 w-full max-w-md -translate-x-1/2 border-t border-[#EDEBE6] bg-white px-3 py-2.5 shadow-[0_-2px_10px_rgba(0,0,0,0.06)]">
        {locked ? (
          <p className="flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Task locked — no further updates
          </p>
        ) : (
          <>
            {/* Primary state action (Accept / Start / Pause / Resume) — unchanged behaviour. */}
            {primaryAction && (
              <button onClick={() => doAction(primaryAction.action)} disabled={busy}
                className={`${solid} mb-2 ${mine === 'IN_PROGRESS' ? 'border border-[#DDE2DE] bg-white text-[#0A573B]' : 'bg-[#0A573B] text-white'}`}>
                <primaryAction.icon className="h-4 w-4" /> {primaryAction.label}
              </button>
            )}
            {/* Module-driven tasks open their module; in-progress field tasks complete via the confirm sheet;
                an untaken pool task can be picked up here. */}
            {moduleDriven && task.moduleLink ? (
              <button onClick={() => navigate(task.moduleLink!)} className={`${solid} mb-2 bg-emerald-600 text-white`}>
                <ClipboardList className="h-4 w-4" /> {task.moduleLabel ?? 'Open module'}
              </button>
            ) : (!moduleDriven && mine === 'IN_PROGRESS') ? (
              <button onClick={() => setSheet('complete')} disabled={busy} className={`${solid} mb-2 bg-[#0A573B] text-white`}>
                <CheckCircle2 className="h-4 w-4" /> Complete Task
              </button>
            ) : (!primaryAction && canPick) ? (
              <button onClick={pickUp} disabled={busy} className={`${solid} mb-2 bg-[#0A573B] text-white`}>
                <ThumbsUp className="h-4 w-4" /> Take this task
              </button>
            ) : null}
            {actionErr && <p className="mb-2 rounded-md bg-destructive/15 p-2 text-xs text-destructive">{actionErr}</p>}
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => setSheet('progress')} className="flex flex-col items-center gap-0.5 rounded-lg border border-[#DDE2DE] py-2 text-[11px] font-medium text-[#4B524E]">
                <Camera className="h-4 w-4" /> Progress
              </button>
              <button onClick={() => setSheet('issue')} className="flex flex-col items-center gap-0.5 rounded-lg border border-[#DDE2DE] py-2 text-[11px] font-medium text-[#4B524E]">
                <AlertTriangle className="h-4 w-4" /> Report Issue
              </button>
              <button onClick={() => setSheet('material')} className="flex flex-col items-center gap-0.5 rounded-lg border border-[#DDE2DE] py-2 text-[11px] font-medium text-[#4B524E]">
                <Package className="h-4 w-4" /> Material
              </button>
            </div>
          </>
        )}
      </div>
      )}

      <ProgressSheet taskId={taskId} open={sheet === 'progress'} onOpenChange={(o) => setSheet(o ? 'progress' : null)} onSaved={load} />
      <IssueReportSheet taskId={taskId} open={sheet === 'issue'} onOpenChange={(o) => setSheet(o ? 'issue' : null)} onSaved={load} />
      <MaterialUsageSheet taskId={taskId} open={sheet === 'material'} onOpenChange={(o) => setSheet(o ? 'material' : null)} onSaved={load} />
      <CompleteSheet taskId={taskId} open={sheet === 'complete'} onOpenChange={(o) => setSheet(o ? 'complete' : null)}
        onDone={() => { load(); navigate('/employee/tasks'); }} />
      {isLeadForm && task.formType === 'REQUIREMENT' ? (
        <RequirementFormSheet
          taskId={taskId}
          leadId={task.leadId ?? null}
          open={formOpen}
          onOpenChange={setFormOpen}
          onSaved={() => { setFormOpen(false); load(); navigate('/employee/tasks'); }}
        />
      ) : isLeadForm && task.formType && (
        <LeadTaskFormSheet
          taskId={taskId}
          formType={task.formType}
          open={formOpen}
          onOpenChange={setFormOpen}
          onSaved={() => { setFormOpen(false); load(); navigate('/employee/tasks'); }}
        />
      )}
    </div>
  );
}

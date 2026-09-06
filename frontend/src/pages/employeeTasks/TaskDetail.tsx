import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Camera, AlertTriangle, Package, Play, Pause, CheckCircle2, ThumbsUp,
  Navigation, ChevronDown, UserPlus, ClipboardList, MapPin, Image as ImageIcon,
  Users, MessageSquare,
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

/** A quiet disclosure row — keeps history/team/notes tucked away until wanted. Designed to sit
 *  inside a grouped card with `divide-y`, so it carries no border of its own (spec §6). */
function Disclosure({ title, count, icon, children }: {
  title: string; count?: number; icon?: React.ReactNode; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
        {icon && <span className="text-[#9B6B32]">{icon}</span>}
        <span className="flex-1 text-[14px] font-medium text-[#22271F]">{title}</span>
        {count != null && count > 0 && (
          <span className="rounded-full bg-[#F3EEE2] px-2 py-0.5 text-[11px] font-medium text-[#8A6A2E]">{count}</span>
        )}
        <ChevronDown className={`h-4 w-4 shrink-0 text-[#B4B0A4] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-4 pb-4 pt-0.5">{children}</div>}
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
  const solid = 'flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[15px] font-semibold transition active:scale-[0.99] disabled:opacity-50';

  return (
    <div className="flex flex-col bg-[#FAF8F3] pb-36">
      {/* Sticky focused header */}
      <div className="sticky top-0 z-10 flex items-center gap-1.5 border-b border-[#EEE7DA] bg-[#FAF8F3]/90 px-2 py-2.5 backdrop-blur">
        <button onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-full active:bg-black/5" aria-label="Back">
          <ArrowLeft className="h-5 w-5 text-[#22271F]" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-[15px] font-semibold text-[#22271F]">{task.taskName}</h1>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${status.cls}`}>{status.label}</span>
      </div>

      <div className="flex flex-col gap-3.5 p-4">
        {/* Summary — what to do, where, when. The centrepiece: a soft card with a slim gold accent. */}
        <div className="overflow-hidden rounded-2xl border border-[#EDE6D8] bg-white shadow-[0_4px_16px_rgba(80,55,20,0.06)]">
          <div className="h-1 bg-gradient-to-r from-[#0A573B] via-[#0A573B] to-[#BC8748]" />
          <div className="p-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FBF6EC] px-2.5 py-1">
                <span className={`h-2 w-2 rounded-full ${prio.dot}`} />
                <span className="text-[11px] font-medium text-[#6B7169]">{prio.label} priority</span>
              </span>
              <span className={`ml-auto text-[12px] font-semibold ${dueToneClass(due.tone)}`}>{due.text}</span>
            </div>
            <h2 className="mt-2.5 text-[19px] font-bold leading-snug text-[#1A211E]">{task.taskName}</h2>
            {(task.project?.name || task.customer) && (
              <p className="mt-1 text-[14px] text-[#5E655D]">{[task.project?.name, task.customer].filter(Boolean).join(' · ')}</p>
            )}
            {(place || task.location) && (
              <p className="mt-1.5 flex items-start gap-1.5 text-[13px] text-[#8A8F86]">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#B79A5C]" />
                <span>{[place, task.location].filter(Boolean).join(' · ')}</span>
              </p>
            )}
            {task.description && (
              <div className="mt-3.5 rounded-xl bg-[#F6F4EC] p-3.5">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#A07E38]">What to do</p>
                <p className="text-[14px] leading-relaxed text-[#33392F]">{task.description}</p>
              </div>
            )}
            {task.mapUrl && (
              <a
                href={task.mapUrl}
                target="_blank" rel="noopener noreferrer"
                className="mt-3.5 flex items-center justify-center gap-2 rounded-xl border border-[#D7DED8] bg-white py-2.5 text-[14px] font-semibold text-[#0A573B] active:scale-[0.99]"
              >
                <Navigation className="h-4 w-4" /> Navigate to site
              </a>
            )}
          </div>
        </div>

        {/* Data-entry hold countdown — turns into an "extend time" alert in the last 2 minutes. */}
        {task.holdExpiresAt && <HoldTimer expiresAt={task.holdExpiresAt} onExtend={extendHold} />}

        {moduleDriven && !locked && (
          <div className="rounded-xl border border-[#DBE7DF] bg-[#EFF5F0] p-3.5 text-[13px] leading-relaxed text-[#2C5C45]">
            This task is done in its dedicated module. Open it below — the task closes
            <span className="font-semibold"> automatically</span> once the work is finalized there. It can't be marked done from here.
          </div>
        )}

        {task.status === 'WAITING_APPROVAL' && (
          <div className="rounded-xl border border-[#E3DAF1] bg-[#F2EDFA] p-3.5 text-[13px] leading-relaxed text-[#5C4494]">
            Submitted — waiting for manager approval. This task is locked and can’t be updated until a manager reviews it.
          </div>
        )}
        {locked && task.status !== 'WAITING_APPROVAL' && (
          <div className="rounded-xl border border-[#DBE7DF] bg-[#EFF5F0] p-3.5 text-[13px] leading-relaxed text-[#2C5C45]">
            This task is {task.status === 'CANCELLED' ? 'cancelled' : 'completed'} and locked — no further updates can be added.
          </div>
        )}

        {/* Lead-workflow "collect info" tasks are form-first: take the task, then fill the form that
            writes straight onto the lead — no field-work tools (check-in / checklist / progress). */}
        {isLeadForm && (
          <div className="overflow-hidden rounded-2xl border border-[#EDE6D8] bg-white shadow-[0_4px_16px_rgba(80,55,20,0.06)]">
            <div className="p-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EFF5F0] text-[#0A573B]">
                  <ClipboardList className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[15px] font-semibold text-[#1A211E]">Customer information</p>
                  <p className="text-[12px] text-[#8A8F86]">Saves straight onto the lead for the office.</p>
                </div>
              </div>
              {locked ? (
                <p className="mt-3.5 flex items-center gap-1.5 text-[13px] font-medium text-[#2C7050]">
                  <CheckCircle2 className="h-4 w-4" /> {task.status === 'WAITING_APPROVAL' ? 'Submitted — awaiting manager approval.' : 'Submitted — this task is done.'}
                </p>
              ) : canPick ? (
                <button onClick={pickUp} disabled={busy} className={`${solid} mt-3.5 bg-[#0A573B] text-white`}>
                  <ThumbsUp className="h-4 w-4" /> Take this task
                </button>
              ) : canSubmitForm ? (
                <button onClick={() => setFormOpen(true)} disabled={busy} className={`${solid} mt-3.5 bg-[#0A573B] text-white`}>
                  <ClipboardList className="h-4 w-4" /> Fill &amp; submit form
                </button>
              ) : primaryAction ? (
                <button onClick={() => doAction(primaryAction.action)} disabled={busy} className={`${solid} mt-3.5 bg-[#0A573B] text-white`}>
                  <primaryAction.icon className="h-4 w-4" /> {primaryAction.label}
                </button>
              ) : null}
              {actionErr && <p className="mt-2 rounded-lg bg-[#FBE7E4] p-2.5 text-[12px] text-[#B94B45]">{actionErr}</p>}
            </div>
          </div>
        )}

        {/* Collaborative tasks: let an eligible employee who isn't already on the team join in. */}
        {!mine && !locked && (task.assignmentType === 'MULTIPLE_EMPLOYEES' || task.assignmentType === 'TEAM') && task.team.length > 0 && (
          <button
            onClick={async () => { setBusy(true); try { await employeeTaskApi.join(taskId); load(); } finally { setBusy(false); } }}
            disabled={busy}
            className={`${solid} bg-[#0A573B] text-white`}
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
          <div className="rounded-2xl border border-[#EDE6D8] bg-white p-4 shadow-[0_2px_10px_rgba(80,55,20,0.05)]">
            <div className="mb-2.5 flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-[#1A211E]">Progress</h3>
              <span className="text-[15px] font-bold text-[#0A573B]">{task.progressPercent ?? 0}%</span>
            </div>
            <div className="mb-3.5 h-2.5 w-full overflow-hidden rounded-full bg-[#EFEBE0]">
              <div className="h-full rounded-full bg-gradient-to-r from-[#0A573B] to-[#0F6E56]" style={{ width: `${task.progressPercent ?? 0}%` }} />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[25, 50, 75, 100].map((p) => (
                <button key={p} onClick={() => setProgress(p)} disabled={busy}
                  className={`rounded-xl border py-2.5 text-[13px] font-semibold transition active:scale-95 disabled:opacity-50 ${
                    (task.progressPercent ?? 0) >= p
                      ? 'border-[#0A573B] bg-[#EFF5F0] text-[#0A573B]'
                      : 'border-[#DDE2DE] bg-white text-[#0A573B]'}`}>
                  {p}%
                </button>
              ))}
            </div>
            <button onClick={() => setSheet('progress')}
              className="mt-2.5 flex w-full items-center justify-center gap-1.5 text-[12px] font-medium text-[#9B6B32]">
              <Camera className="h-3.5 w-3.5" /> Add photo or note
            </button>
          </div>
        )}

        {/* History / team / issues — folded into one quiet grouped card so the screen stays calm. */}
        <div className="divide-y divide-[#F1ECE2] overflow-hidden rounded-2xl border border-[#EDE6D8] bg-white shadow-[0_2px_10px_rgba(80,55,20,0.05)]">
          <Disclosure title="Progress & photos" count={task.progress.length} icon={<ImageIcon className="h-4 w-4" />}>
            {task.progress.length === 0 && <p className="text-[13px] text-[#9A9E96]">No updates yet.</p>}
            <ul className="flex flex-col gap-2.5">
              {task.progress.map((p) => (
                <li key={p.id} className="border-b border-[#F1ECE2] pb-2.5 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="font-medium text-[#33392F]">{p.employeeName}</span>
                    <span className="text-[#9A9E96]">{new Date(p.createdAt).toLocaleString()}</span>
                  </div>
                  {p.progressPercent != null && <p className="text-[12px] font-medium text-[#0A573B]">{p.progressPercent}% complete</p>}
                  {p.remarks && <p className="text-[13px] text-[#33392F]">{p.remarks}</p>}
                  {p.media.length > 0 && (
                    <div className="mt-1.5 flex gap-2 overflow-x-auto">
                      {p.media.map((m, i) => (
                        m.mediaType === 'PHOTO' ? (
                          <img key={i} src={m.fileUrl} alt="progress" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                        ) : (
                          <span key={i} className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-[#F1ECE2] text-[10px] text-[#8A8F86]">{m.mediaType}</span>
                        )
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Disclosure>

          <Disclosure title="Assigned team" count={task.team.length} icon={<Users className="h-4 w-4" />}>
            <ul className="flex flex-col gap-2">
              {task.team.map((m) => (
                <li key={m.employeeId} className="flex items-center justify-between text-[13px] text-[#33392F]">
                  <span>{m.employeeName}{m.role ? ` · ${m.role}` : ''}</span>
                  <span className="text-[11px] text-[#9A9E96]">{m.status.replace('_', ' ')}</span>
                </li>
              ))}
            </ul>
          </Disclosure>

          {task.issues.length > 0 && (
            <Disclosure title="Issues" count={task.issues.length} icon={<AlertTriangle className="h-4 w-4" />}>
              <ul className="flex flex-col gap-2">
                {task.issues.map((i) => (
                  <li key={i.id} className="text-[13px] text-[#33392F]">
                    <span className="font-medium">{i.issueType.replace('_', ' ')}</span> — {i.description}
                    <span className="ml-1 text-[11px] text-[#9A9E96]">({i.status})</span>
                  </li>
                ))}
              </ul>
            </Disclosure>
          )}
        </div>
        </>)}

        {/* Remarks — shown for every task type (including lead forms). */}
        <div className="overflow-hidden rounded-2xl border border-[#EDE6D8] bg-white shadow-[0_2px_10px_rgba(80,55,20,0.05)]">
          <Disclosure title="Remarks" count={task.comments.length} icon={<MessageSquare className="h-4 w-4" />}>
            <ul className="mb-2.5 flex flex-col gap-2">
              {task.comments.length === 0 && <li className="text-[13px] text-[#9A9E96]">No remarks yet.</li>}
              {task.comments.map((c) => (
                <li key={c.id} className="text-[13px] text-[#33392F]">
                  <span className="font-medium">{c.authorName}:</span> {c.content}
                </li>
              ))}
            </ul>
            {locked ? (
              <p className="text-[12px] text-[#9A9E96]">Notes are closed — this task is locked.</p>
            ) : (
              <div className="flex gap-2">
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…"
                  className="flex-1 rounded-xl border border-[#DDE2DE] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#0A573B]" />
                <button onClick={addNote} className="rounded-xl bg-[#0A573B] px-4 text-[13px] font-semibold text-white active:scale-95">Post</button>
              </div>
            )}
          </Disclosure>
        </div>
      </div>

      {/* Bottom action bar with field-work buttons — hidden for lead forms (their CTA card is at top). */}
      {!isLeadForm && (
      <div className="fixed bottom-16 left-1/2 z-20 w-full max-w-md -translate-x-1/2 border-t border-[#EEE7DA] bg-[#FDFCF9]/95 px-3.5 pb-3 pt-2.5 backdrop-blur shadow-[0_-4px_16px_rgba(80,55,20,0.07)]">
        {locked ? (
          <p className="flex items-center justify-center gap-1.5 py-2 text-[12px] font-medium text-[#8A8F86]">
            <CheckCircle2 className="h-4 w-4 text-[#2C7050]" /> Task locked — no further updates
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
              <button onClick={() => navigate(task.moduleLink!)} className={`${solid} mb-2 bg-[#0A573B] text-white`}>
                <ClipboardList className="h-4 w-4" /> {task.moduleLabel ?? 'Open module'}
              </button>
            ) : (!moduleDriven && mine === 'IN_PROGRESS') ? (
              <button onClick={() => setSheet('complete')} disabled={busy} className={`${solid} mb-2 bg-[#0A573B] text-white`}>
                <CheckCircle2 className="h-4 w-4" /> Complete task
              </button>
            ) : (!primaryAction && canPick) ? (
              <button onClick={pickUp} disabled={busy} className={`${solid} mb-2 bg-[#0A573B] text-white`}>
                <ThumbsUp className="h-4 w-4" /> Take this task
              </button>
            ) : null}
            {actionErr && <p className="mb-2 rounded-lg bg-[#FBE7E4] p-2.5 text-[12px] text-[#B94B45]">{actionErr}</p>}
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => setSheet('progress')} className="flex flex-col items-center gap-1 rounded-xl border border-[#E4DECF] bg-white py-2.5 text-[11px] font-medium text-[#4B524E] active:scale-95">
                <Camera className="h-[18px] w-[18px] text-[#0A573B]" /> Progress
              </button>
              <button onClick={() => setSheet('issue')} className="flex flex-col items-center gap-1 rounded-xl border border-[#E4DECF] bg-white py-2.5 text-[11px] font-medium text-[#4B524E] active:scale-95">
                <AlertTriangle className="h-[18px] w-[18px] text-[#B27A12]" /> Report issue
              </button>
              <button onClick={() => setSheet('material')} className="flex flex-col items-center gap-1 rounded-xl border border-[#E4DECF] bg-white py-2.5 text-[11px] font-medium text-[#4B524E] active:scale-95">
                <Package className="h-[18px] w-[18px] text-[#9B6B32]" /> Material
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

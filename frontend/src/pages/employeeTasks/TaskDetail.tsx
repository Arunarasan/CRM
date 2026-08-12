import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Camera, AlertTriangle, Package, Play, Pause, CheckCircle2, ThumbsUp } from 'lucide-react';
import api from '@/lib/api';
import { employeeTaskApi } from '@/api/employeeTaskApi';
import { TaskDetail as TaskDetailType } from '@/types/employeeTask';
import { runOrQueue } from '@/hooks/useOfflineQueue';
import ChecklistPanel from './components/ChecklistPanel';
import CheckInBar from './components/CheckInBar';
import ProgressSheet from './components/ProgressSheet';
import IssueReportSheet from './components/IssueReportSheet';
import MaterialUsageSheet from './components/MaterialUsageSheet';

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const taskId = Number(id);
  const navigate = useNavigate();
  const [task, setTask] = useState<TaskDetailType | null>(null);
  const [note, setNote] = useState('');
  const [sheet, setSheet] = useState<'progress' | 'issue' | 'material' | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    employeeTaskApi.detail(taskId).then(setTask).catch(() => {});
  }, [taskId]);

  useEffect(() => { load(); }, [load]);

  if (!task) return <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>;

  const mine = task.myAssignmentStatus;
  // Once the work is submitted/approved the task is read-only for the employee: no more progress,
  // photos, notes, issues, material or checklist edits. A manager "reject → rework" reopens it.
  const locked = mine === 'COMPLETED' || ['WAITING_APPROVAL', 'COMPLETED', 'CANCELLED'].includes(task.status);

  const doAction = async (action: 'accept' | 'start' | 'pause' | 'complete' | 'approve') => {
    setBusy(true);
    try {
      await runOrQueue({ method: 'post', url: `/employee-tasks/${taskId}/${action}`, description: `${action} task` });
      load();
    } finally {
      setBusy(false);
    }
  };

  const addNote = async () => {
    if (!note.trim()) return;
    await api.post(`/tasks/${taskId}/comments`, { content: note });
    setNote('');
    load();
  };

  const primaryAction = (() => {
    if (mine === 'ASSIGNED') return { label: 'Accept Task', icon: ThumbsUp, action: 'accept' as const };
    if (mine === 'ACCEPTED') return { label: 'Start Work', icon: Play, action: 'start' as const };
    if (mine === 'IN_PROGRESS') return { label: 'Pause', icon: Pause, action: 'pause' as const };
    if (mine === 'PAUSED') return { label: 'Resume', icon: Play, action: 'start' as const };
    return null;
  })();

  return (
    <div className="flex flex-col gap-3 p-3 pb-28">
      <button onClick={() => navigate(-1)} className="flex w-fit items-center gap-1 text-xs font-medium text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="rounded-xl border bg-card p-3 shadow-sm">
        <h1 className="text-base font-bold">{task.taskName}</h1>
        <p className="text-sm text-muted-foreground">{task.project?.name} · {task.customer}</p>
        {(task.floor || task.room || task.itemName) && (
          <p className="mt-1 text-xs text-muted-foreground">{[task.floor, task.room, task.itemName].filter(Boolean).join(' · ')}</p>
        )}
        {task.location && <p className="text-xs text-muted-foreground">{task.location}</p>}
        {task.description && <p className="mt-2 text-sm">{task.description}</p>}
        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-full bg-muted px-2 py-0.5">Priority: {task.priority}</span>
          <span className="rounded-full bg-muted px-2 py-0.5">Status: {task.status.replace('_', ' ')}</span>
          {task.dueDate && <span className="rounded-full bg-muted px-2 py-0.5">Due: {task.dueDate}</span>}
        </div>
      </div>

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

      <CheckInBar taskId={taskId} checkins={task.checkins} onChanged={load} locked={locked} />

      <div className="rounded-xl border bg-card p-3 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold">Assigned Team</h3>
        <ul className="flex flex-col gap-1.5">
          {task.team.map((m) => (
            <li key={m.employeeId} className="flex items-center justify-between text-sm">
              <span>{m.employeeName}{m.role ? ` (${m.role})` : ''}</span>
              <span className="text-[11px] text-muted-foreground">{m.status.replace('_', ' ')}</span>
            </li>
          ))}
        </ul>
      </div>

      <ChecklistPanel taskId={taskId} checklist={task.checklist} onChanged={load} locked={locked} />

      <div className="rounded-xl border bg-card p-3 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold">Progress &amp; Photos</h3>
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
      </div>

      {task.issues.length > 0 && (
        <div className="rounded-xl border bg-card p-3 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold">Issues</h3>
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

      <div className="rounded-xl border bg-card p-3 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold">Remarks</h3>
        <ul className="mb-2 flex flex-col gap-2">
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
      </div>

      <div className="fixed bottom-16 left-1/2 z-20 w-full max-w-md -translate-x-1/2 border-t bg-card px-3 py-2 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
        {locked ? (
          <p className="flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Task locked — no further updates
          </p>
        ) : (
          <>
            {primaryAction && (
              <button
                onClick={() => doAction(primaryAction.action)}
                disabled={busy}
                className="mb-2 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
              >
                <primaryAction.icon className="h-4 w-4" /> {primaryAction.label}
              </button>
            )}
            {mine === 'IN_PROGRESS' && (
              <button
                onClick={() => doAction('complete')}
                disabled={busy}
                className="mb-2 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white"
              >
                <CheckCircle2 className="h-4 w-4" /> Complete Task
              </button>
            )}
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => setSheet('progress')} className="flex flex-col items-center gap-0.5 rounded-lg border py-2 text-[11px]">
                <Camera className="h-4 w-4" /> Progress
              </button>
              <button onClick={() => setSheet('issue')} className="flex flex-col items-center gap-0.5 rounded-lg border py-2 text-[11px]">
                <AlertTriangle className="h-4 w-4" /> Report Issue
              </button>
              <button onClick={() => setSheet('material')} className="flex flex-col items-center gap-0.5 rounded-lg border py-2 text-[11px]">
                <Package className="h-4 w-4" /> Material
              </button>
            </div>
          </>
        )}
      </div>

      <ProgressSheet taskId={taskId} open={sheet === 'progress'} onOpenChange={(o) => setSheet(o ? 'progress' : null)} onSaved={load} />
      <IssueReportSheet taskId={taskId} open={sheet === 'issue'} onOpenChange={(o) => setSheet(o ? 'issue' : null)} onSaved={load} />
      <MaterialUsageSheet taskId={taskId} open={sheet === 'material'} onOpenChange={(o) => setSheet(o ? 'material' : null)} onSaved={load} />
    </div>
  );
}

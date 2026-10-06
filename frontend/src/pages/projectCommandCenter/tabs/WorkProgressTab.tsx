import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, ClipboardCheck, ExternalLink, History, Hammer, MessageSquare, RefreshCw, Settings2, Wrench } from 'lucide-react';
import { projectWorkApi } from '@/api/projectWorkApi';
import { employeeTaskApi } from '@/api/employeeTaskApi';
import { toast } from '@/components/ui/toast';
import { TaskDetail } from '@/types/employeeTask';
import { WorkBoard, WorkEvent, WorkTaskInfo, EVENT_LABELS } from '@/types/projectWork';
import ExecutionBoard from '@/components/projectWork/ExecutionBoard';
import InstallationBoard from '@/components/projectWork/InstallationBoard';
import DailyLogPanel from '@/components/projectWork/DailyLogPanel';
import TeamChat, { ChatTag } from '@/components/projectWork/TeamChat';
import { CARD, GHOST, PRIMARY, Thumbs, errMsg, fmtWhen } from '@/components/projectWork/workUi';
import { useAuth } from '@/hooks/useAuth';
import CategoryDefaultsDialog from '@/components/projectWork/CategoryDefaultsDialog';

type View = 'execution' | 'installation' | 'log' | 'chat' | 'history';

/**
 * Project page → Execution → "Execution & Installation": the office view of the project's shared
 * "Execution & Installation" task — Category → Product steps, category installation checklists, the daily
 * log, the team chat and history. Older projects may still have a separate Installation task; the log and
 * chat then switch between the two.
 */
export default function WorkProgressTab({ projectId, onChanged }: { projectId: number; onChanged?: () => void }) {
  const navigate = useNavigate();
  const { hasAuthority } = useAuth();
  const canManage = hasAuthority('PROJECT_WRITE');
  const [board, setBoard] = useState<WorkBoard | null>(null);
  const [view, setView] = useState<View>('execution');
  const [busy, setBusy] = useState(false);
  const [chatTask, setChatTask] = useState<'execution' | 'installation'>('execution');
  const [taskDetail, setTaskDetail] = useState<TaskDetail | null>(null);
  const [chatTag, setChatTag] = useState<ChatTag | null>(null);
  const [events, setEvents] = useState<WorkEvent[] | null>(null);
  const [defaultsOpen, setDefaultsOpen] = useState(false);

  const load = useCallback(() => {
    projectWorkApi.board(projectId).then(setBoard).catch(() => setBoard(null));
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const onBoard = (b: WorkBoard) => { setBoard(b); onChanged?.(); };

  const activeTask: WorkTaskInfo | null =
    board ? (chatTask === 'installation' && board.installationTask ? board.installationTask : board.executionTask) : null;

  const loadTaskDetail = useCallback(() => {
    if (activeTask) employeeTaskApi.detail(activeTask.id).then(setTaskDetail).catch(() => setTaskDetail(null));
  }, [activeTask?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (view === 'chat') loadTaskDetail(); }, [view, loadTaskDetail]);
  useEffect(() => { if (view === 'history') projectWorkApi.events(projectId).then(setEvents).catch(() => setEvents([])); }, [view, projectId]);

  const setup = async () => {
    setBusy(true);
    try { onBoard(await projectWorkApi.setup(projectId)); toast.success('Tracking set up from the quotation'); }
    catch (e) { toast.error(errMsg(e, 'Could not set up tracking')); }
    finally { setBusy(false); }
  };
  const syncQuote = async () => {
    setBusy(true);
    try { onBoard(await projectWorkApi.syncQuote(projectId)); toast.success('Products refreshed from the quotation'); }
    catch (e) { toast.error(errMsg(e, 'Could not refresh')); }
    finally { setBusy(false); }
  };

  if (!board) return <p className="p-6 text-center text-sm text-muted-foreground">Loading…</p>;

  if (!board.hasLines) {
    return (
      <div className={`${CARD} mx-auto max-w-xl p-6 text-center`}>
        <ClipboardCheck className="mx-auto h-8 w-8 text-[#9B6B32]" />
        <p className="mt-2 text-[15px] font-semibold text-[#1A211E]">Track this project by category &amp; product</p>
        <p className="mt-1 text-[13px] text-[#6B7169]">
          Creates the Execution &amp; Installation task and lists every quoted product with its steps — material
          (from purchase orders when they exist), stitching / manufacturing and delivery to site — plus an installation
          checklist per category.
        </p>
        {canManage
          ? <button onClick={setup} disabled={busy} className={`${PRIMARY} mt-4`}>Set up from the quotation</button>
          : <p className="mt-3 text-[12px] text-[#9A9E96]">Ask a project manager to set it up.</p>}
      </div>
    );
  }

  // The printable report follows what's on screen: an older project's Installation view → its task,
  // else the Execution (& Installation) task.
  const split = !!board.installationTask;
  const reportTask = split && (view === 'installation' || ((view === 'log' || view === 'chat') && chatTask === 'installation'))
    ? board.installationTask : board.executionTask;

  const views: { id: View; label: string; icon: typeof Hammer }[] = [
    { id: 'execution', label: 'Execution', icon: Hammer },
    { id: 'installation', label: 'Installation', icon: Wrench },
    { id: 'log', label: 'Daily log', icon: CalendarDays },
    { id: 'chat', label: 'Team chat', icon: MessageSquare },
    { id: 'history', label: 'History', icon: History },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 overflow-x-auto rounded-2xl bg-[#EFEBE0] p-1">
          {views.map((v) => (
            <button key={v.id} onClick={() => setView(v.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12.5px] font-semibold transition ${
                view === v.id ? 'bg-white text-[#0A573B] shadow-sm' : 'text-[#6B7169]'}`}>
              <v.icon className="h-4 w-4" /> {v.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          {reportTask && (
            <button onClick={() => navigate(`/projects/${projectId}/tasks/${reportTask.id}`)} className={GHOST}>
              <ExternalLink className="h-4 w-4" /> {!split ? 'Work report' : reportTask === board.installationTask ? 'Installation report' : 'Execution report'}
            </button>
          )}
          {canManage && (<>
            <button onClick={() => setDefaultsOpen(true)} className={GHOST}>
              <Settings2 className="h-4 w-4" /> Category defaults
            </button>
            <button onClick={syncQuote} disabled={busy} className={GHOST}>
              <RefreshCw className="h-4 w-4" /> Refresh from quotation
            </button>
          </>)}
        </div>
        <CategoryDefaultsDialog open={defaultsOpen} onOpenChange={setDefaultsOpen}
          suggest={board.categories.map((c) => c.category)} />
      </div>

      {split && (view === 'log' || view === 'chat') && (
        <div className="flex gap-1.5">
          {(['execution', 'installation'] as const).map((t) => (
            <button key={t} onClick={() => setChatTask(t)}
              className={`rounded-full px-3 py-1 text-[12px] font-medium ring-1 ${
                chatTask === t ? 'bg-[#0A573B] text-white ring-[#0A573B]' : 'bg-white text-[#6B7169] ring-[#DDE2DE]'}`}>
              {t === 'execution' ? 'Project Execution' : 'Installation'}
            </button>
          ))}
        </div>
      )}

      <div className="max-w-3xl">
        {view === 'execution' && (
          <ExecutionBoard board={board} onChange={onBoard} editable canManage={canManage}
            onChat={(l) => { setChatTask('execution'); setChatTag({ workLineId: l.id, label: l.itemName }); setView('chat'); }} />
        )}
        {view === 'installation' && (
          <InstallationBoard board={board} onChange={onBoard} editable
            onChat={(c) => { setChatTask('installation'); setChatTag({ label: c.category }); setView('chat'); }} />
        )}
        {view === 'log' && activeTask && (
          <DailyLogPanel key={activeTask.id} taskId={activeTask.id} board={board} installation={!split || chatTask === 'installation'}
            editable onSaved={load} />
        )}
        {view === 'chat' && activeTask && (
          taskDetail && taskDetail.id === activeTask.id ? (
            <TeamChat taskId={activeTask.id} comments={taskDetail.comments} onPosted={loadTaskDetail}
              locked={['COMPLETED', 'CANCELLED'].includes(taskDetail.status)} myId={taskDetail.viewerId}
              tag={chatTag} onClearTag={() => setChatTag(null)}
              tagOptions={split && chatTask === 'installation'
                ? board.install.map((c) => ({ label: c.category }))
                : [
                    ...board.categories.flatMap((c) => c.lines.map((l) => ({ workLineId: l.id, label: l.itemName }))),
                    ...(split ? [] : board.install.map((c) => ({ label: c.category }))),
                  ]} />
          ) : <p className="p-4 text-center text-[13px] text-[#9A9E96]">Loading…</p>
        )}
        {(view === 'log' || view === 'chat') && !activeTask && (
          <p className={`${CARD} p-4 text-[13px] text-[#8A8F86]`}>This task doesn't exist on the project yet — use “Refresh from quotation”.</p>
        )}
        {view === 'history' && <HistoryList events={events} />}
      </div>
    </div>
  );
}

function HistoryList({ events }: { events: WorkEvent[] | null }) {
  if (!events) return <p className="p-4 text-center text-[13px] text-[#9A9E96]">Loading…</p>;
  if (!events.length) return <p className={`${CARD} p-4 text-[13px] text-[#8A8F86]`}>Nothing recorded yet.</p>;
  return (
    <ol className={`${CARD} divide-y divide-[#F1ECE2]`}>
      {events.map((e) => (
        <li key={e.id} className="flex gap-3 p-3.5">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-[#22271F]">
              <span className="font-semibold">{e.itemName || e.category || 'Project'}</span>
              {e.stepType && e.stepType !== 'INSTALL' && <span className="text-[#6B7169]"> · {e.stepLabel}</span>}
              {' — '}{EVENT_LABELS[e.action] || e.action}{e.percent != null ? ` (${e.percent}%)` : ''}
            </p>
            {e.note && <p className="text-[12.5px] text-[#5E655D]">{e.note}</p>}
            <p className="text-[11px] text-[#9A9E96]">{e.actorName} · {fmtWhen(e.createdAt)}</p>
          </div>
          {e.photoUrl && <Thumbs urls={[e.photoUrl]} size="h-12 w-12" />}
        </li>
      ))}
    </ol>
  );
}

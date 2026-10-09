import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ClipboardCheck, Hammer, History, Layers, MessageSquare, RefreshCw, Wrench } from 'lucide-react';
import { projectWorkApi } from '@/api/projectWorkApi';
import { toast } from '@/components/ui/toast';
import { useAuth } from '@/hooks/useAuth';
import { TaskDetail } from '@/types/employeeTask';
import { WorkBoard, WorkEvent } from '@/types/projectWork';
import ExecutionBoard from './ExecutionBoard';
import InstallationBoard from './InstallationBoard';
import DailyLogPanel from './DailyLogPanel';
import TeamChat, { ChatTag } from './TeamChat';
import WorkHistoryList from './WorkHistoryList';
import { CARD, errMsg } from './workUi';

export type WorkTab = 'work' | 'install' | 'log' | 'chat' | 'history';

/**
 * The project page's Execution tab ("Execution & Installation") inside the employee task: Execution
 * (products & their steps), Installation (checklist per category), Daily log, Team chat and History — the
 * same boards the office sees. Older projects with a separate Installation task show just their own half
 * on each task. Projects not yet tracked by product show how to set it up.
 */
export default function ProjectWorkTaskView({ task, editable, locked, onReload, tab, onTab }: {
  task: TaskDetail;
  editable: boolean;
  locked: boolean;
  onReload: () => void;
  tab: WorkTab;
  onTab: (t: WorkTab) => void;
}) {
  const { hasAuthority } = useAuth();
  const canManage = hasAuthority('PROJECT_WRITE');
  const [board, setBoard] = useState<WorkBoard | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [chatTag, setChatTag] = useState<ChatTag | null>(null);
  const [events, setEvents] = useState<WorkEvent[] | null>(null);
  const [busy, setBusy] = useState(false);
  const installation = !!task.projectInstallation;
  // Execution task that also carries installation (no separate Installation task on this project).
  const combined = !installation && !!board?.combined;
  const projectId = task.projectId ?? task.project?.id;

  const loadBoard = useCallback(() => {
    if (projectId) projectWorkApi.board(projectId).then(setBoard).catch(() => {}).finally(() => setLoaded(true));
  }, [projectId]);
  useEffect(() => { loadBoard(); }, [loadBoard]);
  useEffect(() => {
    if (tab === 'history' && projectId) projectWorkApi.events(projectId).then(setEvents).catch(() => setEvents([]));
  }, [tab, projectId]);

  // Any change to the board also changes the task's % — refresh the task header too.
  const onBoard = (b: WorkBoard) => { setBoard(b); onReload(); };

  const runManage = async (fn: () => Promise<WorkBoard>, ok: string, fail: string) => {
    setBusy(true);
    try { onBoard(await fn()); toast.success(ok); }
    catch (e) { toast.error(errMsg(e, fail)); }
    finally { setBusy(false); }
  };

  const tagOptions = useMemo<ChatTag[]>(() => {
    if (!board) return [];
    const products = board.categories.flatMap((c) => c.lines.map((l) => ({ workLineId: l.id, label: l.itemName })));
    const categories = board.install.map((c) => ({ label: c.category }));
    return installation ? categories : combined ? [...products, ...categories] : products;
  }, [board, installation, combined]);

  const heading = (
    <div className="flex items-center gap-2 px-0.5">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EAF3EE] text-[#0A573B]"><Layers className="h-4 w-4" /></span>
      <p className="flex-1 text-[12px] font-bold uppercase tracking-wide text-[#1F4D38]">Execution &amp; Installation</p>
      {canManage && board?.hasLines && (
        <button onClick={() => runManage(() => projectWorkApi.syncQuote(projectId!), 'Products refreshed from the quotation', 'Could not refresh')}
          disabled={busy} className="flex items-center gap-1 text-[12px] font-semibold text-[#0A573B] disabled:opacity-50">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      )}
    </div>
  );

  if (!loaded) return null;

  // Not tracked by category → product yet: the same prompt the project page shows.
  if (!board || !board.hasLines) {
    return (
      <div className="flex flex-col gap-2.5">
        {heading}
        <div className={`${CARD} p-4 text-center`}>
          <ClipboardCheck className="mx-auto h-7 w-7 text-[#9B6B32]" />
          <p className="mt-1.5 text-[14px] font-semibold text-[#1A211E]">Not tracked by category &amp; product yet</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[#6B7169]">
            Once set up, every quoted product appears here with its steps — material, stitching / manufacturing,
            delivery — plus an installation checklist, daily log and team chat.
          </p>
          {canManage && projectId ? (
            <button onClick={() => runManage(() => projectWorkApi.setup(projectId), 'Tracking set up from the quotation', 'Could not set up tracking')}
              disabled={busy} className="mt-3 w-full rounded-xl bg-[#0A573B] py-2.5 text-[13.5px] font-semibold text-white disabled:opacity-50">
              Set up from the quotation
            </button>
          ) : (
            <p className="mt-2 text-[12px] text-[#9A9E96]">Ask your project manager to set it up.</p>
          )}
        </div>
      </div>
    );
  }

  const tabs: { id: WorkTab; label: string; icon: typeof ClipboardCheck; count?: number }[] = [
    ...(installation ? [] : [{ id: 'work' as const, label: 'Execution', icon: Hammer }]),
    ...(installation || combined ? [{ id: (installation ? 'work' : 'install') as WorkTab, label: 'Installation', icon: Wrench }] : []),
    { id: 'log', label: 'Daily log', icon: CalendarDays },
    { id: 'chat', label: 'Team chat', icon: MessageSquare, count: task.comments.length },
    { id: 'history', label: 'History', icon: History },
  ];

  return (
    <div className="flex flex-col gap-2.5">
      {heading}
      <div className="sticky top-[53px] z-[5] -mx-4 bg-[#FAF8F3]/95 px-4 py-1.5 backdrop-blur">
        <div className="grid gap-1 rounded-2xl bg-[#EFEBE0] p-1" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          {tabs.map((t) => (
            <button key={t.id} onClick={() => onTab(t.id)}
              className={`relative flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[11px] font-semibold transition ${
                tab === t.id ? 'bg-white text-[#0A573B] shadow-sm' : 'text-[#6B7169]'}`}>
              <t.icon className="h-4 w-4" />
              <span className="max-w-full truncate">{t.label}</span>
              {!!t.count && <span className="absolute right-1 top-0.5 rounded-full bg-[#BC8748] px-1 text-[9.5px] leading-[14px] text-white">{t.count}</span>}
            </button>
          ))}
        </div>
      </div>

      {tab === 'work' && (installation ? (
        <InstallationBoard board={board} onChange={onBoard} editable={editable}
          onChat={(c) => { setChatTag({ label: c.category }); onTab('chat'); }} />
      ) : (
        <ExecutionBoard board={board} onChange={onBoard} editable={editable} canManage={canManage}
          onChat={(l) => { setChatTag({ workLineId: l.id, label: l.itemName }); onTab('chat'); }} />
      ))}

      {tab === 'install' && combined && (
        <InstallationBoard board={board} onChange={onBoard} editable={editable}
          onChat={(c) => { setChatTag({ label: c.category }); onTab('chat'); }} />
      )}

      {tab === 'log' && (
        <DailyLogPanel taskId={task.id} board={board} installation={installation || combined} editable={editable}
          onSaved={() => { loadBoard(); onReload(); }} />
      )}

      {tab === 'chat' && (
        <TeamChat taskId={task.id} comments={task.comments} onPosted={onReload} locked={locked}
          tag={chatTag} onClearTag={() => setChatTag(null)} tagOptions={tagOptions} myId={task.viewerId} />
      )}

      {tab === 'history' && <WorkHistoryList events={events} />}
    </div>
  );
}

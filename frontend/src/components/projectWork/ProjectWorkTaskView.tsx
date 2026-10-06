import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ClipboardCheck, MessageSquare, Wrench } from 'lucide-react';
import { projectWorkApi } from '@/api/projectWorkApi';
import { TaskDetail } from '@/types/employeeTask';
import { WorkBoard } from '@/types/projectWork';
import ExecutionBoard from './ExecutionBoard';
import InstallationBoard from './InstallationBoard';
import DailyLogPanel from './DailyLogPanel';
import TeamChat, { ChatTag } from './TeamChat';

export type WorkTab = 'work' | 'install' | 'log' | 'chat';

/**
 * The body of a project's "Execution & Installation" task — the same picture the project page shows under
 * Execution: products & their steps, the installation checklist per category, the daily log and the team
 * chat. Older projects with a separate Installation task show just their own half on each task.
 */
export default function ProjectWorkTaskView({ task, editable, locked, onReload, tab, onTab }: {
  task: TaskDetail;
  editable: boolean;
  locked: boolean;
  onReload: () => void;
  tab: WorkTab;
  onTab: (t: WorkTab) => void;
}) {
  const [board, setBoard] = useState<WorkBoard | null>(null);
  const [chatTag, setChatTag] = useState<ChatTag | null>(null);
  const installation = !!task.projectInstallation;
  // Execution task that also carries installation (no separate Installation task on this project).
  const combined = !installation && !!board?.combined;
  const projectId = task.projectId ?? task.project?.id;

  const loadBoard = useCallback(() => {
    if (projectId) projectWorkApi.board(projectId).then(setBoard).catch(() => {});
  }, [projectId]);
  useEffect(() => { loadBoard(); }, [loadBoard]);

  // Any change to the board also changes the task's % — refresh the task header too.
  const onBoard = (b: WorkBoard) => { setBoard(b); onReload(); };

  const tagOptions = useMemo<ChatTag[]>(() => {
    if (!board) return [];
    const products = board.categories.flatMap((c) => c.lines.map((l) => ({ workLineId: l.id, label: l.itemName })));
    const categories = board.install.map((c) => ({ label: c.category }));
    return installation ? categories : combined ? [...products, ...categories] : products;
  }, [board, installation, combined]);

  const tabs: { id: WorkTab; label: string; icon: typeof ClipboardCheck; count?: number }[] = [
    { id: 'work', label: installation ? 'Checklist' : 'Products', icon: ClipboardCheck },
    ...(combined ? [{ id: 'install' as const, label: 'Install', icon: Wrench }] : []),
    { id: 'log', label: 'Daily log', icon: CalendarDays },
    { id: 'chat', label: 'Chat', icon: MessageSquare, count: task.comments.length },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="sticky top-[53px] z-[5] -mx-4 bg-[#FAF8F3]/95 px-4 py-1.5 backdrop-blur">
        <div className={`grid ${tabs.length === 4 ? 'grid-cols-4' : 'grid-cols-3'} gap-1 rounded-2xl bg-[#EFEBE0] p-1`}>
          {tabs.map((t) => (
            <button key={t.id} onClick={() => onTab(t.id)}
              className={`flex items-center justify-center gap-1 rounded-xl py-2 text-[12px] font-semibold transition ${
                tab === t.id ? 'bg-white text-[#0A573B] shadow-sm' : 'text-[#6B7169]'}`}>
              <t.icon className="h-4 w-4" /> {t.label}
              {!!t.count && <span className="rounded-full bg-[#F3EEE2] px-1.5 text-[10.5px] text-[#8A6A2E]">{t.count}</span>}
            </button>
          ))}
        </div>
      </div>

      {tab === 'work' && (!board ? (
        <p className="p-4 text-center text-[13px] text-[#9A9E96]">Loading…</p>
      ) : installation ? (
        <InstallationBoard board={board} onChange={onBoard} editable={editable}
          onChat={(c) => { setChatTag({ label: c.category }); onTab('chat'); }} />
      ) : (
        <ExecutionBoard board={board} onChange={onBoard} editable={editable}
          onChat={(l) => { setChatTag({ workLineId: l.id, label: l.itemName }); onTab('chat'); }} />
      ))}

      {tab === 'install' && combined && board && (
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
    </div>
  );
}

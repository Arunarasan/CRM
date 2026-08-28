import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Users, AlertTriangle } from 'lucide-react';
import { employeeTaskApi } from '@/api/employeeTaskApi';
import { TaskCard as TaskCardType, Capacity } from '@/types/employeeTask';
import { runOrQueue } from '@/hooks/useOfflineQueue';
import TaskCard from './components/TaskCard';

// The five-tab task hub (spec §27): Available (shared pool) · My Tasks · Collaborative · Overdue ·
// Completed. Available is fed by /pool (eligible + unassigned); the rest filter the employee's own
// assignments client-side off /my-tasks.
const TABS = ['AVAILABLE', 'MY_TASKS', 'COLLAB', 'OVERDUE', 'COMPLETED'] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = {
  AVAILABLE: 'Available', MY_TASKS: 'My Tasks', COLLAB: 'Collaborative', OVERDUE: 'Overdue', COMPLETED: 'Completed',
};

export default function TaskList() {
  const [params, setParams] = useSearchParams();
  const [pool, setPool] = useState<TaskCardType[]>([]);
  const [mine, setMine] = useState<TaskCardType[]>([]);
  const [capacity, setCapacity] = useState<Capacity | null>(null);
  const [error, setError] = useState('');
  const search = params.get('search') ?? '';
  const tab = (params.get('tab') as Tab) || (params.get('status') === 'COMPLETED' ? 'COMPLETED' : 'AVAILABLE');

  const setTab = (t: Tab) => setParams((p) => { const n = new URLSearchParams(p); n.set('tab', t); n.delete('status'); return n; });

  const load = useCallback(() => {
    employeeTaskApi.capacity().then(setCapacity).catch(() => {});
    employeeTaskApi.pool().then(setPool).catch(() => {});
    employeeTaskApi.myTasks({ search: search || undefined }).then(setMine).catch(() => {});
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const withRefresh = (fn: () => Promise<unknown>) => fn().then(() => setError('')).catch((e: any) => setError(e?.message || 'Action failed')).finally(load);
  const onStart = (id: number) => withRefresh(() => runOrQueue({ method: 'post', url: `/employee-tasks/${id}/start`, description: 'Start task' }));
  const onPause = (id: number) => withRefresh(() => runOrQueue({ method: 'post', url: `/employee-tasks/${id}/pause`, description: 'Pause task' }));
  const onComplete = (id: number) => withRefresh(() => runOrQueue({ method: 'post', url: `/employee-tasks/${id}/complete`, description: 'Complete task' }));
  const onPick = (id: number) => withRefresh(() => employeeTaskApi.pick(id));

  const collaborative = (t: TaskCardType) => (t.assignedEmployees?.length ?? 0) > 1;
  const shown: TaskCardType[] = (() => {
    switch (tab) {
      case 'AVAILABLE': return pool;
      case 'MY_TASKS': return mine.filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');
      case 'COLLAB': return mine.filter(collaborative);
      case 'OVERDUE': return mine.filter((t) => t.dueState === 'OVERDUE');
      case 'COMPLETED': return mine.filter((t) => t.status === 'COMPLETED');
      default: return [];
    }
  })();

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Capacity meter */}
      {capacity && (
        <div className="flex items-center justify-between rounded-xl border bg-card px-3 py-2.5 shadow-sm">
          <span className="text-xs font-medium text-muted-foreground">Task capacity</span>
          <div className="flex items-center gap-2">
            <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
              <div className={`h-full rounded-full ${capacity.canPick ? 'bg-primary' : 'bg-red-500'}`}
                   style={{ width: `${Math.min(100, (capacity.active / Math.max(1, capacity.max)) * 100)}%` }} />
            </div>
            <span className="text-sm font-bold">{capacity.active} / {capacity.max}</span>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2.5 shadow-sm">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          defaultValue={search}
          onChange={(e) => setParams((p) => { const n = new URLSearchParams(p); if (e.target.value) n.set('search', e.target.value); else n.delete('search'); return n; })}
          placeholder="Search tasks…"
          className="flex-1 bg-transparent text-sm outline-none"
        />
      </div>

      {/* Tabs */}
      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1">
        {TABS.map((t) => {
          const count = t === 'AVAILABLE' ? pool.length
            : t === 'MY_TASKS' ? mine.filter((x) => x.status !== 'COMPLETED' && x.status !== 'CANCELLED').length
            : t === 'COLLAB' ? mine.filter(collaborative).length
            : t === 'OVERDUE' ? mine.filter((x) => x.dueState === 'OVERDUE').length
            : mine.filter((x) => x.status === 'COMPLETED').length;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${tab === t ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'}`}
            >
              {TAB_LABEL[t]}{count ? ` ${count}` : ''}
            </button>
          );
        })}
      </div>

      {error && <p className="rounded-md bg-destructive/15 p-2 text-xs text-destructive">{error}</p>}

      {tab === 'COLLAB' && shown.length > 0 && (
        <p className="flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground"><Users className="h-3.5 w-3.5" /> Tasks you share with others.</p>
      )}
      {tab === 'OVERDUE' && shown.length > 0 && (
        <p className="flex items-center gap-1.5 px-1 text-[11px] text-red-600"><AlertTriangle className="h-3.5 w-3.5" /> Past due — please act or mark blocked.</p>
      )}

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        {shown.length > 0 ? (
          shown.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onStart={onStart}
              onPause={onPause}
              onComplete={onComplete}
              onPick={tab === 'AVAILABLE' ? onPick : undefined}
            />
          ))
        ) : (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {tab === 'AVAILABLE' ? 'No available tasks for you right now.' : 'Nothing here.'}
          </p>
        )}
      </div>
    </div>
  );
}

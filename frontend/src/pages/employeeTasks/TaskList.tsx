import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { employeeTaskApi } from '@/api/employeeTaskApi';
import { TaskCard as TaskCardType, TaskStatus } from '@/types/employeeTask';
import { runOrQueue } from '@/hooks/useOfflineQueue';
import TaskCard from './components/TaskCard';

const STATUS_FILTERS: { label: string; value: TaskStatus | '' }[] = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Accepted', value: 'ACCEPTED' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Paused', value: 'PAUSED' },
  { label: 'Waiting', value: 'WAITING_APPROVAL' },
  { label: 'Completed', value: 'COMPLETED' },
];

export default function TaskList() {
  const [params, setParams] = useSearchParams();
  const [tasks, setTasks] = useState<TaskCardType[]>([]);
  const status = params.get('status') ?? '';
  const search = params.get('search') ?? '';

  const load = useCallback(() => {
    employeeTaskApi.myTasks({ status: status || undefined, search: search || undefined })
      .then(setTasks).catch(() => {});
  }, [status, search]);

  useEffect(() => { load(); }, [load]);

  const withRefresh = (fn: () => Promise<unknown>) => fn().finally(load);
  const onStart = (id: number) => withRefresh(() => runOrQueue({ method: 'post', url: `/employee-tasks/${id}/start`, description: 'Start task' }));
  const onPause = (id: number) => withRefresh(() => runOrQueue({ method: 'post', url: `/employee-tasks/${id}/pause`, description: 'Pause task' }));
  const onComplete = (id: number) => withRefresh(() => runOrQueue({ method: 'post', url: `/employee-tasks/${id}/complete`, description: 'Complete task' }));

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2.5 shadow-sm">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          defaultValue={search}
          onChange={(e) => setParams((p) => { const n = new URLSearchParams(p); if (e.target.value) n.set('search', e.target.value); else n.delete('search'); return n; })}
          placeholder="Search my tasks…"
          className="flex-1 bg-transparent text-sm outline-none"
        />
      </div>

      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => setParams((p) => { const n = new URLSearchParams(p); if (f.value) n.set('status', f.value); else n.delete('status'); return n; })}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${status === f.value ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        {tasks.length > 0 ? (
          tasks.map((task) => (
            <TaskCard key={task.id} task={task} onStart={onStart} onPause={onPause} onComplete={onComplete} />
          ))
        ) : (
          <p className="p-6 text-center text-sm text-muted-foreground">No tasks found.</p>
        )}
      </div>
    </div>
  );
}

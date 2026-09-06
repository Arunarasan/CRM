import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, X, Flame, CalendarDays, Clock, AlertTriangle, CheckCircle2, Hand, PartyPopper } from 'lucide-react';
import { employeeTaskApi } from '@/api/employeeTaskApi';
import { TaskCard as TaskCardType, Capacity } from '@/types/employeeTask';
import { runOrQueue } from '@/hooks/useOfflineQueue';
import TaskCard from './components/TaskCard';
import { daysUntil, priorityMeta } from './taskUtils';

// "Tasks to Do" — one screen that answers, top to bottom, what the employee should work on next.
// Filters are chips (not routes); the default "To Do" view groups active work by urgency so the
// most important task is always first. The shared "Available" pool and "Completed" history are
// reachable from the same chip row. All task logic (pick / start / pause / complete) is unchanged.
type Filter = 'TODO' | 'OVERDUE' | 'TODAY' | 'UPCOMING' | 'AVAILABLE' | 'COMPLETED';

const isActive = (t: TaskCardType) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED';

/** Which urgency bucket an active task falls into. */
function bucket(t: TaskCardType): 'overdue' | 'now' | 'today' | 'upcoming' {
  if (t.dueState === 'OVERDUE') return 'overdue';
  const d = daysUntil(t.dueDate);
  if (d === 0) return 'today';
  if (t.myAssignmentStatus === 'IN_PROGRESS' || priorityMeta(t.priority).urgent) return 'now';
  return 'upcoming';
}

export default function TaskList() {
  const [params, setParams] = useSearchParams();
  const [pool, setPool] = useState<TaskCardType[]>([]);
  const [mine, setMine] = useState<TaskCardType[]>([]);
  const [capacity, setCapacity] = useState<Capacity | null>(null);
  const [error, setError] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const search = params.get('search') ?? '';
  const filter = (params.get('tab') as Filter) || (params.get('status') === 'COMPLETED' ? 'COMPLETED' : 'TODO');

  const setFilter = (f: Filter) =>
    setParams((p) => { const n = new URLSearchParams(p); n.set('tab', f); n.delete('status'); return n; });
  const setSearch = (v: string) =>
    setParams((p) => { const n = new URLSearchParams(p); if (v) n.set('search', v); else n.delete('search'); return n; });

  useEffect(() => { if (search || params.get('search') === '1') setShowSearch(true); }, [search, params]);

  const load = useCallback(() => {
    employeeTaskApi.capacity().then(setCapacity).catch(() => {});
    employeeTaskApi.pool().then(setPool).catch(() => {});
    employeeTaskApi.myTasks({ search: search || undefined }).then(setMine).catch(() => {});
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const withRefresh = (fn: () => Promise<unknown>) =>
    fn().then(() => setError('')).catch((e: any) => setError(e?.message || 'Action failed')).finally(load);
  const onStart = (id: number) => withRefresh(() => runOrQueue({ method: 'post', url: `/employee-tasks/${id}/start`, description: 'Start task' }));
  const onPause = (id: number) => withRefresh(() => runOrQueue({ method: 'post', url: `/employee-tasks/${id}/pause`, description: 'Pause task' }));
  const onComplete = (id: number) => withRefresh(() => runOrQueue({ method: 'post', url: `/employee-tasks/${id}/complete`, description: 'Complete task' }));
  const onPick = (id: number) => withRefresh(() => employeeTaskApi.pick(id));
  const onExtend = (id: number) => withRefresh(() => employeeTaskApi.extendHold(id));

  const active = mine.filter(isActive);
  const overdue = active.filter((t) => bucket(t) === 'overdue');
  const now = active.filter((t) => bucket(t) === 'now');
  const today = active.filter((t) => bucket(t) === 'today');
  const upcoming = active.filter((t) => bucket(t) === 'upcoming');
  const completed = mine.filter((t) => t.status === 'COMPLETED');

  const chips: { key: Filter; label: string; count: number }[] = [
    { key: 'TODO', label: 'To Do', count: active.length },
    { key: 'OVERDUE', label: 'Overdue', count: overdue.length },
    { key: 'TODAY', label: 'Today', count: today.length + now.length },
    { key: 'UPCOMING', label: 'Upcoming', count: upcoming.length },
    { key: 'AVAILABLE', label: 'Available', count: pool.length },
    { key: 'COMPLETED', label: 'Done', count: completed.length },
  ];

  const cards = (list: TaskCardType[], pick = false) =>
    list.map((task) => (
      <TaskCard key={task.id} task={task} onStart={onStart} onPause={onPause}
        onComplete={onComplete} onPick={pick ? onPick : undefined} onExtend={onExtend} />
    ));

  const Group = ({ icon: Icon, tone, title, list, pick = false }: {
    icon: React.ComponentType<{ className?: string }>; tone: string; title: string;
    list: TaskCardType[]; pick?: boolean;
  }) => {
    if (list.length === 0) return null;
    return (
      <section>
        <div className="mb-2 flex items-center gap-2 px-1">
          <Icon className={`h-[18px] w-[18px] ${tone}`} />
          <h2 className="text-[15px] font-bold text-[#111817]">{title}</h2>
          <span className="rounded-full bg-[#EEF0EE] px-2 py-0.5 text-[11px] font-semibold text-[#5B625E]">{list.length}</span>
        </div>
        <div className="overflow-hidden rounded-2xl border border-[#ECEAE5] bg-white shadow-[0_2px_10px_rgba(0,35,22,0.04)]">
          {cards(list, pick)}
        </div>
      </section>
    );
  };

  const empty = (msg: string, celebrate = false) => (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-[#ECEAE5] bg-white px-6 py-12 text-center shadow-sm">
      {celebrate ? <PartyPopper className="h-9 w-9 text-[#0A573B]" /> : <CheckCircle2 className="h-9 w-9 text-[#B9C0BB]" />}
      <p className="text-[15px] font-semibold text-[#111817]">{celebrate ? "You're all caught up" : 'Nothing here'}</p>
      <p className="text-[13px] text-[#7A817C]">{msg}</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-4 p-3.5">
      {/* Title + capacity + search toggle */}
      <div className="flex items-center justify-between px-0.5">
        <div>
          <h1 className="text-[22px] font-bold leading-tight text-[#111817]">Tasks to Do</h1>
          {capacity && (
            <p className="mt-0.5 text-[12px] text-[#7A817C]">
              {capacity.active} active · {capacity.max - capacity.active > 0
                ? `${capacity.max - capacity.active} more you can take`
                : 'at capacity'}
            </p>
          )}
        </div>
        <button
          onClick={() => { setShowSearch((s) => { const n = !s; if (!n) setSearch(''); return n; }); }}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#0A573B] shadow-sm active:scale-95"
          aria-label={showSearch ? 'Close search' : 'Search tasks'}
        >
          {showSearch ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
        </button>
      </div>

      {showSearch && (
        <div className="flex items-center gap-2 rounded-xl border border-[#DDE2DE] bg-white px-3 py-2.5 shadow-sm">
          <Search className="h-4 w-4 text-[#7A817C]" />
          <input
            autoFocus
            defaultValue={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your tasks…"
            className="flex-1 bg-transparent text-sm text-[#111817] outline-none"
          />
        </div>
      )}

      {/* Filter chips */}
      <div className="-mx-3.5 flex gap-2 overflow-x-auto px-3.5 pb-1">
        {chips.map((c) => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
              filter === c.key ? 'bg-[#0A573B] text-white' : 'bg-white text-[#5B625E] shadow-sm'
            }`}
          >
            {c.label}
            {c.count > 0 && (
              <span className={`rounded-full px-1.5 text-[11px] ${filter === c.key ? 'bg-white/20' : 'bg-[#EEF0EE] text-[#5B625E]'}`}>
                {c.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && <p className="rounded-md bg-[#FBE2E0] p-2 text-xs text-[#B94B45]">{error}</p>}

      {/* Body */}
      {filter === 'TODO' && (
        active.length === 0
          ? empty('No tasks need your attention right now. Enjoy the breather!', true)
          : (
            <div className="flex flex-col gap-5">
              <Group icon={AlertTriangle} tone="text-[#B94B45]" title="Overdue" list={overdue} />
              <Group icon={Flame} tone="text-[#EA6A2D]" title="Do Now" list={now} />
              <Group icon={CalendarDays} tone="text-[#0A573B]" title="Today" list={today} />
              <Group icon={Clock} tone="text-[#7A817C]" title="Upcoming" list={upcoming} />
            </div>
          )
      )}
      {filter === 'OVERDUE' && (overdue.length ? (
        <div className="overflow-hidden rounded-2xl border border-[#ECEAE5] bg-white shadow-sm">{cards(overdue)}</div>
      ) : empty('No overdue tasks — nicely on top of things.', true))}
      {filter === 'TODAY' && ((today.length + now.length) ? (
        <div className="overflow-hidden rounded-2xl border border-[#ECEAE5] bg-white shadow-sm">{cards([...now, ...today])}</div>
      ) : empty('Nothing scheduled for today.', true))}
      {filter === 'UPCOMING' && (upcoming.length ? (
        <div className="overflow-hidden rounded-2xl border border-[#ECEAE5] bg-white shadow-sm">{cards(upcoming)}</div>
      ) : empty('No upcoming tasks yet.'))}
      {filter === 'AVAILABLE' && (
        <>
          <p className="flex items-center gap-1.5 px-1 text-[12px] text-[#7A817C]">
            <Hand className="h-3.5 w-3.5" /> Unassigned work you can pick up.
          </p>
          {pool.length ? (
            <div className="mt-2 overflow-hidden rounded-2xl border border-[#ECEAE5] bg-white shadow-sm">{cards(pool, true)}</div>
          ) : empty('No available tasks for you right now.')}
        </>
      )}
      {filter === 'COMPLETED' && (completed.length ? (
        <div className="overflow-hidden rounded-2xl border border-[#ECEAE5] bg-white shadow-sm">{cards(completed)}</div>
      ) : empty('No completed tasks yet.'))}
    </div>
  );
}

import { BaseInput } from '@/components/ui/input';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search, X, Flame, CalendarDays, Clock, AlertTriangle, CheckCircle2, Hand, PartyPopper,
  FolderKanban, ListTodo, ShoppingBag, UserRound,
} from 'lucide-react';
import { employeeTaskApi } from '@/api/employeeTaskApi';
import { TaskCard as TaskCardType, Capacity } from '@/types/employeeTask';
import { runOrQueue } from '@/hooks/useOfflineQueue';
import TaskCard from './components/TaskCard';
import { daysUntil, priorityMeta } from './taskUtils';

// "Tasks to Do" — four type tabs (My Tasks / Projects / Orders / Leads), each with the same
// Active · Available · Done views. Active work is grouped by urgency so the most important task
// is always first. All task logic (pick / start / pause / complete) is unchanged.
type Tab = 'MINE' | 'PROJECTS' | 'ORDERS' | 'LEADS';
type View = 'ACTIVE' | 'AVAILABLE' | 'DONE';

// Which origin lanes (TaskCard.category) belong to each tab. "My Tasks" shows every lane.
const LANES: Record<Exclude<Tab, 'MINE'>, string[]> = {
  PROJECTS: ['PROJECT', 'FIELD_WORK'],
  ORDERS: ['STITCHING', 'INSTALLATION'],
  LEADS: ['LEAD', 'ENQUIRY', 'CALL'],
};

const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }>; empty: string }[] = [
  { key: 'MINE', label: 'My Tasks', icon: ListTodo, empty: 'tasks' },
  { key: 'PROJECTS', label: 'Projects', icon: FolderKanban, empty: 'project tasks' },
  { key: 'ORDERS', label: 'Orders', icon: ShoppingBag, empty: 'order tasks' },
  { key: 'LEADS', label: 'Leads', icon: UserRound, empty: 'lead tasks' },
];

const inTab = (tab: Tab) => (t: TaskCardType) =>
  tab === 'MINE' || LANES[tab].includes((t.category ?? '').toUpperCase());

const isActive = (t: TaskCardType) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED';

/** Which urgency bucket an active task falls into. */
function bucket(t: TaskCardType): 'overdue' | 'now' | 'today' | 'upcoming' {
  if (t.dueState === 'OVERDUE') return 'overdue';
  const d = daysUntil(t.dueDate);
  if (d === 0) return 'today';
  if (t.myAssignmentStatus === 'IN_PROGRESS' || priorityMeta(t.priority).urgent) return 'now';
  return 'upcoming';
}

/** Read tab/view from the URL, accepting the older ?tab=PROJECTS|AVAILABLE|… and ?status=COMPLETED links. */
function readParams(params: URLSearchParams): { tab: Tab; view: View } {
  const rawTab = (params.get('tab') || '').toUpperCase();
  const rawView = (params.get('view') || '').toUpperCase();
  const tab: Tab = (['MINE', 'PROJECTS', 'ORDERS', 'LEADS'] as Tab[]).includes(rawTab as Tab) ? (rawTab as Tab) : 'MINE';
  let view: View = (['ACTIVE', 'AVAILABLE', 'DONE'] as View[]).includes(rawView as View) ? (rawView as View) : 'ACTIVE';
  if (!params.get('view')) {
    if (rawTab === 'AVAILABLE') view = 'AVAILABLE';
    if (rawTab === 'COMPLETED' || params.get('status') === 'COMPLETED') view = 'DONE';
  }
  return { tab, view };
}

export default function TaskList() {
  const [params, setParams] = useSearchParams();
  const [pool, setPool] = useState<TaskCardType[]>([]);
  const [mine, setMine] = useState<TaskCardType[]>([]);
  const [capacity, setCapacity] = useState<Capacity | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const search = params.get('search') === '1' ? '' : (params.get('search') ?? '');
  const { tab, view } = readParams(params);

  const update = (patch: Record<string, string | null>) =>
    setParams((p) => {
      const n = new URLSearchParams(p);
      Object.entries(patch).forEach(([k, v]) => (v == null ? n.delete(k) : n.set(k, v)));
      n.delete('status');
      return n;
    }, { replace: true });
  const setTab = (t: Tab) => update({ tab: t, view: view === 'ACTIVE' ? null : view });
  const setView = (v: View) => update({ tab, view: v === 'ACTIVE' ? null : v });
  const setSearch = (v: string) => update({ search: v || null });

  useEffect(() => { if (search || params.get('search') === '1') setShowSearch(true); }, [search, params]);

  const load = useCallback(() => {
    employeeTaskApi.capacity().then(setCapacity).catch(() => {});
    Promise.allSettled([
      employeeTaskApi.pool().then(setPool),
      employeeTaskApi.myTasks({ search: search || undefined }).then(setMine),
    ]).finally(() => setLoaded(true));
  }, [search]);

  useEffect(() => { load(); }, [load]);

  // Keep the list honest when the office acts on a task (an admin completes or reassigns it):
  // refresh when the employee comes back to the app, and quietly every 30s while it's open.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') load(); }, 30_000);
    return () => { document.removeEventListener('visibilitychange', onVisible); window.clearInterval(timer); };
  }, [load]);

  const withRefresh = (fn: () => Promise<unknown>) =>
    fn().then(() => setError('')).catch((e: any) => setError(e?.message || 'Action failed')).finally(load);
  const onStart = (id: number) => withRefresh(() => runOrQueue({ method: 'post', url: `/employee-tasks/${id}/start`, description: 'Start task' }));
  const onPause = (id: number) => withRefresh(() => runOrQueue({ method: 'post', url: `/employee-tasks/${id}/pause`, description: 'Pause task' }));
  const onComplete = (id: number) => withRefresh(() => runOrQueue({ method: 'post', url: `/employee-tasks/${id}/complete`, description: 'Complete task' }));
  const onExtend = (id: number) => withRefresh(() => employeeTaskApi.extendHold(id));

  // Per-tab counts for the tab bar (active work assigned to me).
  const activeMine = mine.filter(isActive);
  const tabCount = (t: Tab) => activeMine.filter(inTab(t)).length;
  const tabOverdue = (t: Tab) => activeMine.filter(inTab(t)).some((x) => bucket(x) === 'overdue');

  // Everything below is scoped to the selected tab.
  const active = activeMine.filter(inTab(tab));
  const available = pool.filter(inTab(tab));
  const completed = mine.filter((t) => t.status === 'COMPLETED').filter(inTab(tab));
  const overdue = active.filter((t) => bucket(t) === 'overdue');
  const now = active.filter((t) => bucket(t) === 'now');
  const today = active.filter((t) => bucket(t) === 'today');
  const upcoming = active.filter((t) => bucket(t) === 'upcoming');
  const inProgress = active.filter((t) => t.myAssignmentStatus === 'IN_PROGRESS').length;
  const meta = TABS.find((t) => t.key === tab)!;

  const cards = (list: TaskCardType[]) => (
    <div className="flex flex-col gap-3">
      {list.map((task) => (
        <TaskCard key={task.id} task={task}
          onStart={onStart} onPause={onPause} onComplete={onComplete} onExtend={onExtend} />
      ))}
    </div>
  );

  const Group = ({ icon: Icon, tone, title, list }: {
    icon: React.ComponentType<{ className?: string }>; tone: string; title: string; list: TaskCardType[];
  }) => {
    if (list.length === 0) return null;
    return (
      <section>
        <div className="mb-2 flex items-center gap-2 px-1">
          <Icon className={`h-[18px] w-[18px] ${tone}`} />
          <h2 className="text-[15px] font-bold text-[#111817]">{title}</h2>
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#EEF0EE] px-1.5 text-[11px] font-semibold text-[#5B625E]">{list.length}</span>
        </div>
        {cards(list)}
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

  const skeleton = (
    <div className="flex flex-col gap-3">
      {[0, 1, 2].map((i) => <div key={i} className="h-[112px] animate-pulse rounded-2xl bg-white/70" />)}
    </div>
  );

  const views: { key: View; label: string; count: number }[] = [
    { key: 'ACTIVE', label: 'Active', count: active.length },
    { key: 'AVAILABLE', label: 'Available', count: available.length },
    { key: 'DONE', label: 'Done', count: completed.length },
  ];

  const stats: { label: string; value: number; tone: string }[] = [
    { label: 'Overdue', value: overdue.length, tone: overdue.length ? 'text-[#C9302C]' : 'text-[#111817]' },
    { label: 'Today', value: today.length, tone: 'text-[#111817]' },
    { label: 'In progress', value: inProgress, tone: 'text-[#0A573B]' },
    { label: 'Can pick', value: available.length, tone: 'text-[#9B6B32]' },
  ];

  return (
    <div className="flex flex-col gap-3.5 p-3.5">
      {/* Title + capacity + search toggle */}
      <div className="flex items-center justify-between px-0.5">
        <div className="min-w-0">
          <h1 className="text-[24px] font-bold leading-tight tracking-tight text-[#111817]">Tasks to Do</h1>
          {capacity && (
            <p className="mt-0.5 text-[13px] text-[#7A817C]">
              {capacity.active} active · {capacity.max - capacity.active > 0
                ? `${capacity.max - capacity.active} more you can take`
                : 'at capacity'}
            </p>
          )}
        </div>
        <button
          onClick={() => { setShowSearch((s) => { const n = !s; if (!n) setSearch(''); return n; }); }}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#0A573B] shadow-[0_2px_10px_rgba(0,35,22,0.08)] active:scale-95"
          aria-label={showSearch ? 'Close search' : 'Search tasks'}
        >
          {showSearch ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
        </button>
      </div>

      {showSearch && (
        <div className="flex items-center gap-2 rounded-xl border border-[#DDE2DE] bg-white px-3 py-2.5 shadow-sm">
          <Search className="h-4 w-4 text-[#7A817C]" />
          <BaseInput
            autoFocus
            defaultValue={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer, task or site…"
            className="flex-1 bg-transparent text-sm text-[#111817] outline-none"
          />
        </div>
      )}

      {/* Type tabs — My Tasks / Projects / Orders / Leads */}
      <div className="sticky top-0 z-10 -mx-3.5 bg-[#F7F7F5]/95 px-3.5 pb-1 pt-0.5 backdrop-blur" role="tablist">
        <div className="grid grid-cols-4 gap-1 rounded-2xl bg-white p-1 shadow-[0_2px_10px_rgba(0,35,22,0.06)]">
          {TABS.map(({ key, label, icon: Icon }) => {
            const on = tab === key;
            const n = tabCount(key);
            return (
              <button
                key={key}
                role="tab"
                aria-selected={on}
                onClick={() => setTab(key)}
                className={`relative flex flex-col items-center gap-0.5 rounded-xl px-1 py-2 transition-colors ${
                  on ? 'bg-[#0A573B] text-white shadow-[0_2px_8px_rgba(10,87,59,0.3)]' : 'text-[#5B625E] active:bg-[#F2F4F2]'
                }`}
              >
                <Icon className="h-[18px] w-[18px]" />
                <span className="text-[12px] font-semibold leading-tight">{label}</span>
                {n > 0 && (
                  <span className={`absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                    on ? 'bg-white/25 text-white' : tabOverdue(key) ? 'bg-[#D64541] text-white' : 'bg-[#EEF0EE] text-[#3F4642]'
                  }`}>
                    {n}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* At-a-glance numbers for the selected tab */}
      <div className="grid grid-cols-4 divide-x divide-[#EEEDE8] rounded-2xl border border-[#ECEAE5] bg-white py-2.5 shadow-sm">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col items-center">
            <span className={`text-[18px] font-bold leading-tight ${s.tone}`}>{s.value}</span>
            <span className="text-[11px] text-[#7A817C]">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Active · Available · Done */}
      <div className="flex gap-2">
        {views.map((v) => {
          const on = view === v.key;
          return (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                on ? 'border-[#0A573B] bg-[#E7F2EC] text-[#0A573B]' : 'border-[#E3E5E1] bg-white text-[#5B625E]'
              }`}
            >
              {v.label}
              <span className={`text-[11px] ${on ? 'text-[#0A573B]' : 'text-[#8A918C]'}`}>{v.count}</span>
            </button>
          );
        })}
      </div>

      {error && <p className="rounded-md bg-[#FBE2E0] p-2 text-xs text-[#B94B45]">{error}</p>}

      {/* Body */}
      {!loaded ? skeleton : (
        <>
          {view === 'ACTIVE' && (
            active.length === 0
              ? empty(available.length
                  ? `No ${meta.empty} in hand — ${available.length} available to pick up.`
                  : `No ${meta.empty} need your attention right now.`, true)
              : (
                <div className="flex flex-col gap-5">
                  <Group icon={AlertTriangle} tone="text-[#D64541]" title="Overdue" list={overdue} />
                  <Group icon={Flame} tone="text-[#EA6A2D]" title="Do Now" list={now} />
                  <Group icon={CalendarDays} tone="text-[#0A573B]" title="Today" list={today} />
                  <Group icon={Clock} tone="text-[#7A817C]" title="Upcoming" list={upcoming} />
                </div>
              )
          )}
          {view === 'AVAILABLE' && (
            <>
              <p className="flex items-center gap-1.5 px-1 text-[12px] text-[#7A817C]">
                <Hand className="h-3.5 w-3.5" /> Unassigned work you can pick up — open a task to take it.
              </p>
              {available.length ? cards(available) : empty(`No ${meta.empty} available right now.`)}
            </>
          )}
          {view === 'DONE' && (completed.length ? cards(completed) : empty(`No completed ${meta.empty} yet.`))}
        </>
      )}
    </div>
  );
}

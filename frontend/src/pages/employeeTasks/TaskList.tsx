import { BaseInput } from '@/components/ui/input';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search, X, Flame, CalendarDays, Clock, AlertTriangle, CheckCircle2, Hand, PartyPopper,
  FolderKanban, ListTodo, ShoppingBag, Ruler,
} from 'lucide-react';
import { employeeTaskApi } from '@/api/employeeTaskApi';
import { TaskCard as TaskCardType, Capacity } from '@/types/employeeTask';
import { runOrQueue } from '@/hooks/useOfflineQueue';
import TaskCard from './components/TaskCard';
import { daysUntil, priorityMeta } from './taskUtils';
import { useT } from '@/i18n';

// "Tasks to Do" — four type tabs (Collect Requirement / Measured / Projects / Orders), each with the same
// Active · Available · Done views. Active work is grouped by urgency so the most important task
// is always first. All task logic (pick / start / pause / complete) is unchanged.
type Tab = 'REQUIREMENT' | 'MEASURE' | 'PROJECTS' | 'ORDERS';
type View = 'ACTIVE' | 'AVAILABLE' | 'DONE';

// Project / Orders tabs are origin lanes (TaskCard.category). The two lead tabs split the lead
// lanes by task type: Collect Requirement vs. everything after it (site visit, measure, quote).
const LANES: Record<'PROJECTS' | 'ORDERS', string[]> = {
  PROJECTS: ['PROJECT', 'FIELD_WORK'],
  ORDERS: ['STITCHING', 'INSTALLATION'],
};
const LEAD_LANES = ['LEAD', 'ENQUIRY', 'CALL'];
const REQUIREMENT_CODES = ['TT_COLLECT_REQUIREMENT', 'TT_UNDERSTAND_REQ'];

const TABS: { key: Tab; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'REQUIREMENT', icon: ListTodo },
  { key: 'MEASURE', icon: Ruler },
  { key: 'PROJECTS', icon: FolderKanban },
  { key: 'ORDERS', icon: ShoppingBag },
];

const inTab = (tab: Tab) => (t: TaskCardType) => {
  const lane = (t.category ?? '').toUpperCase();
  if (tab === 'PROJECTS' || tab === 'ORDERS') return LANES[tab].includes(lane);
  if (!LEAD_LANES.includes(lane)) return false;
  const isReq = REQUIREMENT_CODES.includes((t.taskTypeCode ?? '').toUpperCase());
  return tab === 'REQUIREMENT' ? isReq : !isReq;
};

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
  // Older ?tab=MINE|LEADS links land on the first tab.
  const tab: Tab = (['REQUIREMENT', 'MEASURE', 'PROJECTS', 'ORDERS'] as Tab[]).includes(rawTab as Tab) ? (rawTab as Tab) : 'REQUIREMENT';
  let view: View = (['ACTIVE', 'AVAILABLE', 'DONE'] as View[]).includes(rawView as View) ? (rawView as View) : 'ACTIVE';
  if (!params.get('view')) {
    if (rawTab === 'AVAILABLE') view = 'AVAILABLE';
    if (rawTab === 'COMPLETED' || params.get('status') === 'COMPLETED') view = 'DONE';
  }
  return { tab, view };
}

export default function TaskList() {
  const { t } = useT();
  const [params, setParams] = useSearchParams();
  const [pool, setPool] = useState<TaskCardType[]>([]);
  const [mine, setMine] = useState<TaskCardType[]>([]);
  const [capacity, setCapacity] = useState<Capacity | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
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

  const load = useCallback(() => {
    employeeTaskApi.capacity().then(setCapacity).catch(() => {});
    Promise.allSettled([
      employeeTaskApi.pool().then(setPool),
      employeeTaskApi.myTasks().then(setMine),
    ]).finally(() => setLoaded(true));
  }, []);

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
    fn().then(() => setError('')).catch((e: any) => setError(e?.message || t('pw.tl.actionFailed'))).finally(load);
  const onStart = (id: number) => withRefresh(() => runOrQueue({ method: 'post', url: `/employee-tasks/${id}/start`, description: t('pw.tl.q.start') }));
  const onPause = (id: number) => withRefresh(() => runOrQueue({ method: 'post', url: `/employee-tasks/${id}/pause`, description: t('pw.tl.q.pause') }));
  const onComplete = (id: number) => withRefresh(() => runOrQueue({ method: 'post', url: `/employee-tasks/${id}/complete`, description: t('pw.tl.q.complete') }));
  const onExtend = (id: number) => withRefresh(() => employeeTaskApi.extendHold(id));

  // Search matches customer name, site location, task and project name — across my tasks and the pool.
  const q = search.trim().toLowerCase();
  const matches = (t: TaskCardType) => !q
    || [t.customer, t.location, t.taskName, t.project?.name].some((v) => (v ?? '').toLowerCase().includes(q));

  // Per-tab counts for the tab bar (active work assigned to me).
  const activeMine = mine.filter(matches).filter(isActive);
  const tabCount = (t: Tab) => activeMine.filter(inTab(t)).length;
  const tabOverdue = (t: Tab) => activeMine.filter(inTab(t)).some((x) => bucket(x) === 'overdue');

  // Everything below is scoped to the selected tab.
  const active = activeMine.filter(inTab(tab));
  const available = pool.filter(matches).filter(inTab(tab));
  const completed = mine.filter(matches).filter((t) => t.status === 'COMPLETED').filter(inTab(tab));
  const overdue = active.filter((t) => bucket(t) === 'overdue');
  const now = active.filter((t) => bucket(t) === 'now');
  const today = active.filter((t) => bucket(t) === 'today');
  const upcoming = active.filter((t) => bucket(t) === 'upcoming');
  // The rest of the work on projects I'm on — unassigned tasks I can pick up straight from here.
  const myProjectIds = new Set(mine.map((t) => t.project?.id).filter((id): id is number => id != null));
  const projectOpen = tab === 'PROJECTS'
    ? available.filter((t) => t.project != null && myProjectIds.has(t.project.id))
    : [];
  const inProgress = active.filter((t) => t.myAssignmentStatus === 'IN_PROGRESS').length;
  const what = t(`pw.tl.noun.${tab}`);

  const cards = (list: TaskCardType[]) => (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:items-start [&>*]:min-w-0 md:[&>*:only-child]:col-span-2">
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
      <p className="text-[15px] font-semibold text-[#111817]">{celebrate ? t('pw.tl.caughtUp') : t('pw.tl.nothing')}</p>
      <p className="text-[13px] text-[#7A817C]">{msg}</p>
    </div>
  );

  const skeleton = (
    <div className="flex flex-col gap-3">
      {[0, 1, 2].map((i) => <div key={i} className="h-[112px] animate-pulse rounded-2xl bg-white/70" />)}
    </div>
  );

  const views: { key: View; label: string; count: number }[] = [
    { key: 'ACTIVE', label: t('pw.tl.view.ACTIVE'), count: active.length },
    { key: 'AVAILABLE', label: t('pw.tl.view.AVAILABLE'), count: available.length },
    { key: 'DONE', label: t('pw.tl.view.DONE'), count: completed.length },
  ];

  const stats: { label: string; value: number; tone: string }[] = [
    { label: t('pw.tl.stat.overdue'), value: overdue.length, tone: overdue.length ? 'text-[#C9302C]' : 'text-[#111817]' },
    { label: t('pw.tl.stat.today'), value: today.length, tone: 'text-[#111817]' },
    { label: t('pw.tl.stat.inProgress'), value: inProgress, tone: 'text-[#0A573B]' },
    { label: t('pw.tl.stat.canPick'), value: available.length, tone: 'text-[#9B6B32]' },
  ];

  return (
    <div className="flex flex-col gap-3.5 p-3.5">
      {/* Title + capacity */}
      <div className="flex items-center justify-between px-0.5">
        <div className="min-w-0">
          <h1 className="text-[24px] font-bold leading-tight tracking-tight text-[#111817]">{t('pw.tl.title')}</h1>
          {capacity && (
            <p className="mt-0.5 text-[13px] text-[#7A817C]">
              {t('pw.tl.activeCap', { active: capacity.active })}{capacity.max - capacity.active > 0
                ? t('pw.tl.moreCan', { n: capacity.max - capacity.active })
                : t('pw.tl.atCap')}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-[#DDE2DE] bg-white px-3 py-2.5 shadow-sm">
        <Search className="h-4 w-4 shrink-0 text-[#7A817C]" />
        <BaseInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('pw.tl.searchPh')}
          className="min-w-0 flex-1 bg-transparent text-sm text-[#111817] outline-none"
        />
        {search && (
          <button onClick={() => setSearch('')} aria-label={t('pw.tl.clearSearch')} className="shrink-0 text-[#7A817C]">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Type tabs — My Tasks / Projects / Orders / Leads */}
      <div className="sticky top-0 z-10 -mx-3.5 bg-[#F7F7F5]/95 px-3.5 pb-1 pt-0.5 backdrop-blur" role="tablist">
        <div className="grid grid-cols-4 gap-1 rounded-2xl bg-white p-1 shadow-[0_2px_10px_rgba(0,35,22,0.06)]">
          {TABS.map(({ key, icon: Icon }) => {
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
                <span className="text-[12px] font-semibold leading-tight">{t(`pw.tl.tab.${key}`)}</span>
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
            active.length === 0 && projectOpen.length === 0
              ? empty(available.length
                  ? t('pw.tl.inHand', { what, n: available.length })
                  : t('pw.tl.noAttention', { what }), true)
              : (
                <div className="flex flex-col gap-5">
                  <Group icon={AlertTriangle} tone="text-[#D64541]" title={t('pw.tl.group.overdue')} list={overdue} />
                  <Group icon={Flame} tone="text-[#EA6A2D]" title={t('pw.tl.group.now')} list={now} />
                  <Group icon={CalendarDays} tone="text-[#0A573B]" title={t('pw.tl.group.today')} list={today} />
                  <Group icon={Clock} tone="text-[#7A817C]" title={t('pw.tl.group.upcoming')} list={upcoming} />
                  <Group icon={FolderKanban} tone="text-[#9B6B32]" title={t('pw.tl.group.projectOpen')} list={projectOpen} />
                </div>
              )
          )}
          {view === 'AVAILABLE' && (
            <>
              <p className="flex items-center gap-1.5 px-1 text-[12px] text-[#7A817C]">
                <Hand className="h-3.5 w-3.5" /> {t('pw.tl.pickNote')}
              </p>
              {available.length ? cards(available) : empty(t('pw.tl.noAvailable', { what }))}
            </>
          )}
          {view === 'DONE' && (completed.length ? cards(completed) : empty(t('pw.tl.noDone', { what })))}
        </>
      )}
    </div>
  );
}

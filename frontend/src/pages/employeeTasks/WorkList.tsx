import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { employeeTaskApi } from '@/api/employeeTaskApi';
import { TaskCard as TaskCardType } from '@/types/employeeTask';
import { runOrQueue } from '@/hooks/useOfflineQueue';
import TaskCard from './components/TaskCard';
import { LEAD_LANES, foldLeads, isActive } from './TaskList';
import { useT } from '@/i18n';

// "Work" — only what is assigned to me (no pool), newest assignment first, with Lead / Project pills.
type Filter = 'ALL' | 'LEAD' | 'PROJECT';
const FILTERS: Filter[] = ['ALL', 'LEAD', 'PROJECT'];
const PAGE = 20;

const isLead = (t: TaskCardType) => LEAD_LANES.includes((t.category ?? '').toUpperCase());

/** When the work reached me: the office assignment date, else the task's creation (self-picked). */
const assignedAt = (t: TaskCardType) => {
  const raw = t.officeAssignedOn || t.createdAt;
  const ms = raw ? new Date(raw).getTime() : NaN;
  return Number.isNaN(ms) ? 0 : ms;
};
const newestFirst = (a: TaskCardType, b: TaskCardType) => assignedAt(b) - assignedAt(a) || b.id - a.id;

export default function WorkList() {
  const { t } = useT();
  const [params, setParams] = useSearchParams();
  const [mine, setMine] = useState<TaskCardType[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const raw = (params.get('f') || '').toUpperCase();
  const filter: Filter = FILTERS.includes(raw as Filter) ? (raw as Filter) : 'ALL';

  const load = useCallback(() => {
    employeeTaskApi.myTasks().then(setMine).catch(() => {}).finally(() => setLoaded(true));
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setLimit(PAGE); }, [filter]);
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(onVisible, 30_000);
    return () => { document.removeEventListener('visibilitychange', onVisible); window.clearInterval(timer); };
  }, [load]);

  const withRefresh = (fn: () => Promise<unknown>) =>
    fn().then(() => setError('')).catch((e: any) => setError(e?.message || t('pw.tl.actionFailed'))).finally(load);
  const onStart = (id: number) => withRefresh(() => runOrQueue({ method: 'post', url: `/employee-tasks/${id}/start`, description: t('pw.tl.q.start') }));
  const onPause = (id: number) => withRefresh(() => runOrQueue({ method: 'post', url: `/employee-tasks/${id}/pause`, description: t('pw.tl.q.pause') }));
  const onComplete = (id: number) => withRefresh(() => runOrQueue({ method: 'post', url: `/employee-tasks/${id}/complete`, description: t('pw.tl.q.complete') }));
  const onExtend = (id: number) => withRefresh(() => employeeTaskApi.extendHold(id));

  const open = mine.filter(isActive);
  const scoped = (f: Filter) => open.filter((x) => (f === 'ALL' ? true : f === 'LEAD' ? isLead(x) : !isLead(x)));
  // Leads fold to one card per lead, as on the Tasks screen.
  const build = (f: Filter) => {
    const list = scoped(f);
    return (f === 'PROJECT' ? list : foldLeads(list)).sort(newestFirst);
  };
  const list = build(filter);
  const count = (f: Filter) => build(f).length;

  return (
    <div className="flex flex-col gap-3.5 p-3.5">
      <div className="px-0.5">
        <h1 className="text-[24px] font-bold leading-tight tracking-tight text-[#111817]">{t('pw.work.title')}</h1>
        <p className="text-xs text-[#7A817C]">{t('pw.work.sub')}</p>
      </div>

      <div className="flex gap-2" role="tablist">
        {FILTERS.map((f) => {
          const on = filter === f;
          return (
            <button
              key={f}
              role="tab"
              aria-selected={on}
              onClick={() => setParams((p) => { const n = new URLSearchParams(p); if (f === 'ALL') n.delete('f'); else n.set('f', f); return n; }, { replace: true })}
              className={`flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-[13px] font-semibold transition-colors ${
                on ? 'border-[#0A573B] bg-[#0A573B] text-white' : 'border-[#DDE2DE] bg-white text-[#3F4642] active:bg-[#F2F4F2]'
              }`}
            >
              {t(`pw.work.f.${f}`)}
              <span className={`rounded-full px-1.5 text-[11px] ${on ? 'bg-white/25' : 'bg-[#EEF0EE]'}`}>{count(f)}</span>
            </button>
          );
        })}
      </div>

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

      {!loaded ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-[112px] animate-pulse rounded-2xl bg-white/70" />)}
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-[#ECEAE5] bg-white px-6 py-12 text-center shadow-sm">
          <CheckCircle2 className="h-9 w-9 text-[#B9C0BB]" />
          <p className="text-[13px] text-[#7A817C]">{t('pw.work.empty')}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:items-start [&>*]:min-w-0 md:[&>*:only-child]:col-span-2">
            {list.slice(0, limit).map((task) => (
              <TaskCard key={task.id} task={task}
                onStart={onStart} onPause={onPause} onComplete={onComplete} onExtend={onExtend} />
            ))}
          </div>
          {list.length > limit && (
            <button onClick={() => setLimit((l) => l + PAGE)}
              className="w-full rounded-xl border border-[#DDE2DE] bg-white py-2.5 text-[13px] font-semibold text-[#0A573B] active:bg-[#F7F7F5]">
              {t('pw.tl.showMore', { n: list.length - limit })}
            </button>
          )}
        </>
      )}
    </div>
  );
}

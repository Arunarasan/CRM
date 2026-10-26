import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Flame, Star, Sparkles, Wrench } from 'lucide-react';
import { employeeTaskApi } from '@/api/employeeTaskApi';
import { TaskCard } from '@/types/employeeTask';
import { byPlanRank, daysUntil, rankTier, shortDue } from '../taskUtils';
import { useT } from '@/i18n';

const CARD = 'rounded-2xl border border-[#ECEAE5] bg-white shadow-[0_4px_14px_rgba(0,35,22,0.05)]';
const MAX_STEPS = 6;

const isActive = (t: TaskCard) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED';

/** Plan order: overdue first, then due today, then the shared rank (new leads → ready-to-fit → progress → rating). */
function planOrder(a: TaskCard, b: TaskCard): number {
  const band = (t: TaskCard) => (t.dueState === 'OVERDUE' ? 0 : daysUntil(t.dueDate) === 0 ? 1 : 2);
  return band(a) - band(b) || byPlanRank(a, b);
}

function Stars({ n }: { n: number }) {
  return (
    <span className="flex items-center gap-px text-[#C48A16]" aria-label={`${n} star`}>
      {Array.from({ length: n }).map((_, i) => <Star key={i} className="h-3 w-3 fill-current" />)}
    </span>
  );
}

function PlanRow({ task, step, first, onOpen }: { task: TaskCard; step: number; first: boolean; onOpen: () => void }) {
  const { t } = useT();
  const overdue = task.dueState === 'OVERDUE';
  const tier = rankTier(task);
  const title = task.customer || task.project?.name || task.taskName;
  const sub = [task.customer || task.project ? task.taskName : null, task.location].filter(Boolean).join(' · ');
  const progress = Math.max(0, Math.min(100, Math.round(task.progressPercent ?? 0)));
  return (
    <button
      onClick={onOpen}
      className={`flex w-full items-start gap-3 px-3.5 py-3 text-left active:bg-[#F7F7F5] ${first ? 'bg-[#F3F8F5]' : ''}`}
    >
      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${
        first ? 'bg-[#06452F] text-white' : 'bg-[#EEF0EE] text-[#4B524E]'
      }`}>{step || '+'}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[14px] font-semibold text-[#111817]">{title}</span>
          {first && <span className="shrink-0 rounded-full bg-[#06452F] px-2 py-0.5 text-[10px] font-semibold text-white">{t('portal.home.plan.startHere')}</span>}
        </span>
        {sub && <span className="mt-0.5 block truncate text-[12px] text-[#7A817C]">{sub}</span>}
        <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
          {tier === 0 && <span className="flex items-center gap-1 rounded-full bg-[#FBF1DA] px-2 py-0.5 font-semibold text-[#9D6B10]"><Sparkles className="h-3 w-3" />{t('portal.home.plan.newLead')}</span>}
          {tier === 1 && <span className="flex items-center gap-1 rounded-full bg-[#E7F2EC] px-2 py-0.5 font-semibold text-[#06452F]"><Wrench className="h-3 w-3" />{t('portal.home.plan.readyToFit')}</span>}
          {task.leadRating ? <Stars n={task.leadRating} /> : null}
          {task.dueDate && <span className={`font-medium ${overdue ? 'text-[#C9302C]' : 'text-[#7A817C]'}`}>{shortDue(task.dueDate, task.status)}</span>}
          {progress > 0 && (
            <span className="flex items-center gap-1.5 text-[#4B524E]">
              <span className="h-1.5 w-14 overflow-hidden rounded-full bg-[#E4E7E4]"><span className="block h-full rounded-full bg-[#2F8F65]" style={{ width: `${progress}%` }} /></span>
              {progress}%
            </span>
          )}
        </span>
      </span>
      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[#B9C0BB]" />
    </button>
  );
}

/** Home's "Today's Plan": only the active tasks the office assigned to me today, in the order to do them. */
export default function TodayPlan({ refreshKey }: { refreshKey?: number }) {
  const { t } = useT();
  const navigate = useNavigate();
  const [mine, setMine] = useState<TaskCard[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    Promise.allSettled([
      employeeTaskApi.myTasks().then(setMine),
    ]).finally(() => setLoaded(true));
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);

  // The office can assign, re-assign or delete a task at any time: refresh when the employee returns to
  // the app and quietly every 30s while Home is open, so the plan matches what the admin just did.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') load(); }, 30_000);
    return () => { document.removeEventListener('visibilitychange', onVisible); window.clearInterval(timer); };
  }, [load]);

  // Only tasks the office assigned to me today (officeAssignedOn is null for ones I picked myself).
  const plan = useMemo(() => {
    const today = new Date().toLocaleDateString('en-CA');
    return mine.filter(isActive)
      .filter((x) => x.officeAssignedOn === today)
      .sort(planOrder);
  }, [mine]);
  const overdue = plan.filter((p) => p.dueState === 'OVERDUE').length;
  const fit = plan.filter((p) => p.workStage === 'READY_TO_FIT').length;
  const open = (id: number) => navigate(`/employee/tasks/${id}`);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-3 flex items-end justify-between px-0.5">
          <h2 className="flex items-center gap-1.5 text-[19px] font-semibold text-[#111817]">
            <Flame className="h-[18px] w-[18px] text-[#C48A16]" />{t('portal.home.plan.title')}
          </h2>
          {plan.length > 0 && (
            <span className="text-[11px] font-medium text-[#7A817C]">
              {t('portal.home.plan.summary', { count: plan.length, overdue, fit })}
            </span>
          )}
        </div>
        <div className={`${CARD} overflow-hidden`}>
          {!loaded ? (
            <div className="space-y-px">{[0, 1, 2].map((i) => <div key={i} className="h-[72px] animate-pulse bg-[#F3F4F2]" />)}</div>
          ) : plan.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-[#7A817C]">{t('portal.home.plan.empty')}</p>
          ) : (
            <div className="divide-y divide-[#ECEBE7]">
              {plan.slice(0, MAX_STEPS).map((task, i) => (
                <PlanRow key={task.id} task={task} step={i + 1} first={i === 0} onOpen={() => open(task.id)} />
              ))}
            </div>
          )}
          {plan.length > MAX_STEPS && (
            <button
              onClick={() => navigate('/employee/tasks?view=ACTIVE')}
              className="flex w-full items-center justify-center gap-1 border-t border-[#ECEBE7] py-3 text-[13px] font-semibold text-[#B27A12] active:bg-[#F7F7F5]"
            >
              {t('portal.home.plan.more', { count: plan.length })} <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, FolderKanban, Gift, Star, UserCheck } from 'lucide-react';
import { employeePortalApi } from '@/api/employeePortalApi';
import { MyBonuses, MyRewards, RewardRow } from '@/types/employeePortal';
import { inr } from '../../employeePortal/_shared';
import { useT } from '@/i18n';

const CARD = 'rounded-2xl border border-[#ECEAE5] bg-white shadow-[0_4px_14px_rgba(0,35,22,0.05)]';

// Bonus types the reward rows already cover (project completion, review rewards) — counted once, not twice.
const COVERED_BONUS_TYPES = ['PROJECT_COMPLETION', 'INCENTIVE'];

interface Line {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
  total: number;
  pending: number;
}

const fromReward = (r: RewardRow | undefined) => ({
  count: (r?.paidCount ?? 0) + (r?.pendingCount ?? 0),
  total: (r?.paidAmount ?? 0) + (r?.pendingAmount ?? 0),
  pending: r?.pendingAmount ?? 0,
});

/** Leads qualified + projects completed + review rewards + other incentives, merged into one card. */
export default function EarningsCard() {
  const { t } = useT();
  const navigate = useNavigate();
  const [rewards, setRewards] = useState<MyRewards | null>(null);
  const [bonuses, setBonuses] = useState<MyBonuses | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.allSettled([
      employeePortalApi.rewards().then(setRewards),
      employeePortalApi.bonuses().then(setBonuses),
    ]).finally(() => setLoaded(true));
  }, []);

  const lines = useMemo<Line[]>(() => {
    const other = (bonuses?.bonuses ?? []).filter((b) => !COVERED_BONUS_TYPES.includes((b.bonusType ?? '').toUpperCase()));
    const otherTotal = other.reduce((s, b) => s + (b.amount ?? 0), 0);
    const otherPending = other.filter((b) => b.status !== 'PAID').reduce((s, b) => s + (b.amount ?? 0), 0);
    return [
      { key: 'leads', label: t('portal.home.earn.leads'), icon: UserCheck, ...fromReward(rewards?.leads) },
      { key: 'projects', label: t('portal.home.rewardProjects'), icon: FolderKanban, ...fromReward(rewards?.projects) },
      { key: 'reviews', label: t('portal.home.rewardReviews'), icon: Star, ...fromReward(rewards?.reviews) },
      { key: 'other', label: t('portal.home.earn.other'), icon: Gift, count: other.length, total: otherTotal, pending: otherPending },
    ].filter((l) => l.total > 0);
  }, [rewards, bonuses, t]);

  if (!loaded || (!rewards && !bonuses)) return null;

  const total = lines.reduce((s, l) => s + l.total, 0);
  const pending = lines.reduce((s, l) => s + l.pending, 0);
  const paid = total - pending;

  return (
    <button onClick={() => navigate('/employee/salary')} className={`${CARD} w-full p-4 text-left active:scale-[0.99]`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-medium text-[#858B87]">{t('portal.home.earn.title')}</p>
          <p className="mt-0.5 text-[28px] font-bold leading-none tabular-nums text-[#111817]">{inr(total)}</p>
        </div>
        <ChevronRight className="mt-1 h-5 w-5 text-[#B9C0BB]" />
      </div>

      {total > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold">
          <span className="rounded-full bg-[#E7F2EC] px-2.5 py-1 text-[#28704F]">{t('portal.home.rewardPaid')} {inr(paid)}</span>
          {pending > 0 && <span className="rounded-full bg-[#FBF1DA] px-2.5 py-1 text-[#9D6B10]">{t('portal.home.rewardPending')} {inr(pending)}</span>}
        </div>
      )}

      {lines.length === 0 ? (
        <p className="mt-3 text-[13px] text-[#7A817C]">{t('portal.home.earn.empty')}</p>
      ) : (
        <div className="mt-3 divide-y divide-[#ECEAE5]">
          {lines.map(({ key, label, icon: Icon, count, total: amt, pending: pend }) => (
            <div key={key} className="flex items-center gap-3 py-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E7F2EC]">
                <Icon className="h-[18px] w-[18px] text-[#06452F]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-[#111817]">
                  {label}{count ? <span className="font-medium text-[#858B87]"> × {count}</span> : null}
                </p>
                {pend > 0 && <p className="text-[10.5px] text-[#B27A12]">{inr(pend)} {t('portal.home.rewardPending')}</p>}
              </div>
              <p className="text-[14px] font-bold tabular-nums text-[#111817]">{inr(amt)}</p>
            </div>
          ))}
        </div>
      )}
    </button>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown, CalendarDays, Briefcase, Phone, Mail,
  Wallet, ChevronRight, HandCoins,
  Activity,
} from 'lucide-react';
import { employeeTaskApi } from '@/api/employeeTaskApi';
import { employeePortalApi } from '@/api/employeePortalApi';
import { HomeSummary } from '@/types/employeeTask';
import { EmployeeDashboard } from '@/types/employeePortal';
import { StatusPill } from '../employeePortal/_shared';
import ClockWidget from '../employeePortal/ClockWidget';
import TodayPlan from './components/TodayPlan';
import { fetchCompanyProfile, COMPANY_FALLBACK, type CompanyProfile } from '@/lib/companyProfile';
import Logo from '@/components/brand/Logo';
import { resolveFileUrl } from '@/lib/uploadFile';
import { useT } from '@/i18n';

// Premium card surface shared across the dashboard.
const CARD = 'rounded-2xl border border-[#ECEAE5] bg-white shadow-[0_4px_14px_rgba(0,35,22,0.05)]';

/** Returns the i18n key for the time-of-day greeting. */
function greetingKey(): string {
  const h = new Date().getHours();
  if (h < 12) return 'portal.home.goodMorning';
  if (h < 17) return 'portal.home.goodAfternoon';
  return 'portal.home.goodEvening';
}

/** Section header — title + optional gold "View All". */
function SectionHead({ title, icon: Icon, onViewAll }: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  onViewAll?: () => void;
}) {
  const { t } = useT();
  return (
    <div className="mb-3 flex items-center justify-between px-0.5">
      <h2 className="flex items-center gap-1.5 text-[19px] font-semibold text-[#111817]">
        {Icon && <Icon className="h-[18px] w-[18px] text-[#06452F]" />}
        {title}
      </h2>
      {onViewAll && (
        <button onClick={onViewAll} className="flex items-center gap-0.5 text-[14px] font-semibold text-[#B27A12] active:opacity-70">
          {t('portal.home.viewAll')} <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/** Employee ID card — forest/gold badge with photo, name, designation and key details. */
function IdCard({ e }: { e: EmployeeDashboard['employee'] }) {
  const { t } = useT();
  const [company, setCompany] = useState<CompanyProfile>(COMPANY_FALLBACK);
  useEffect(() => { fetchCompanyProfile().then(setCompany).catch(() => {}); }, []);
  const name = `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim();
  const initials = (name || 'Me').split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
  const fmt = (v: unknown) => {
    if (!v) return '—';
    const d = new Date(String(v));
    return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  const rows: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }[] = [
    { icon: Briefcase, label: t('portal.home.prof.designation'), value: e.designation || '—' },
    { icon: CalendarDays, label: t('portal.home.prof.doj'), value: fmt(e.dateOfJoining) },
    { icon: Phone, label: t('portal.home.prof.phone'), value: e.phone || '—' },
    { icon: Mail, label: t('portal.home.prof.email'), value: e.email || '—' },
  ];
  return (
    <div
      className="relative mx-auto h-[560px] w-full max-w-[340px] overflow-hidden rounded-[22px] shadow-[0_8px_24px_rgba(0,35,22,0.22)]"
      style={{ backgroundImage: `url(${import.meta.env.BASE_URL}id-card-bg.webp)`, backgroundSize: '109% 105%', backgroundPosition: 'center' }}
    >
      <div className="flex flex-col items-center px-5 pt-3">
        <Logo size="lg" />
        <span className="mt-4 flex h-[132px] w-[118px] items-center justify-center overflow-hidden rounded-2xl border-[3px] border-[#D9B25C] bg-[#E7F2EC] text-[32px] font-bold text-[#06452F] shadow-md">
          {e.profilePhotoUrl ? <img src={resolveFileUrl(e.profilePhotoUrl)} alt={name} className="h-full w-full object-cover" /> : initials}
        </span>
        <h3 className="mt-2 text-[22px] font-extrabold uppercase leading-tight text-[#06452F]">{name || '—'}</h3>
        {e.designation && (
          <span className="mt-1 inline-block rounded-full bg-gradient-to-r from-[#E9C867] to-[#C99A2E] px-5 py-0.5 text-[11px] font-bold uppercase tracking-[0.25em] text-[#012B1D]">
            {e.designation}
          </span>
        )}
      </div>
      <dl className="absolute inset-x-0 top-[312px] flex flex-col gap-2 pl-[40px] pr-[26px]">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#06452F] text-[#E9C867]"><r.icon className="h-3 w-3" /></span>
            <dt className="w-[74px] shrink-0 text-[10px] text-[#4B524E]">{r.label}</dt>
            <dd className="min-w-0 flex-1 truncate border-l border-[#C9CCC8] pl-2 text-[11px] font-semibold text-[#111817]">{r.value}</dd>
          </div>
        ))}
      </dl>
      <div className="absolute inset-x-0 bottom-3 flex flex-col items-center gap-0.5 text-[11px] font-semibold text-[#F3DFA0]">
        <span className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{company.phone}</span>
        <span className="flex items-center gap-1.5"><Mail className="h-3 w-3" />{company.email}</span>
      </div>
    </div>
  );
}

/** Floating bar that opens/closes the employee's ID card (replaces the old date selector). */
function ProfileBar({ dash, today }: { dash: EmployeeDashboard | null; today: string }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { t } = useT();
  const e = dash?.employee;
  const name = e ? `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim() : '';
  const initials = (name || 'Me').split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
  const time = (v: string | null | undefined) => {
    if (!v) return '—';
    const d = new Date(v);
    return isNaN(d.getTime()) ? v : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  const pct = Math.max(0, Math.min(100, Math.round(dash?.profileCompletion ?? 0)));
  return (
    <div className="overflow-hidden rounded-2xl border border-[#DCDDD9] bg-white shadow-[0_4px_16px_rgba(0,35,22,0.08)]">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-left active:bg-[#F7F7F5]"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#06452F] text-[13px] font-bold text-white">
          {e?.profilePhotoUrl ? <img src={resolveFileUrl(e.profilePhotoUrl)} alt="" className="h-full w-full object-cover" /> : initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-[#111817]">{name || today}</span>
          <span className="block truncate text-[12px] text-[#7A817C]">
            {name ? `${e?.designation ? e.designation + ' · ' : ''}${today}` : ''}
          </span>
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-[#06452F] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && e && (
        <div className="border-t border-[#ECEAE5] bg-[#F4F3EF] px-4 pb-4 pt-4">
          <IdCard e={e} />
          <div className="mx-auto mt-3 flex w-full max-w-[340px] items-center justify-between gap-3">
            <span className="text-[13px] font-medium text-[#4B524E]">{t('portal.home.todaysAttendance')}</span>
            <StatusPill status={dash?.todayAttendance ?? 'NOT_MARKED'} />
          </div>
          <div className="mx-auto mt-1 flex w-full max-w-[340px] justify-between text-[12px] text-[#4B524E]">
            <span>{t('portal.home.prof.checkIn')}: <b>{time(dash?.todayCheckIn)}</b></span>
            <span>{t('portal.home.prof.checkOut')}: <b>{time(dash?.todayCheckOut)}</b></span>
          </div>
          <div className="mx-auto mt-3 w-full max-w-[340px]">
            <div className="mb-1 text-[11px] text-[#7A817C]">{t('portal.home.prof.completion', { pct })}</div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#E4E7E4]"><div className="h-full rounded-full bg-[#C48A16]" style={{ width: `${pct}%` }} /></div>
          </div>
          <button onClick={() => navigate('/employee/profile')} className="mx-auto mt-4 flex w-full max-w-[340px] items-center justify-center gap-1 rounded-xl bg-[#06452F] py-2.5 text-[13px] font-semibold text-white active:opacity-90">
            {t('portal.home.prof.view')} <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function MobileHome() {
  const [home, setHome] = useState<HomeSummary | null>(null);
  const [dash, setDash] = useState<EmployeeDashboard | null>(null);
  const navigate = useNavigate();
  const { t } = useT();

  const load = useCallback(() => {
    employeeTaskApi.home().then(setHome).catch(() => {});
    employeePortalApi.dashboard().then(setDash).catch(() => setDash(null));
  }, []);

  useEffect(() => { load(); }, [load]);

  const firstName = dash?.employee?.firstName ?? 'there';
  const today = new Date().toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', weekday: 'long',
  });


  return (
    <div className="flex flex-col">
      {/* Greeting hero — continues the forest header */}
      <div className="bg-[#012B1D] px-5 pb-11 pt-1">
        <h1 className="text-[25px] font-bold leading-tight text-white">
          {t(greetingKey())}, {firstName}! <span className="align-middle">👋</span>
        </h1>
        <p className="mt-1 text-[15px] text-[#D4E0DA]">{t('portal.home.hereToday')}</p>
      </div>

      <div className="-mt-7 flex flex-col gap-6 px-5 pb-6">
        {/* Profile bar — today's date + who I am; opens to show my details, closes again */}
        <ProfileBar dash={dash} today={today} />

        {/* Today's earnings + live session time — the money-forward hero of the home screen */}
        <ClockWidget onChange={load} />

        {/* Today's plan — my work in the order to do it, plus new leads to pick up */}
        <TodayPlan />

        {/* Available pool shortcut */}
        {home && (
          <button
            onClick={() => navigate('/employee/tasks?view=AVAILABLE')}
            className={`${CARD} flex items-center justify-between px-4 py-3.5 text-left active:scale-[0.99]`}
          >
            <p className="text-xs text-[#858B87]">{t('portal.home.availableForYou')}</p>
            <p className="flex items-center justify-end gap-1 text-lg font-bold leading-none text-[#06452F]">
              {home.availableCount ?? 0} <ChevronRight className="h-4 w-4" />
            </p>
          </button>
        )}

        {/* Attendance + Salary quick access */}
        <div className="grid grid-cols-2 gap-3.5">
          <button onClick={() => navigate('/employee/attendance')} className={`${CARD} flex flex-col items-start gap-2 p-4 text-left active:scale-[0.98]`}>
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#06452F]">
              <CalendarDays className="h-5 w-5 text-white" />
            </span>
            <span className="text-[13px] font-medium text-[#4B524E]">{t('portal.home.todaysAttendance')}</span>
            <StatusPill status={dash?.todayAttendance ?? 'NOT_MARKED'} />
          </button>

          <button onClick={() => navigate('/employee/salary')} className={`${CARD} flex flex-col items-start gap-2 p-4 text-left active:scale-[0.98]`}>
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#C48A16]">
              <Wallet className="h-5 w-5 text-white" />
            </span>
            <span className="text-[13px] font-medium text-[#4B524E]">{t('portal.home.salary')}{dash?.lastSalaryMonth ? ` · ${dash.lastSalaryMonth}` : ''}</span>
            <StatusPill status={dash?.lastSalaryStatus ?? 'NONE'} />
          </button>
        </div>

        {/* Borrow money — opens the advance request form; admin approves */}
        <button onClick={() => navigate('/employee/salary?borrow=1')} className={`${CARD} flex items-center gap-3 px-4 py-3.5 text-left active:scale-[0.99]`}>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#06452F]">
            <HandCoins className="h-5 w-5 text-white" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-[#111817]">{t('portal.home.borrowMoney')}</span>
            <span className="block text-[12px] text-[#7A817C]">{t('portal.home.borrowMoneyHint')}</span>
          </span>
          <ChevronRight className="h-4 w-4 text-[#06452F]" />
        </button>

        {/* Recent Activity */}
        {dash?.recentActivity && Object.values(dash.recentActivity).some(Boolean) && (
          <div>
            <SectionHead title={t('portal.home.recentActivity')} icon={Activity} />
            <div className={`${CARD} divide-y divide-[#ECEBE7] overflow-hidden`}>
              {[
                { key: 'latestDailyReport', label: t('portal.home.dailyReport') },
                { key: 'latestMaterialRequest', label: t('portal.home.materialRequest') },
                { key: 'latestManpowerRequest', label: t('portal.home.manpowerRequest') },
                { key: 'latestLead', label: t('portal.home.lead') },
                { key: 'lastAttendance', label: t('portal.home.attendance') },
              ].map(({ key, label }) => {
                const item = dash.recentActivity?.[key];
                if (!item) return null;
                return (
                  <div key={key} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-[11px] text-[#858B87]">{label}</p>
                      <p className="truncate text-sm font-medium text-[#111817]">{item.label}</p>
                    </div>
                    {item.status && <StatusPill status={String(item.status).toUpperCase()} />}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

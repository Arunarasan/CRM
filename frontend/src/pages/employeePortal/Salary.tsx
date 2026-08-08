import { useEffect, useState } from 'react';
import { ChevronRight, Gift } from 'lucide-react';
import { employeePortalApi } from '@/api/employeePortalApi';
import { Payslip, MyBonuses } from '@/types/employeePortal';
import { PortalHeader, StatusPill, EmptyState, inr } from './_shared';

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const BONUS_LABEL: Record<string, string> = {
  PROJECT_COMPLETION: 'Project Completion', QUALITY: 'Quality', PERFORMANCE: 'Performance',
  TARGET_ACHIEVEMENT: 'Target Achievement', FESTIVAL: 'Festival', ATTENDANCE: 'Attendance',
  MANUAL: 'Manual', INCENTIVE: 'Incentive', OTHER: 'Bonus',
};

function PayslipDetail({ slip, onBack }: { slip: Payslip; onBack: () => void }) {
  const hourly = slip.payType === 'HOURLY';
  const earnings: [string, number][] = hourly
    ? [
        ['Regular earnings', slip.regularEarnings ?? 0], ['Overtime pay', slip.overtimeAmount],
        ['Project bonus', slip.projectBonus ?? 0], ['Manual bonus', slip.manualBonus ?? 0],
        ['Incentive', slip.incentive],
      ]
    : [
        ['Basic', slip.basic], ['HRA', slip.hra], ['Overtime', slip.overtimeAmount],
        ['Bonus', slip.bonus], ['Incentive', slip.incentive],
      ];
  const deductions: [string, number][] = hourly
    ? [
        ['Manual deduction', slip.manualDeduction ?? 0], ['Advance', slip.advanceRecovery], ['Loan', slip.loanRecovery],
      ]
    : [
        ['PF', slip.pfAmount], ['ESI', slip.esiAmount], ['Professional Tax', slip.professionalTax],
        ['Advance', slip.advanceRecovery], ['Loan', slip.loanRecovery], ['Leave (LOP)', slip.leaveDeduction],
      ];
  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-card px-2 py-2.5">
        <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full active:bg-accent" aria-label="Back">
          <ChevronRight className="h-5 w-5 rotate-180" />
        </button>
        <h1 className="flex-1 text-base font-semibold">Payslip · {MONTHS[slip.month]} {slip.year}</h1>
        <StatusPill status={slip.status} />
      </div>

      <div className="m-3 rounded-xl border bg-card p-4 text-center shadow-sm">
        <p className="text-xs text-muted-foreground">Net Pay</p>
        <p className="text-3xl font-bold text-emerald-600">{inr(slip.netSalary)}</p>
        {slip.payslipNumber && <p className="mt-1 text-[11px] text-muted-foreground">{slip.payslipNumber}</p>}
      </div>

      <div className="mx-3 grid grid-cols-3 gap-2 pb-3 text-center">
        {(hourly
          ? [['Days', slip.attendanceDays], ['Hrs', slip.workedHours], ['OT hrs', slip.overtimeHours]]
          : [['Working', slip.workingDays], ['Paid', slip.paidDays], ['LOP', slip.lopDays]]
        ).map(([l, v]) => (
          <div key={l as string} className="rounded-lg border bg-card p-2 shadow-sm">
            <p className="text-base font-bold leading-none">{v ?? '—'}</p>
            <p className="mt-1 text-[10px] uppercase text-muted-foreground">{l}</p>
          </div>
        ))}
      </div>

      <h3 className="px-4 pb-1 text-xs font-semibold uppercase text-muted-foreground">Earnings</h3>
      <div className="mx-3 mb-3 divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
        {earnings.map(([l, v]) => (
          <div key={l} className="flex justify-between px-4 py-2.5 text-sm"><span className="text-muted-foreground">{l}</span><span className="font-medium">{inr(v)}</span></div>
        ))}
        <div className="flex justify-between bg-muted/40 px-4 py-2.5 text-sm font-semibold"><span>Gross</span><span>{inr(slip.grossEarnings)}</span></div>
      </div>

      <h3 className="px-4 pb-1 text-xs font-semibold uppercase text-muted-foreground">Deductions</h3>
      <div className="mx-3 mb-6 divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
        {deductions.map(([l, v]) => (
          <div key={l} className="flex justify-between px-4 py-2.5 text-sm"><span className="text-muted-foreground">{l}</span><span className="font-medium">{inr(v)}</span></div>
        ))}
        <div className="flex justify-between bg-muted/40 px-4 py-2.5 text-sm font-semibold"><span>Total</span><span>{inr(slip.totalDeductions)}</span></div>
      </div>
    </div>
  );
}

export default function Salary() {
  const [slips, setSlips] = useState<Payslip[]>([]);
  const [selected, setSelected] = useState<Payslip | null>(null);
  const [bonuses, setBonuses] = useState<MyBonuses | null>(null);

  useEffect(() => {
    employeePortalApi.payslips().then(setSlips).catch(() => setSlips([]));
    employeePortalApi.bonuses().then(setBonuses).catch(() => setBonuses(null));
  }, []);

  if (selected) return <PayslipDetail slip={selected} onBack={() => setSelected(null)} />;

  return (
    <div className="flex flex-col">
      <PortalHeader title="Salary" />

      {bonuses && bonuses.bonuses.length > 0 && (
        <>
          <div className="mx-3 mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl border bg-emerald-50 p-3 text-center">
              <p className="text-[10px] uppercase text-emerald-700/70">Bonus Received</p>
              <p className="text-lg font-bold text-emerald-700">{inr(bonuses.bonusPaidTotal)}</p>
            </div>
            <div className="rounded-xl border bg-amber-50 p-3 text-center">
              <p className="text-[10px] uppercase text-amber-700/70">Bonus Pending</p>
              <p className="text-lg font-bold text-amber-700">{inr(bonuses.bonusPendingTotal)}</p>
            </div>
          </div>
          <h3 className="px-4 pb-1 pt-3 text-xs font-semibold uppercase text-muted-foreground">Bonuses & Incentives</h3>
          <div className="mx-3 mb-2 divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
            {bonuses.bonuses.map((b) => (
              <div key={b.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <Gift className="h-4 w-4 text-pink-500" />
                  <div>
                    <p className="text-sm font-medium">{BONUS_LABEL[b.bonusType] || b.bonusType}</p>
                    <p className="text-xs text-muted-foreground">{b.projectName || b.reason || (b.awardDate ?? '')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-emerald-600">{inr(b.amount)}</span>
                  <StatusPill status={b.status} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <h3 className="px-4 pb-1 pt-3 text-xs font-semibold uppercase text-muted-foreground">Payslips</h3>
      <div className="mx-3 mb-6 divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
        {slips.length === 0 ? (
          <EmptyState message="No payslips generated yet." />
        ) : (
          slips.map((s) => (
            <button key={s.id} onClick={() => setSelected(s)} className="flex w-full items-center justify-between px-4 py-3 text-left active:bg-accent/40">
              <div>
                <p className="text-sm font-medium">{MONTHS[s.month]} {s.year}</p>
                <p className="text-xs text-muted-foreground">Net {inr(s.netSalary)}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill status={s.status} />
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

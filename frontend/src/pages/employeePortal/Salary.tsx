import { useEffect, useState } from 'react';
import { ChevronRight, Gift, Plus, X, HandCoins, Landmark } from 'lucide-react';
import { employeePortalApi } from '@/api/employeePortalApi';
import { Payslip, MyBonuses, MonthlyEarning, PayrollRequestEntry, MyLoan, MyAdvance, PayrollRequestType } from '@/types/employeePortal';
import { PortalHeader, StatusPill, EmptyState, inr } from './_shared';

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const REQ_TYPES: { value: PayrollRequestType; label: string }[] = [
  { value: 'ADVANCE', label: 'Salary advance' },
  { value: 'LOAN_REPAYMENT', label: 'Repay loan' },
  { value: 'ADVANCE_REPAYMENT', label: 'Repay advance' },
  { value: 'SET_RECOVERY', label: 'Set repay plan' },
  { value: 'OTHER', label: 'Other' },
];
const REQ_LABEL: Record<string, string> = {
  ADVANCE: 'Salary advance', LOAN_REPAYMENT: 'Loan repayment', ADVANCE_REPAYMENT: 'Advance repayment',
  SET_RECOVERY: 'Recovery plan', OTHER: 'Other',
};
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

const now = new Date();

function RequestSheet({ loans, advances, onClose, onSaved }: { loans: MyLoan[]; advances: MyAdvance[]; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState<PayrollRequestType>('ADVANCE');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [monthlyRecovery, setMonthlyRecovery] = useState('');
  const [loanId, setLoanId] = useState<string>('');
  const [advanceId, setAdvanceId] = useState<string>('');
  const [recoveryTarget, setRecoveryTarget] = useState<string>(''); // "L:3" | "A:5"
  const [direction, setDirection] = useState<'DEBIT' | 'CREDIT'>('DEBIT');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const outstandingLoans = loans.filter((l) => l.balance > 0 && l.status !== 'CLOSED');
  const outstandingAdvances = advances.filter((a) => a.balance > 0 && a.status !== 'RECOVERED' && a.status !== 'PENDING');
  const isMonthTargeted = type === 'LOAN_REPAYMENT' || type === 'ADVANCE_REPAYMENT' || type === 'OTHER';
  const amountLabel = type === 'SET_RECOVERY' ? 'Monthly recovery amount (₹)'
    : type === 'ADVANCE' ? 'Amount to take this month (₹)' : 'Amount (₹)';

  const submit = async () => {
    setError('');
    const amt = Number(amount);
    if (!amt || amt <= 0) { setError('Enter an amount greater than zero.'); return; }
    if (type === 'LOAN_REPAYMENT' && !loanId) { setError('Select the loan to repay.'); return; }
    if (type === 'ADVANCE_REPAYMENT' && !advanceId) { setError('Select the advance to repay.'); return; }
    let recLoanId: number | undefined, recAdvanceId: number | undefined;
    if (type === 'SET_RECOVERY') {
      if (!recoveryTarget) { setError('Select the loan or advance to set the plan for.'); return; }
      const [kind, id] = recoveryTarget.split(':');
      if (kind === 'L') recLoanId = Number(id); else recAdvanceId = Number(id);
    }
    setSaving(true);
    try {
      await employeePortalApi.createPayrollRequest({
        requestType: type,
        amount: amt,
        reason: reason || undefined,
        ...(type === 'ADVANCE' ? { monthlyRecovery: monthlyRecovery ? Number(monthlyRecovery) : undefined } : {}),
        ...(isMonthTargeted ? { targetMonth: month, targetYear: year } : {}),
        ...(type === 'LOAN_REPAYMENT' ? { loanId: Number(loanId) } : {}),
        ...(type === 'ADVANCE_REPAYMENT' ? { advanceId: Number(advanceId) } : {}),
        ...(type === 'SET_RECOVERY' ? { loanId: recLoanId, advanceId: recAdvanceId } : {}),
        ...(type === 'OTHER' ? { direction } : {}),
      });
      onSaved();
    } catch (e: any) {
      setError(e?.message || 'Could not submit request.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/40" onClick={onClose}>
      <div className="mx-auto max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-card p-4 pb-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Raise a Money Request</h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full active:bg-accent"><X className="h-5 w-5" /></button>
        </div>
        {error && <p className="mb-2 rounded-md bg-destructive/15 p-2 text-xs text-destructive">{error}</p>}
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Request type</label>
            <div className="mt-1 flex flex-wrap gap-2">
              {REQ_TYPES.map((t) => (
                <button key={t.value} onClick={() => setType(t.value)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium ${type === t.value ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">{amountLabel}</label>
            <input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" placeholder="e.g. 2000" />
          </div>

          {type === 'ADVANCE' && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Preferred monthly recovery (optional)</label>
              <input type="number" inputMode="numeric" value={monthlyRecovery} onChange={(e) => setMonthlyRecovery(e.target.value)}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" placeholder="how much to cut per month" />
            </div>
          )}

          {type === 'LOAN_REPAYMENT' && (
            <PickerBlock label="Loan to repay" empty="You have no outstanding loans." value={loanId} onChange={setLoanId}
              options={outstandingLoans.map((l) => ({ value: String(l.id), label: `Loan #${l.id} · balance ${inr(l.balance)}` }))} />
          )}

          {type === 'ADVANCE_REPAYMENT' && (
            <PickerBlock label="Advance to repay" empty="You have no outstanding advances." value={advanceId} onChange={setAdvanceId}
              options={outstandingAdvances.map((a) => ({ value: String(a.id), label: `Advance #${a.id} · balance ${inr(a.balance)}` }))} />
          )}

          {type === 'SET_RECOVERY' && (
            <PickerBlock label="Set repay plan for" empty="You have no active loans or advances." value={recoveryTarget} onChange={setRecoveryTarget}
              options={[
                ...outstandingLoans.map((l) => ({ value: `L:${l.id}`, label: `Loan #${l.id} · balance ${inr(l.balance)}` })),
                ...outstandingAdvances.map((a) => ({ value: `A:${a.id}`, label: `Advance #${a.id} · balance ${inr(a.balance)}` })),
              ]} />
          )}

          {type === 'OTHER' && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">This is</label>
              <div className="mt-1 flex gap-2">
                {[['DEBIT', 'A deduction (I pay)'], ['CREDIT', 'A reimbursement (owed to me)']].map(([v, l]) => (
                  <button key={v} onClick={() => setDirection(v as 'DEBIT' | 'CREDIT')}
                    className={`flex-1 rounded-full border px-3 py-1.5 text-xs font-medium ${direction === v ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isMonthTargeted && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Month</label>
                <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm">
                  {MONTHS.slice(1).map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Year</label>
                <input type="number" inputMode="numeric" value={year} onChange={(e) => setYear(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground">Reason</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" placeholder="Optional note for HR" />
          </div>

          <button onClick={submit} disabled={saving}
            className="mt-1 w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground active:scale-[0.99] disabled:opacity-60">
            {saving ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PickerBlock({ label, empty, value, onChange, options }: {
  label: string; empty: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {options.length === 0 ? (
        <p className="mt-1 rounded-lg border bg-muted/40 p-2 text-xs text-muted-foreground">{empty}</p>
      ) : (
        <select value={value} onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm">
          <option value="">Select…</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}
    </div>
  );
}

export default function Salary() {
  const [slips, setSlips] = useState<Payslip[]>([]);
  const [selected, setSelected] = useState<Payslip | null>(null);
  const [bonuses, setBonuses] = useState<MyBonuses | null>(null);
  const [months, setMonths] = useState<MonthlyEarning[]>([]);
  const [requests, setRequests] = useState<PayrollRequestEntry[]>([]);
  const [loans, setLoans] = useState<MyLoan[]>([]);
  const [advances, setAdvances] = useState<MyAdvance[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);

  const loadRequests = () => employeePortalApi.payrollRequests().then(setRequests).catch(() => setRequests([]));

  useEffect(() => {
    employeePortalApi.payslips().then(setSlips).catch(() => setSlips([]));
    employeePortalApi.bonuses().then(setBonuses).catch(() => setBonuses(null));
    employeePortalApi.monthlyEarnings().then(setMonths).catch(() => setMonths([]));
    employeePortalApi.myLoans().then(setLoans).catch(() => setLoans([]));
    employeePortalApi.myAdvances().then(setAdvances).catch(() => setAdvances([]));
    loadRequests();
  }, []);

  // Open the official payslip behind a month row (loaded already, else fetched by id).
  const openOfficial = (id: number) => {
    const found = slips.find((s) => s.id === id);
    if (found) { setSelected(found); return; }
    employeePortalApi.payslip(id).then(setSelected).catch(() => {});
  };

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

      {/* Money requests — advance / loan repayment / other; admin approves */}
      <div className="flex items-center justify-between px-4 pb-1 pt-3">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground">My Money Requests</h3>
        <button onClick={() => setSheetOpen(true)}
          className="flex h-8 items-center gap-1 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground active:scale-95">
          <Plus className="h-4 w-4" /> Raise
        </button>
      </div>
      <div className="mx-3 mb-2 divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
        {requests.length === 0 ? (
          <EmptyState message="No requests yet. Tap Raise to ask for an advance or repay a loan." />
        ) : (
          requests.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <HandCoins className="h-4 w-4 shrink-0 text-emerald-500" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {REQ_LABEL[r.requestType] || r.requestType}
                    {r.requestType === 'OTHER' && r.direction === 'CREDIT' && <span className="ml-1 text-emerald-600">(reimbursement)</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.targetMonth ? `${MONTHS[r.targetMonth]} ${r.targetYear} · ` : ''}{r.reason || (r.adminRemarks ? `HR: ${r.adminRemarks}` : '')}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-right">
                <span className="text-sm font-semibold">{inr(r.amount)}</span>
                <StatusPill status={r.status} />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Advances & loans — the employee's own balances, read-only */}
      {(advances.length > 0 || loans.length > 0) && (
        <>
          <h3 className="px-4 pb-1 pt-3 text-xs font-semibold uppercase text-muted-foreground">Advances &amp; Loans</h3>
          <div className="mx-3 mb-2 divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
            {advances.map((a) => (
              <div key={`a-${a.id}`} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Landmark className="h-4 w-4 shrink-0 text-amber-500" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Advance · {inr(a.amount)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      Recovered {inr(a.recoveredAmount || 0)}{a.monthlyRecovery ? ` · ${inr(a.monthlyRecovery)}/mo` : ''}{a.reason ? ` · ${a.reason}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-right">
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">Balance</p>
                    <p className="text-sm font-semibold text-rose-600">{inr(a.balance)}</p>
                  </div>
                  {a.status && <StatusPill status={a.status} />}
                </div>
              </div>
            ))}
            {loans.map((l) => (
              <div key={`l-${l.id}`} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Landmark className="h-4 w-4 shrink-0 text-emerald-500" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Loan · {inr(l.principal)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      EMI {inr(l.emiAmount)} · Repaid {inr(l.recoveredAmount || 0)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-right">
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">Balance</p>
                    <p className="text-sm font-semibold text-rose-600">{inr(l.balance)}</p>
                  </div>
                  {l.status && <StatusPill status={l.status} />}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="flex items-center justify-between px-4 pb-1 pt-3">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground">Monthly Earnings</h3>
        <span className="text-[10px] text-muted-foreground">Amount + incentive per month</span>
      </div>
      <div className="mx-3 mb-6 divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
        {months.length === 0 ? (
          <EmptyState message="No earnings to show yet." />
        ) : (
          months.map((m) => {
            const tappable = !!m.official;
            const Row: any = tappable ? 'button' : 'div';
            return (
              <Row
                key={`${m.year}-${m.month}`}
                {...(tappable ? { onClick: () => openOfficial(m.official!.id) } : {})}
                className={`flex w-full items-center justify-between px-4 py-3 text-left ${tappable ? 'active:bg-accent/40' : ''}`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {MONTHS[m.month]} {m.year}
                    {m.current && <span className="ml-2 text-[10px] font-normal text-amber-600">running</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Amount {inr(m.amount)}
                    {m.incentive > 0 && <> · Incentive <span className="text-emerald-600">{inr(m.incentive)}</span></>}
                    {m.bonus > 0 && <> · Bonus {inr(m.bonus)}</>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 pl-2 text-right">
                  <div>
                    <p className="text-sm font-semibold text-emerald-600">{inr(m.total)}</p>
                    <p className="mt-0.5">
                      {m.official
                        ? <StatusPill status={m.official.status} />
                        : <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Preview</span>}
                    </p>
                  </div>
                  {tappable && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </div>
              </Row>
            );
          })
        )}
      </div>
      <p className="mx-4 mb-6 -mt-3 text-[11px] leading-snug text-muted-foreground">
        Preview months are auto-calculated from your attendance and incentives. Final payslips are issued by HR.
      </p>

      {sheetOpen && (
        <RequestSheet
          loans={loans}
          advances={advances}
          onClose={() => setSheetOpen(false)}
          onSaved={() => { setSheetOpen(false); loadRequests(); }}
        />
      )}
    </div>
  );
}

import { BaseInput } from '@/components/ui/input';
import { useEffect, useState } from 'react';
import { ChevronRight, Gift, Plus, X, HandCoins, Landmark, Download } from 'lucide-react';
import { employeePortalApi } from '@/api/employeePortalApi';
import { Payslip, MyBonuses, MonthlyEarning, PayrollRequestEntry, MyLoan, MyAdvance, PayrollRequestType } from '@/types/employeePortal';
import { PortalHeader, StatusPill, EmptyState, inr } from './_shared';
import { printPayslip, payslipRows } from './printPayslip';

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const REQ_LABEL: Record<string, string> = {
  ADVANCE: 'Borrow money', REPAY: 'Repay money',
  // older requests raised before the two-option form
  LOAN_REPAYMENT: 'Loan repayment', ADVANCE_REPAYMENT: 'Advance repayment', SET_RECOVERY: 'Repay plan', OTHER: 'Other',
};
// Request status in plain words for the employee.
const REQ_STATUS: Record<string, string> = {
  PENDING: 'Waiting', APPROVED: 'Approved', CONVERTED: 'Given', APPLIED: 'On payslip', REJECTED: 'Rejected',
};
const BONUS_LABEL: Record<string, string> = {
  PROJECT_COMPLETION: 'Project Completion', QUALITY: 'Quality', PERFORMANCE: 'Performance',
  TARGET_ACHIEVEMENT: 'Target Achievement', FESTIVAL: 'Festival', ATTENDANCE: 'Attendance',
  MANUAL: 'Manual', INCENTIVE: 'Incentive', OTHER: 'Bonus',
};

function PayslipDetail({ slip, onBack, employeeName, employeeCode }: { slip: Payslip; onBack: () => void; employeeName?: string; employeeCode?: string }) {
  const monthlyHours = slip.standardHours != null; // MONTHLY generated from hours
  const hourly = slip.payType === 'HOURLY' || monthlyHours;
  const { earnings, deductions } = payslipRows(slip); // same rows as the PDF
  const [printing, setPrinting] = useState(false);
  const download = () => {
    setPrinting(true);
    printPayslip(slip, { employeeName, employeeCode }).finally(() => setPrinting(false));
  };
  const rows = (list: [string, number][]) => list.length === 0
    ? <div className="px-4 py-2.5 text-sm text-muted-foreground">None</div>
    : list.map(([l, v], i) => (
        <div key={`${l}-${i}`} className="flex justify-between gap-3 px-4 py-2.5 text-sm"><span className="text-muted-foreground">{l}</span><span className="shrink-0 font-medium">{inr(v)}</span></div>
      ));
  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-card px-2 py-2.5">
        <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full active:bg-accent" aria-label="Back">
          <ChevronRight className="h-5 w-5 rotate-180" />
        </button>
        <h1 className="flex-1 text-base font-semibold">Payslip · {MONTHS[slip.month]} {slip.year}</h1>
        <button onClick={download} disabled={printing}
          className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground active:scale-[0.98] disabled:opacity-60">
          <Download className="h-4 w-4" /> PDF
        </button>
        <StatusPill status={slip.status} />
      </div>

      <div className="m-3 rounded-xl border bg-card p-4 text-center shadow-sm">
        <p className="text-xs text-muted-foreground">Net Pay</p>
        <p className="text-3xl font-bold text-emerald-600">{inr(slip.netSalary)}</p>
        {slip.payslipNumber && <p className="mt-1 text-[11px] text-muted-foreground">{slip.payslipNumber}</p>}
      </div>

      <div className="mx-3 grid grid-cols-3 gap-2 pb-3 text-center">
        {(hourly
          ? [['Days', slip.attendanceDays], [monthlyHours ? `Hrs / ${slip.standardHours}` : 'Hrs', slip.workedHours], ['OT hrs', slip.overtimeHours]]
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
        {rows(earnings)}
        <div className="flex justify-between bg-muted/40 px-4 py-2.5 text-sm font-semibold"><span>Gross</span><span>{inr(slip.grossEarnings)}</span></div>
      </div>

      <h3 className="px-4 pb-1 text-xs font-semibold uppercase text-muted-foreground">Deductions</h3>
      <div className="mx-3 mb-6 divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
        {rows(deductions)}
        <div className="flex justify-between bg-muted/40 px-4 py-2.5 text-sm font-semibold"><span>Total</span><span>{inr(slip.totalDeductions)}</span></div>
      </div>

      {slip.remarks && (
        <div className="mx-3 -mt-3 mb-6 rounded-xl border bg-card px-4 py-3 text-sm shadow-sm">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Note from HR</p>
          <p className="mt-1 whitespace-pre-wrap">{slip.remarks}</p>
        </div>
      )}
    </div>
  );
}

const now = new Date();

function RequestSheet({ owed, onClose, onSaved }: { owed: number; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState<'ADVANCE' | 'REPAY'>(owed > 0 ? 'REPAY' : 'ADVANCE');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [monthlyRecovery, setMonthlyRecovery] = useState('');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    const amt = Number(amount);
    if (!amt || amt <= 0) { setError('Enter an amount greater than zero.'); return; }
    if (type === 'REPAY' && amt > owed) { setError(`You owe ${inr(owed)} — enter that or less.`); return; }
    setSaving(true);
    try {
      await employeePortalApi.createPayrollRequest({
        requestType: type as PayrollRequestType,
        amount: amt,
        reason: reason || undefined,
        ...(type === 'ADVANCE'
          ? { monthlyRecovery: monthlyRecovery ? Number(monthlyRecovery) : undefined }
          : { targetMonth: month, targetYear: year }),
      });
      onSaved();
    } catch (e: any) {
      setError(e?.message || 'Could not submit request.');
    } finally {
      setSaving(false);
    }
  };

  const choices: { value: 'ADVANCE' | 'REPAY'; title: string; hint: string; disabled?: boolean }[] = [
    { value: 'ADVANCE', title: 'Borrow money', hint: 'Get money now, pay it back from salary' },
    { value: 'REPAY', title: 'Repay money', hint: owed > 0 ? `Pay back from a month's salary · you owe ${inr(owed)}` : 'You don’t owe anything', disabled: owed <= 0 },
  ];

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/40" onClick={onClose}>
      <div className="mx-auto max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-card p-4 pb-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Money request</h2>
          <button onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full active:bg-accent"><X className="h-5 w-5" /></button>
        </div>
        {error && <p className="mb-2 rounded-md bg-destructive/15 p-2 text-xs text-destructive">{error}</p>}
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            {choices.map((c) => (
              <button key={c.value} type="button" disabled={c.disabled} onClick={() => setType(c.value)}
                className={`rounded-xl border p-3 text-left transition-colors disabled:opacity-50 ${type === c.value ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'bg-card'}`}>
                <p className="text-sm font-semibold">{c.title}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{c.hint}</p>
              </button>
            ))}
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">{type === 'ADVANCE' ? 'How much do you need? (₹)' : 'How much to repay? (₹)'}</label>
            <BaseInput type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" placeholder="2000" />
          </div>

          {type === 'ADVANCE' ? (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Pay back per month (optional)</label>
              <BaseInput type="number" inputMode="numeric" value={monthlyRecovery} onChange={(e) => setMonthlyRecovery(e.target.value)}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" placeholder="Leave empty to repay it all next salary" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">From salary of</label>
                <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm">
                  {MONTHS.slice(1).map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Year</label>
                <BaseInput type="number" inputMode="numeric" value={year} onChange={(e) => setYear(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground">Reason</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" placeholder="Optional note for HR" />
          </div>

          <p className="text-[11px] leading-snug text-muted-foreground">
            HR approves it when they make your payslip. It then shows on that month's payslip automatically.
          </p>

          <button onClick={submit} disabled={saving}
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground active:scale-[0.99] disabled:opacity-60">
            {saving ? 'Sending…' : 'Send request'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Salary() {
  const [selected, setSelected] = useState<Payslip | null>(null);
  const [bonuses, setBonuses] = useState<MyBonuses | null>(null);
  const [months, setMonths] = useState<MonthlyEarning[]>([]);
  const [requests, setRequests] = useState<PayrollRequestEntry[]>([]);
  const [loans, setLoans] = useState<MyLoan[]>([]);
  const [advances, setAdvances] = useState<MyAdvance[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [me, setMe] = useState<{ name: string; code: string } | null>(null);

  const loadRequests = () => employeePortalApi.payrollRequests().then(setRequests).catch(() => setRequests([]));
  const loadOwed = () => {
    employeePortalApi.myLoans().then(setLoans).catch(() => setLoans([]));
    employeePortalApi.myAdvances().then(setAdvances).catch(() => setAdvances([]));
  };
  // One "you owe" figure — open advances and loans together.
  const debts = [
    ...advances.filter((a) => a.balance > 0 && a.status !== 'RECOVERED' && a.status !== 'PENDING')
      .map((a) => ({ key: `a-${a.id}`, date: a.advanceDate, amount: a.amount, balance: a.balance, perMonth: a.monthlyRecovery })),
    ...loans.filter((l) => l.balance > 0 && l.status !== 'CLOSED')
      .map((l) => ({ key: `l-${l.id}`, date: l.disbursedDate, amount: l.principal, balance: l.balance, perMonth: l.emiAmount })),
  ];
  const owed = debts.reduce((sum, d) => sum + Number(d.balance || 0), 0);

  useEffect(() => {
    employeePortalApi.me().then((p) => setMe({ name: `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim(), code: p.employeeCode })).catch(() => {});
    employeePortalApi.bonuses().then(setBonuses).catch(() => setBonuses(null));
    employeePortalApi.monthlyEarnings().then(setMonths).catch(() => setMonths([]));
    loadOwed();
    loadRequests();
  }, []);

  // Open the official payslip behind a month row (loaded already, else fetched by id).
  // Always fetch by id so the full payslip (incl. admin-added line items) is loaded for view + download.
  const openOfficial = (id: number) => {
    employeePortalApi.payslip(id).then(setSelected).catch(() => {});
  };

  if (selected) return <PayslipDetail slip={selected} onBack={() => setSelected(null)} employeeName={me?.name} employeeCode={me?.code} />;

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
        <h3 className="text-xs font-semibold uppercase text-muted-foreground">Borrow &amp; repay</h3>
        <button onClick={() => setSheetOpen(true)}
          className="flex h-8 items-center gap-1 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground active:scale-95">
          <Plus className="h-4 w-4" /> New request
        </button>
      </div>
      <div className="mx-3 mb-2 divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
        {requests.length === 0 ? (
          <EmptyState message="No requests yet. Tap New request to borrow money or repay what you owe." />
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
                <StatusPill status={r.status} label={REQ_STATUS[r.status]} />
              </div>
            </div>
          ))
        )}
      </div>

      {/* What they owe — open advances and loans as one balance */}
      {owed > 0 && (
        <>
          <h3 className="px-4 pb-1 pt-3 text-xs font-semibold uppercase text-muted-foreground">You owe</h3>
          <div className="mx-3 mb-2 overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-2">
                <Landmark className="h-5 w-5 text-rose-500" />
                <div>
                  <p className="text-lg font-bold text-rose-600">{inr(owed)}</p>
                  <p className="text-[11px] text-muted-foreground">Taken from your salary each month until it's paid back</p>
                </div>
              </div>
            </div>
            <div className="divide-y border-t">
              {debts.map((d) => (
                <div key={d.key} className="flex items-center justify-between gap-3 px-4 py-2 text-xs">
                  <span className="text-muted-foreground">
                    Borrowed {inr(d.amount)}{d.date ? ` · ${d.date}` : ''}{Number(d.perMonth) > 0 ? ` · ${inr(d.perMonth)}/mo` : ''}
                  </span>
                  <span className="font-semibold">{inr(d.balance)} left</span>
                </div>
              ))}
            </div>
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
        Preview months are auto-calculated from your attendance and incentives. A payslip appears here once HR approves it.
      </p>

      {sheetOpen && (
        <RequestSheet
          owed={owed}
          onClose={() => setSheetOpen(false)}
          onSaved={() => { setSheetOpen(false); loadRequests(); loadOwed(); }}
        />
      )}
    </div>
  );
}

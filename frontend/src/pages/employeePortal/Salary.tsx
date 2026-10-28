import { BaseInput } from '@/components/ui/input';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useT, dateLocale } from '@/i18n';
import { ChevronRight, Gift, Plus, X, HandCoins, Landmark, Download } from 'lucide-react';
import { employeePortalApi } from '@/api/employeePortalApi';
import { Payslip, MyBonuses, MonthlyEarning, PayrollRequestEntry, MyLoan, MyAdvance, PayrollRequestType } from '@/types/employeePortal';
import { toast } from '@/components/ui/toast';
import { PortalHeader, StatusPill, EmptyState, inr } from './_shared';
import { printPayslip, payslipRows, type PayslipEmployee } from './printPayslip';

/** Localized short month names, index 1..12 (index 0 is blank so MONTHS[m] works with 1-based months). */
function useMonths(): string[] {
  const { lang } = useT();
  return useMemo(() => ['', ...Array.from({ length: 12 }, (_, i) => new Date(2023, i, 1).toLocaleDateString(dateLocale(lang), { month: 'short' }))], [lang]);
}

/** Translate by key, falling back to the raw value when a key has no entry (unknown backend codes). */
function useTr() {
  const { t } = useT();
  return (key: string, fallback: string) => { const v = t(key); return v === key ? fallback : v; };
}

function PayslipDetail({ slip, onBack, employee, requests = [] }: { slip: Payslip; onBack: () => void; employee?: PayslipEmployee; requests?: PayrollRequestEntry[] }) {
  const { t } = useT();
  const MONTHS = useMonths();
  const monthlyHours = slip.standardHours != null; // MONTHLY generated from hours
  const hourly = slip.payType === 'HOURLY' || monthlyHours;
  const { earnings, deductions, paid } = payslipRows(slip); // same rows as the PDF
  const [printing, setPrinting] = useState(false);
  const download = () => {
    setPrinting(true);
    printPayslip(slip, employee).finally(() => setPrinting(false));
  };
  const paidTotal = Number(slip.alreadyPaid || 0);
  // The travel / food requests that went onto this payslip: one pay line each kind, the detail is here.
  const allowances = requests.filter((r) => r.requestType === 'ALLOWANCE' && r.appliedSalaryRecordId === slip.id);
  const rows = (list: [string, number][]) => list.length === 0
    ? <div className="px-4 py-2.5 text-sm text-muted-foreground">{t('pw.sal.none')}</div>
    : list.map(([l, v], i) => (
        <div key={`${l}-${i}`} className="flex justify-between gap-3 px-4 py-2.5 text-sm"><span className="text-muted-foreground">{l}</span><span className="shrink-0 font-medium">{inr(v)}</span></div>
      ));
  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-card px-2 py-2.5">
        <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full active:bg-accent" aria-label={t('pw.back')}>
          <ChevronRight className="h-5 w-5 rotate-180" />
        </button>
        <h1 className="flex-1 text-base font-semibold">{t('pw.sal.payslip', { month: MONTHS[slip.month], year: slip.year })}</h1>
        <button onClick={download} disabled={printing}
          className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground active:scale-[0.98] disabled:opacity-60">
          <Download className="h-4 w-4" /> {t('pw.sal.pdf')}
        </button>
        <StatusPill status={slip.status} label={slip.status === 'PREVIEW' ? t('pw.sal.preview') : undefined} />
      </div>
      {(slip.status === 'PREVIEW' || slip.status === 'PENDING') && (
        <p className="mx-3 mt-3 rounded-lg border border-dashed border-amber-400 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          {slip.status === 'PENDING' ? t('pw.sal.pendingBanner') : t('pw.sal.previewBanner')}
        </p>
      )}

      <div className="m-3 rounded-xl border bg-card p-4 text-center shadow-sm">
        <p className="text-xs text-muted-foreground">{t('pw.sal.netPay')}</p>
        <p className="text-3xl font-bold text-emerald-600">{inr(slip.netSalary)}</p>
        {slip.payslipNumber && <p className="mt-1 text-[11px] text-muted-foreground">{slip.payslipNumber}</p>}
      </div>

      <div className="mx-3 grid grid-cols-3 gap-2 pb-3 text-center">
        {(hourly
          ? [[t('pw.sal.days'), slip.attendanceDays], [monthlyHours ? t('pw.sal.hrsOf', { std: slip.standardHours ?? '' }) : t('pw.sal.hrs'), slip.workedHours], [t('pw.sal.otHrs'), slip.overtimeHours]]
          : [[t('pw.sal.working'), slip.workingDays], [t('pw.sal.paid'), slip.paidDays], [t('pw.sal.lop'), slip.lopDays]]
        ).map(([l, v]) => (
          <div key={l as string} className="rounded-lg border bg-card p-2 shadow-sm">
            <p className="text-base font-bold leading-none">{v ?? '—'}</p>
            <p className="mt-1 text-[10px] uppercase text-muted-foreground">{l}</p>
          </div>
        ))}
      </div>

      <h3 className="px-4 pb-1 text-xs font-semibold uppercase text-muted-foreground">{t('pw.sal.earnings')}</h3>
      <div className="mx-3 mb-3 divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
        {rows(earnings)}
        <div className="flex justify-between bg-muted/40 px-4 py-2.5 text-sm font-semibold"><span>{t('pw.sal.gross')}</span><span>{inr(slip.grossEarnings)}</span></div>
      </div>

      <h3 className="px-4 pb-1 text-xs font-semibold uppercase text-muted-foreground">{t('pw.sal.deductions')}</h3>
      <div className="mx-3 mb-6 divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
        {rows(deductions)}
        <div className="flex justify-between bg-muted/40 px-4 py-2.5 text-sm font-semibold"><span>{t('pw.sal.total')}</span><span>{inr(slip.totalDeductions)}</span></div>
      </div>

      {paidTotal > 0 && (
        <>
          <h3 className="px-4 pb-1 text-xs font-semibold uppercase text-muted-foreground">Payments already made</h3>
          <div className="mx-3 mb-6 divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
            {rows(paid)}
            {allowances.map((r) => (
              <div key={r.id} className="flex justify-between gap-3 px-4 py-2 text-xs text-muted-foreground">
                <span>{r.allowanceType === 'FOOD' ? 'Food' : 'Travel'} · {r.requestDate ?? ''}{r.alreadyPaid ? ` · paid${r.paidOn ? ` ${r.paidOn}` : ''}${r.paidMode ? ` (${r.paidMode})` : ''}` : ''}</span>
                <span className="shrink-0">{inr(r.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between bg-muted/40 px-4 py-2.5 text-sm font-semibold"><span>Already paid</span><span>{inr(paidTotal)}</span></div>
            <div className="flex justify-between bg-muted/40 px-4 py-2.5 text-sm font-semibold"><span>Balance payable</span><span>{inr(Number(slip.netSalary || 0) - paidTotal)}</span></div>
          </div>
        </>
      )}

      {slip.remarks && (
        <div className="mx-3 -mt-3 mb-6 rounded-xl border bg-card px-4 py-3 text-sm shadow-sm">
          <p className="text-xs font-semibold uppercase text-muted-foreground">{t('pw.sal.hrNote')}</p>
          <p className="mt-1 whitespace-pre-wrap">{slip.remarks}</p>
        </div>
      )}
    </div>
  );
}

const now = new Date();

function RequestSheet({ owed, borrow, onClose, onSaved }: { owed: number; borrow?: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useT();
  const MONTHS = useMonths();
  const [type, setType] = useState<'ADVANCE' | 'REPAY' | 'ALLOWANCE'>(!borrow && owed > 0 ? 'REPAY' : 'ADVANCE');
  const [allowanceType, setAllowanceType] = useState<'TRAVEL' | 'FOOD'>('TRAVEL');
  const [spentOn, setSpentOn] = useState(new Date().toISOString().slice(0, 10));
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
    if (!amt || amt <= 0) { setError(t('pw.sal.amountErr')); return; }
    if (type === 'REPAY' && amt > owed) { setError(t('pw.sal.oweErr', { amount: inr(owed) })); return; }
    setSaving(true);
    try {
      await employeePortalApi.createPayrollRequest({
        requestType: type as PayrollRequestType,
        amount: amt,
        reason: reason || undefined,
        ...(type === 'ALLOWANCE'
          ? { allowanceType, requestDate: spentOn }
          : type === 'ADVANCE'
            ? { monthlyRecovery: monthlyRecovery ? Number(monthlyRecovery) : undefined }
            : { targetMonth: month, targetYear: year }),
      });
      onSaved();
    } catch (e: any) {
      setError(e?.message || t('pw.sal.submitFailed'));
    } finally {
      setSaving(false);
    }
  };

  const choices: { value: 'ADVANCE' | 'REPAY' | 'ALLOWANCE'; title: string; hint: string; disabled?: boolean }[] = [
    { value: 'ADVANCE', title: t('pw.sal.req.ADVANCE'), hint: t('pw.sal.borrowHint') },
    { value: 'REPAY', title: t('pw.sal.req.REPAY'), hint: owed > 0 ? t('pw.sal.repayHint', { amount: inr(owed) }) : t('pw.sal.owNothing'), disabled: owed <= 0 },
    { value: 'ALLOWANCE', title: 'Travel / food', hint: 'Ask HR to add a travel or food allowance to your pay' },
  ];

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/40" onClick={onClose}>
      <div className="mx-auto max-h-[90dvh] w-full max-w-md sm:max-w-lg overflow-y-auto rounded-t-2xl bg-card p-4 pb-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{t('pw.sal.moneyRequest')}</h2>
          <button onClick={onClose} aria-label={t('pw.close')} className="flex h-8 w-8 items-center justify-center rounded-full active:bg-accent"><X className="h-5 w-5" /></button>
        </div>
        {error && <p className="mb-2 rounded-md bg-destructive/15 p-2 text-xs text-destructive">{error}</p>}
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2">
            {choices.map((c) => (
              <button key={c.value} type="button" disabled={c.disabled} onClick={() => setType(c.value)}
                className={`rounded-xl border p-3 text-left transition-colors disabled:opacity-50 ${type === c.value ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'bg-card'}`}>
                <p className="text-sm font-semibold">{c.title}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{c.hint}</p>
              </button>
            ))}
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">{type === 'ALLOWANCE' ? 'Amount you spent' : type === 'ADVANCE' ? t('pw.sal.howMuchNeed') : t('pw.sal.howMuchRepay')}</label>
            <BaseInput type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" placeholder="2000" />
          </div>

          {type === 'ALLOWANCE' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">For</label>
                <select value={allowanceType} onChange={(e) => setAllowanceType(e.target.value as 'TRAVEL' | 'FOOD')}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm">
                  <option value="TRAVEL">Travel</option>
                  <option value="FOOD">Food</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Date</label>
                <BaseInput type="date" value={spentOn} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setSpentOn(e.target.value)}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
              </div>
            </div>
          ) : type === 'ADVANCE' ? (
            <div>
              <label className="text-xs font-medium text-muted-foreground">{t('pw.sal.perMonthOpt')}</label>
              <BaseInput type="number" inputMode="numeric" value={monthlyRecovery} onChange={(e) => setMonthlyRecovery(e.target.value)}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" placeholder={t('pw.sal.perMonthPh')} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">{t('pw.sal.fromSalaryOf')}</label>
                <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm">
                  {MONTHS.slice(1).map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">{t('pw.sal.year')}</label>
                <BaseInput type="number" inputMode="numeric" value={year} onChange={(e) => setYear(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground">{t('pw.sal.reason')}</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" placeholder={t('pw.sal.reasonPh')} />
          </div>

          <p className="text-[11px] leading-snug text-muted-foreground">
            {t('pw.sal.approvalNote')}
          </p>

          <button onClick={submit} disabled={saving}
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground active:scale-[0.99] disabled:opacity-60">
            {saving ? t('pw.sal.sending') : t('pw.sal.sendRequest')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Salary() {
  const { t } = useT();
  const tr = useTr();
  const MONTHS = useMonths();
  const [selected, setSelected] = useState<Payslip | null>(null);
  const [bonuses, setBonuses] = useState<MyBonuses | null>(null);
  const [months, setMonths] = useState<MonthlyEarning[]>([]);
  const [requests, setRequests] = useState<PayrollRequestEntry[]>([]);
  const [loans, setLoans] = useState<MyLoan[]>([]);
  const [advances, setAdvances] = useState<MyAdvance[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [sheetOpen, setSheetOpen] = useState(searchParams.get('borrow') === '1');
  const [borrowIntent] = useState(searchParams.get('borrow') === '1');
  const [me, setMe] = useState<PayslipEmployee | null>(null);

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
    employeePortalApi.me().then((p) => setMe({ employeeName: `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim(), employeeCode: p.employeeCode, designation: p.designation, department: p.department?.name, dateOfJoining: p.dateOfJoining, bankAccount: p.bankAccount, uan: p.uan, pfNumber: p.pfNumber, esiNumber: p.esiNumber })).catch(() => {});
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

  const openPreview = (month: number, year: number) => {
    employeePortalApi.previewPayslip(month, year).then(setSelected)
      .catch((e) => toast.error(e?.response?.data?.message || e?.message || 'Could not build the preview.'));
  };

  if (selected) return <PayslipDetail slip={selected} onBack={() => setSelected(null)} employee={me ?? undefined} requests={requests} />;

  return (
    <div className="flex flex-col">
      <PortalHeader title={t('pw.sal.title')} />

      {bonuses && bonuses.bonuses.length > 0 && (
        <>
          <div className="mx-3 mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl border bg-emerald-50 p-3 text-center">
              <p className="text-[10px] uppercase text-emerald-700/70">{t('pw.sal.bonusReceived')}</p>
              <p className="text-lg font-bold text-emerald-700">{inr(bonuses.bonusPaidTotal)}</p>
            </div>
            <div className="rounded-xl border bg-amber-50 p-3 text-center">
              <p className="text-[10px] uppercase text-amber-700/70">{t('pw.sal.bonusPending')}</p>
              <p className="text-lg font-bold text-amber-700">{inr(bonuses.bonusPendingTotal)}</p>
            </div>
          </div>
          <h3 className="px-4 pb-1 pt-3 text-xs font-semibold uppercase text-muted-foreground">{t('pw.sal.bonusesIncentives')}</h3>
          <div className="mx-3 mb-2 divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
            {bonuses.bonuses.map((b) => (
              <div key={b.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <Gift className="h-4 w-4 text-pink-500" />
                  <div>
                    <p className="text-sm font-medium">{tr(`pw.sal.bonus.${b.bonusType}`, b.bonusType)}</p>
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
        <h3 className="text-xs font-semibold uppercase text-muted-foreground">{t('pw.sal.borrowRepay')}</h3>
        <button onClick={() => setSheetOpen(true)}
          className="flex h-8 items-center gap-1 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground active:scale-95">
          <Plus className="h-4 w-4" /> {t('pw.sal.newRequest')}
        </button>
      </div>
      <div className="mx-3 mb-2 divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
        {requests.length === 0 ? (
          <EmptyState message={t('pw.sal.noRequests')} />
        ) : (
          requests.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <HandCoins className="h-4 w-4 shrink-0 text-emerald-500" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {r.requestType === 'ALLOWANCE'
                      ? `${r.allowanceType === 'FOOD' ? 'Food' : 'Travel'} allowance`
                      : tr(`pw.sal.req.${r.requestType}`, r.requestType)}
                    {r.requestType === 'OTHER' && r.direction === 'CREDIT' && <span className="ml-1 text-emerald-600">{t('pw.sal.reimbursement')}</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.requestType === 'ALLOWANCE' && r.requestDate ? `${r.requestDate} · ` : r.targetMonth ? `${MONTHS[r.targetMonth]} ${r.targetYear} · ` : ''}{r.reason || (r.adminRemarks ? t('pw.sal.hrPrefix', { text: r.adminRemarks }) : '')}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-right">
                <span className="text-sm font-semibold">{inr(r.amount)}</span>
                <StatusPill status={r.status} label={tr(`pw.sal.reqStatus.${r.status}`, r.status)} />
              </div>
            </div>
          ))
        )}
      </div>

      {/* What they owe — open advances and loans as one balance */}
      {owed > 0 && (
        <>
          <h3 className="px-4 pb-1 pt-3 text-xs font-semibold uppercase text-muted-foreground">{t('pw.sal.youOwe')}</h3>
          <div className="mx-3 mb-2 overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-2">
                <Landmark className="h-5 w-5 text-rose-500" />
                <div>
                  <p className="text-lg font-bold text-rose-600">{inr(owed)}</p>
                  <p className="text-[11px] text-muted-foreground">{t('pw.sal.owedNote')}</p>
                </div>
              </div>
            </div>
            <div className="divide-y border-t">
              {debts.map((d) => (
                <div key={d.key} className="flex items-center justify-between gap-3 px-4 py-2 text-xs">
                  <span className="text-muted-foreground">
                    {t('pw.sal.borrowed', { amount: inr(d.amount) })}{d.date ? ` · ${d.date}` : ''}{Number(d.perMonth) > 0 ? ` · ${t('pw.sal.perMonth', { amount: inr(d.perMonth) })}` : ''}
                  </span>
                  <span className="font-semibold">{t('pw.sal.left', { amount: inr(d.balance) })}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="flex items-center justify-between px-4 pb-1 pt-3">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground">{t('pw.sal.monthlyEarnings')}</h3>
        <span className="text-[10px] text-muted-foreground">{t('pw.sal.amountPlusIncentive')}</span>
      </div>
      <div className="mx-3 mb-6 divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
        {months.length === 0 ? (
          <EmptyState message={t('pw.sal.noEarnings')} />
        ) : (
          months.map((m) => {
            const tappable = true; // official payslip, or a computed preview
            const Row: any = tappable ? 'button' : 'div';
            return (
              <Row
                key={`${m.year}-${m.month}`}
                {...(tappable ? { onClick: () => (m.official ? openOfficial(m.official.id) : openPreview(m.month, m.year)) } : {})}
                className={`flex w-full items-center justify-between px-4 py-3 text-left ${tappable ? 'active:bg-accent/40' : ''}`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {MONTHS[m.month]} {m.year}
                    {m.current && <span className="ml-2 text-[10px] font-normal text-amber-600">{t('pw.sal.running')}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('pw.sal.amountLabel', { amount: inr(m.amount) })}
                    {m.incentive > 0 && <> · {t('pw.sal.incentiveLabel')} <span className="text-emerald-600">{inr(m.incentive)}</span></>}
                    {m.bonus > 0 && <> · {t('pw.sal.bonusLabel')} {inr(m.bonus)}</>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 pl-2 text-right">
                  <div>
                    <p className="text-sm font-semibold text-emerald-600">{inr(m.total)}</p>
                    <p className="mt-0.5">
                      {m.official
                        ? <StatusPill status={m.official.status} />
                        : <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{t('pw.sal.preview')}</span>}
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
        {t('pw.sal.previewNote')}
      </p>

      {sheetOpen && (
        <RequestSheet
          owed={owed}
          borrow={borrowIntent}
          onClose={() => { setSheetOpen(false); if (searchParams.has('borrow')) setSearchParams({}, { replace: true }); }}
          onSaved={() => { setSheetOpen(false); if (searchParams.has('borrow')) setSearchParams({}, { replace: true }); loadRequests(); loadOwed(); }}
        />
      )}
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { payrollApi, type IncentiveReportRow } from "@/api/payrollApi";
import { toast } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const inr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

/** Who earns which incentive in a month, by the Pay rules — read-only; months with no payslip yet are a dry run. */
export default function IncentiveReport({ canEdit, x, y, onX, onY, dirty, saving, onSave, reloadKey }: {
  canEdit: boolean; x: string; y: string; onX: (v: string) => void; onY: (v: string) => void;
  dirty: boolean; saving: boolean; onSave: () => void; reloadKey: number;
}) {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [rows, setRows] = useState<IncentiveReportRow[] | null>(null);

  const load = useCallback(() => {
    const [y, m] = month.split("-").map(Number);
    setRows(null);
    payrollApi.incentiveReport(m, y).then(setRows)
      .catch((e) => { setRows([]); toast.error(e?.response?.data?.message || "Could not load the incentive report"); });
  }, [month]);
  useEffect(() => { load(); }, [load, reloadKey]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 md:p-5">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-slate-900">Who earns what</h3>
          <p className="text-sm text-slate-500">Each employee's incentives for the month under the rules above. Months without a payslip are a preview.</p>
        </div>
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
      </div>
      <div className="mb-3 flex flex-wrap items-end gap-3 rounded-lg bg-slate-50 p-3">
        <label className="text-xs font-medium text-slate-600">X — days needed
          <Input type="number" min={0} value={x} disabled={!canEdit} onChange={(e) => onX(e.target.value)} className="mt-1 h-9 w-28" />
        </label>
        <label className="text-xs font-medium text-slate-600">Y — hours per day
          <Input type="number" min={0} value={y} disabled={!canEdit} onChange={(e) => onY(e.target.value)} className="mt-1 h-9 w-28" />
        </label>
        {canEdit && <Button size="sm" variant="forest" disabled={!dirty || saving} onClick={onSave}>{saving ? "Saving…" : "Save & refresh"}</Button>}
        <p className="basis-full text-[11px] text-slate-500 sm:basis-auto sm:flex-1">Changes the shared attendance rule for everyone. It applies to the attendance bonus only.</p>
      </div>
      {rows === null ? <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        : rows.length === 0 ? <p className="text-sm text-slate-400">No payroll employees.</p>
        : <div className="divide-y divide-slate-100">
          {rows.map((r) => (
            <div key={r.employeeId} className="py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-slate-800">{r.name}</p>
                {r.employeeCode && <span className="text-xs text-slate-400">{r.employeeCode}</span>}
                {!r.bonusEligible && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">not bonus-eligible</span>}
                <span className="ml-auto text-sm font-bold tabular-nums text-slate-900">{inr(r.total || 0)}</span>
              </div>
              {r.attendance.enabled && (
                <p className={`mt-1 flex items-center gap-1 text-xs ${r.attendance.met ? "text-emerald-700" : "text-amber-700"}`}>
                  {r.attendance.met ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                  Attendance: {r.attendance.qualifyingDays}/{r.attendance.daysNeeded} days of {r.attendance.hoursPerDay}h+ · {r.attendance.totalHours}/{r.attendance.totalHoursNeeded} h total
                </p>
              )}
              {r.error ? <p className="mt-1 text-xs text-slate-400">{r.error}</p> : (
                <>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {(r.lines || []).map((l, i) => (
                      <span key={i} className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800">{l.label} · {inr(l.amount)}</span>
                    ))}
                    {(r.lines || []).length === 0 && <span className="text-[11px] text-slate-400">No incentives</span>}
                    <span className="text-[11px] text-slate-400">{r.generated ? "payslip generated" : "preview"}</span>
                  </div>
                  {(r.lines || []).length === 0 && r.note && <p className="mt-1 text-[11px] text-slate-500">{r.note}</p>}
                </>
              )}
            </div>
          ))}
        </div>}
    </section>
  );
}

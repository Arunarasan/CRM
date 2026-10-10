import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { payrollApi } from "@/api/payrollApi";
import type { PayrollPreviewRow } from "@/types/payroll";
import { inr } from "@/pages/workforce/WorkforceFinanceTab";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { SearchField } from "@/pages/workforce/hrUi";
import { Clock, PlayCircle, CircleHelp, FileText, Settings2, Pencil } from "lucide-react";

type Basis = "HOURLY" | "MONTHLY";

const n = (v: any) => Number(v || 0);
const hrs = (v: any) => n(v).toFixed(1).replace(/\.0$/, "");

/**
 * The one place payslips are generated. Every employee's month is shown as attendance hours, priced
 * both ways — HOURLY (hours × rate) and MONTHLY (salary ÷ standard hours × hours worked, capped at
 * the salary) — and HR taps the one to use. Pre-selected = the employee's usual basis (last used).
 * Generating applies approved bonuses / deductions / advance & loan recovery on top.
 */
export default function GeneratePayslips({
  month, year, canProcess, onGenerated, onEditWage, onOpenSlip, onReview,
}: {
  month: number;
  year: number;
  canProcess: boolean;
  onGenerated: () => void;
  onEditWage?: (employeeId: number) => void;
  /** Open the full payslip editor for one employee (after generating, or from a generated row). */
  onOpenSlip?: (employeeId: number, name?: string) => void;
  /** Several were generated — take HR to the "To approve" list to check each one. */
  onReview?: () => void;
}) {
  const [rows, setRows] = useState<PayrollPreviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [choice, setChoice] = useState<Record<number, Basis>>({});
  const [picked, setPicked] = useState<Record<number, boolean>>({});
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    payrollApi.payrollPreview(month, year)
      .then((r) => {
        setRows(r);
        const c: Record<number, Basis> = {};
        const p: Record<number, boolean> = {};
        r.forEach((x) => {
          if (x.defaultBasis) c[x.employeeId] = x.defaultBasis;
          // Pre-tick only people who actually logged hours — avoids generating ₹0 payslips by accident.
          p[x.employeeId] = !x.recordId && !!x.defaultBasis && n(x.workedHours) > 0;
        });
        setChoice(c); setPicked(p);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };
  useEffect(load, [month, year]);

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(s) || (r.employeeCode || "").toLowerCase().includes(s));
  }, [rows, q]);

  const pending = rows.filter((r) => !r.recordId);
  const selected = pending.filter((r) => picked[r.employeeId] && choice[r.employeeId]);
  const selectedTotal = selected.reduce((a, r) => a + n(choice[r.employeeId] === "HOURLY" ? r.hourly.total : r.monthly.total), 0);
  const allPicked = pending.length > 0 && pending.every((r) => !r.defaultBasis || picked[r.employeeId]);

  const pick = (r: PayrollPreviewRow, b: Basis) => {
    if (r.recordId || !canProcess) return;
    if (!(b === "HOURLY" ? r.hourly.available : r.monthly.available)) return;
    setChoice((c) => ({ ...c, [r.employeeId]: b }));
    setPicked((p) => ({ ...p, [r.employeeId]: true }));
  };
  const toggleAll = () => {
    const next = !allPicked;
    setPicked((p) => {
      const o = { ...p };
      pending.forEach((r) => { if (choice[r.employeeId]) o[r.employeeId] = next; });
      return o;
    });
  };

  const generate = () => {
    if (selected.length === 0) { toast.error("Pick at least one employee to generate."); return; }
    const choices: Record<number, Basis> = {};
    selected.forEach((r) => { choices[r.employeeId] = choice[r.employeeId]; });
    setBusy(true);
    payrollApi.generatePayslips(month, year, choices)
      .then((r) => {
        if (r.errors?.length) toast.error(`${r.errors.length} failed: ${r.errors[0]}`);
        load(); onGenerated();
        if (r.generated === 0) {
          toast.success(`Nothing generated${r.skipped ? ` — ${r.skipped} skipped` : ""}.`);
        } else if (selected.length === 1 && onOpenSlip) {
          // One payslip — open it straight away so HR can check and edit everything before approving.
          toast.success("Payslip generated. Check it and edit anything before approving.");
          onOpenSlip(selected[0].employeeId, selected[0].name);
        } else {
          toast.success(`${r.generated} payslips generated${r.skipped ? `, ${r.skipped} skipped` : ""}. Open each one to check or edit it before approving.`);
          onReview?.();
        }
      })
      .catch((e) => toast.error(e?.response?.data?.message || "Failed to generate payslips"))
      .finally(() => setBusy(false));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="flex items-center gap-2 font-semibold text-slate-900">
          <Clock className="w-4 h-4 text-slate-500" /> Hours this month — choose Hourly or Monthly
        </h3>
        <SearchField value={q} onChange={setQ} placeholder="Search employee…" className="w-full sm:w-64" />
      </div>

      <p className="flex items-start gap-1.5 text-xs text-slate-500">
        <CircleHelp className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>
          <b>Hourly</b> = hours × hourly rate. <b>Monthly</b> = monthly salary ÷ standard hours × hours worked
          (never more than the full salary). Overtime is paid on top of both. Tap the amount to use — approved
          bonuses, deductions and advance/loan recovery are added when the payslip is generated.
        </span>
      </p>

      {/* desktop */}
      <div className="hidden md:block bg-card border rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[860px]">
          <thead className="bg-slate-50 text-xs font-medium text-slate-500">
            <tr>
              <th className="p-3 w-10">
                {canProcess && pending.length > 0 && (
                  <input type="checkbox" className="h-5 w-5 accent-[hsl(var(--primary))]" checked={allPicked} onChange={toggleAll} aria-label="Select all" />
                )}
              </th>
              <th className="text-left p-3">Employee</th>
              <th className="text-left p-3">Hours</th>
              <th className="text-left p-3">Hourly</th>
              <th className="text-left p-3">Monthly</th>
              <th className="text-right p-3">Payslip</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.employeeId} className="border-t align-top">
                <td className="p-3">
                  {canProcess && !r.recordId && r.defaultBasis && (
                    <input type="checkbox" className="h-5 w-5 accent-[hsl(var(--primary))]" checked={!!picked[r.employeeId]}
                      onChange={(e) => setPicked((p) => ({ ...p, [r.employeeId]: e.target.checked }))} />
                  )}
                </td>
                <td className="p-3"><Person r={r} onEditWage={canProcess ? onEditWage : undefined} /></td>
                <td className="p-3"><Hours r={r} /></td>
                <td className="p-3"><Option r={r} basis="HOURLY" chosen={choice[r.employeeId]} onPick={pick} onEditWage={onEditWage} canProcess={canProcess} /></td>
                <td className="p-3"><Option r={r} basis="MONTHLY" chosen={choice[r.employeeId]} onPick={pick} onEditWage={onEditWage} canProcess={canProcess} /></td>
                <td className="p-3 text-right"><Generated r={r} onOpen={canProcess ? onOpenSlip : undefined} /></td>
              </tr>
            ))}
            {!loading && visible.length === 0 && (
              <tr><td colSpan={6} className="text-center text-slate-400 py-12">No payroll-enabled employees.</td></tr>
            )}
            {loading && <tr><td colSpan={6} className="text-center text-slate-400 py-12">Loading hours…</td></tr>}
          </tbody>
        </table>
      </div>

      {/* mobile */}
      <div className="md:hidden space-y-2">
        {visible.map((r) => (
          <div key={r.employeeId} className="rounded-xl border bg-card p-3 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                {canProcess && !r.recordId && r.defaultBasis && (
                  <input type="checkbox" className="h-5 w-5 accent-[hsl(var(--primary))]" checked={!!picked[r.employeeId]}
                    onChange={(e) => setPicked((p) => ({ ...p, [r.employeeId]: e.target.checked }))} />
                )}
                <Person r={r} onEditWage={canProcess ? onEditWage : undefined} />
              </div>
              <Generated r={r} onOpen={canProcess ? onOpenSlip : undefined} />
            </div>
            <div className="mt-2"><Hours r={r} /></div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Option r={r} basis="HOURLY" chosen={choice[r.employeeId]} onPick={pick} onEditWage={onEditWage} canProcess={canProcess} />
              <Option r={r} basis="MONTHLY" chosen={choice[r.employeeId]} onPick={pick} onEditWage={onEditWage} canProcess={canProcess} />
            </div>
          </div>
        ))}
        {!loading && visible.length === 0 && <p className="text-center text-sm text-slate-400 py-8">No payroll-enabled employees.</p>}
      </div>

      {canProcess && pending.length > 0 && (
        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card/95 p-3 shadow-md backdrop-blur">
          <div className="text-sm text-slate-600">
            <b className="text-slate-900">{selected.length}</b> selected · base pay <b className="text-slate-900">{inr(selectedTotal)}</b>
          </div>
          <Button onClick={generate} disabled={busy || selected.length === 0} className="w-full sm:w-auto">
            <PlayCircle className={`w-4 h-4 mr-1.5 ${busy ? "animate-pulse" : ""}`} />
            {busy ? "Generating…" : `Generate ${selected.length} payslip${selected.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      )}
    </div>
  );
}

function Person({ r, onEditWage }: { r: PayrollPreviewRow; onEditWage?: (employeeId: number) => void }) {
  const initials = (r.name || "?").split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="flex items-center gap-1 min-w-0">
      <Link to={`/hr/employees/${r.employeeId}`} className="group flex items-center gap-2.5 min-w-0">
        <span className="w-8 h-8 shrink-0 rounded-full bg-emerald-100 text-emerald-700 grid place-items-center text-[11px] font-bold">{initials}</span>
        <span className="min-w-0">
          <span className="block font-semibold text-slate-800 truncate group-hover:text-primary">{r.name || "Employee"}</span>
          <span className="block text-[11px] text-slate-400 truncate">{[r.employeeCode, r.designation].filter(Boolean).join(" · ")}</span>
        </span>
      </Link>
      {onEditWage && (
        <button type="button" title="Wage & pay basis" aria-label="Wage & pay basis" onClick={() => onEditWage(r.employeeId)}
          className="shrink-0 rounded p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <Settings2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

function Hours({ r }: { r: PayrollPreviewRow }) {
  const pct = n(r.standardHours) > 0 ? Math.min(100, (n(r.regularHours) / n(r.standardHours)) * 100) : 0;
  return (
    <div className="min-w-[150px]">
      <div className="text-sm">
        <b className="text-slate-900">{hrs(r.workedHours)} h</b>
        <span className="text-slate-400"> / {hrs(r.standardHours)} std</span>
      </div>
      <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full bg-cyan-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 text-[11px] text-slate-500">
        {r.attendanceDays} days{n(r.overtimeHours) > 0 ? ` · ${hrs(r.overtimeHours)} h OT` : ""}
      </div>
    </div>
  );
}

function Option({ r, basis, chosen, onPick, onEditWage, canProcess }: {
  r: PayrollPreviewRow; basis: Basis; chosen?: Basis; canProcess: boolean;
  onPick: (r: PayrollPreviewRow, b: Basis) => void; onEditWage?: (employeeId: number) => void;
}) {
  const o = basis === "HOURLY" ? r.hourly : r.monthly;
  const done = !!r.recordId;
  const active = done ? r.payType === basis : chosen === basis;

  if (!o.available) {
    return (
      <div className="rounded-lg border border-dashed px-3 py-2 text-xs text-slate-400 min-w-[150px]">
        {basis === "HOURLY" ? "No hourly rate" : "No monthly salary"}
        {canProcess && onEditWage && !done && (
          <button type="button" className="block mt-0.5 font-semibold text-primary" onClick={() => onEditWage(r.employeeId)}>
            Set {basis === "HOURLY" ? "rate" : "salary"}
          </button>
        )}
      </div>
    );
  }

  const detail = basis === "HOURLY"
    ? `${inr(r.hourly.rate)}/h${r.hourly.rateSource === "DERIVED" ? " (from salary)" : ""}`
    : `${inr(r.monthly.salary)}/mo`;

  return (
    <button
      type="button"
      onClick={() => onPick(r, basis)}
      disabled={done || !canProcess}
      className={`w-full min-w-[150px] rounded-lg border px-3 py-2 text-left transition-colors ${
        active
          ? basis === "HOURLY" ? "border-cyan-500 bg-cyan-50 ring-1 ring-cyan-500" : "border-violet-500 bg-violet-50 ring-1 ring-violet-500"
          : "bg-white hover:bg-slate-50"
      } ${done && !active ? "opacity-40" : ""} disabled:cursor-default`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[10px] font-bold uppercase ${basis === "HOURLY" ? "text-cyan-700" : "text-violet-700"}`}>
          {basis === "HOURLY" ? "Hourly" : "Monthly"}
        </span>
        {active && <span className="text-[10px] font-bold text-slate-500">{done ? "USED" : "✓"}</span>}
      </div>
      <div className="text-base font-bold text-slate-900">{inr(o.total)}</div>
      <div className="text-[11px] text-slate-500">
        {detail}{n(o.overtime) > 0 ? ` · OT ${inr(o.overtime)}` : ""}
      </div>
    </button>
  );
}

function Generated({ r, onOpen }: { r: PayrollPreviewRow; onOpen?: (employeeId: number, name?: string) => void }) {
  if (!r.recordId) return <span className="text-xs text-slate-400">Not generated</span>;
  return (
    <div className="inline-flex flex-col items-end gap-1">
      <span className="text-sm font-bold text-emerald-600">{inr(r.netSalary)}</span>
      <div className="flex items-center gap-2">
        <a href={`/hr/payslip/${r.recordId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
          <FileText className="w-3 h-3" /> {r.status}
        </a>
        {onOpen && (
          <button type="button" onClick={() => onOpen(r.employeeId, r.name)}
            className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50">
            <Pencil className="w-3 h-3" /> {r.status === "PAID" ? "View" : "Edit"}
          </button>
        )}
      </div>
    </div>
  );
}

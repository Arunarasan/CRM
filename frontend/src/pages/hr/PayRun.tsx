import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BadgeIndianRupee, Check, CheckCircle2, Clock, FileText, Inbox, MoreHorizontal, Pencil, PlayCircle, Settings2, X,
} from "lucide-react";
import { payrollApi } from "@/api/payrollApi";
import type { PayrollLine, PayrollPreviewRow, PendingMoneyRequest } from "@/types/payroll";
import { inr } from "@/pages/workforce/WorkforceFinanceTab";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { FilterChips, MONTHS, PersonChip, SearchField, StatusPill } from "@/pages/workforce/hrUi";

type Basis = "HOURLY" | "MONTHLY";
type RunStatus = "NONE" | "PENDING" | "APPROVED" | "PAID";
type Filter = "ALL" | "NONE" | "PENDING" | "APPROVED" | "PAID" | "REQUESTS";

/** One employee's month: the hours preview joined with their payslip (if one has been made). */
interface RunRow {
  id: number;
  name: string;
  code?: string;
  designation?: string;
  preview?: PayrollPreviewRow;
  status: RunStatus;
  recordId?: number;
  net?: number;
  gross?: number | null;
  deductions?: number | null;
  payType?: string;
  requests: PendingMoneyRequest[];
  owed: number;
}

const n = (v: any) => Number(v || 0);
const hrs = (v: any) => n(v).toFixed(1).replace(/\.0$/, "");
const MON = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SLIP_LABELS = { NONE: "Not made", PENDING: "To approve", APPROVED: "To pay", PAID: "Paid" };
const REQ_TITLE: Record<string, string> = {
  ADVANCE: "Borrow", REPAY: "Repay", LOAN_REPAYMENT: "Loan repayment", ADVANCE_REPAYMENT: "Advance repayment",
  SET_RECOVERY: "Repay plan", OTHER: "Other",
};
const errMsg = (e: any, fallback: string) => e?.response?.data?.message || fallback;

/** What generating would pay on the chosen basis (base pay only — bonuses etc. are added on top). */
const estimate = (p: PayrollPreviewRow | undefined, b?: Basis) =>
  !p || !b ? null : b === "HOURLY" ? p.hourly.total ?? null : p.monthly.total ?? null;

/**
 * The month's pay run as one list: every payroll employee with their hours, pay basis and payslip,
 * and one button for their next step (Generate → Approve → Pay). A step bar on top shows where the
 * month stands and offers the next bulk action; ticking rows enables bulk actions for the selection.
 */
export default function PayRun({
  month, year, canProcess, refreshKey, onChanged, onOpenSlip, onEditWage,
}: {
  month: number;
  year: number;
  canProcess: boolean;
  /** Bumped by the page when something outside (editor, quick pay) changed payroll. */
  refreshKey: number;
  onChanged: () => void;
  onOpenSlip: (employeeId: number, name?: string) => void;
  onEditWage?: (employeeId: number) => void;
}) {
  const [preview, setPreview] = useState<PayrollPreviewRow[]>([]);
  const [lines, setLines] = useState<PayrollLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [choice, setChoice] = useState<Record<number, Basis>>({});
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [filter, setFilter] = useState<Filter>("ALL");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<{ title: string; body: string; cta: string; run: () => Promise<void> } | null>(null);
  const [reqFor, setReqFor] = useState<RunRow | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      payrollApi.payrollPreview(month, year).catch(() => [] as PayrollPreviewRow[]),
      payrollApi.unifiedRegister(month, year).catch(() => [] as PayrollLine[]),
    ]).then(([p, l]) => {
      setPreview(p);
      setLines(l.filter((x) => x.resourceType === "EMPLOYEE"));
      setChoice((c) => {
        const next = { ...c };
        p.forEach((r) => { if (!next[r.employeeId] && r.defaultBasis) next[r.employeeId] = r.defaultBasis; });
        return next;
      });
    }).finally(() => setLoading(false));
  };
  useEffect(() => { setSelected({}); load(); }, [month, year, refreshKey]);

  const refresh = () => { load(); onChanged(); };

  const rows: RunRow[] = useMemo(() => {
    const byId = new Map<number, RunRow>();
    preview.forEach((p) => byId.set(p.employeeId, {
      id: p.employeeId, name: p.name || "Employee", code: p.employeeCode, designation: p.designation, preview: p,
      status: (p.recordId ? (p.status as RunStatus) : "NONE") || "NONE", recordId: p.recordId, net: p.netSalary,
      payType: p.payType, requests: p.pendingRequests ?? [], owed: n(p.owed),
    }));
    lines.forEach((l) => {
      if (!l.personId) return;
      const r = byId.get(l.personId) ?? {
        id: l.personId, name: l.name || "Employee", code: l.code, status: "NONE" as RunStatus, requests: [], owed: 0,
      };
      r.status = (l.status as RunStatus) || r.status;
      r.recordId = l.recordId ?? r.recordId;
      r.net = l.payable;
      r.gross = l.gross;
      r.deductions = l.deductions;
      r.payType = l.payModel;
      byId.set(l.personId, r);
    });
    const order: Record<RunStatus, number> = { NONE: 0, PENDING: 1, APPROVED: 2, PAID: 3 };
    return [...byId.values()].sort((a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name));
  }, [preview, lines]);

  const counts = useMemo(() => {
    const c = { ALL: rows.length, NONE: 0, PENDING: 0, APPROVED: 0, PAID: 0, REQUESTS: 0 };
    rows.forEach((r) => { c[r.status]++; if (r.requests.length) c.REQUESTS++; });
    return c;
  }, [rows]);
  const waitingRequests = rows.reduce((a, r) => a + r.requests.length, 0);
  const toPayTotal = rows.filter((r) => r.status === "APPROVED").reduce((a, r) => a + n(r.net), 0);
  const paidTotal = rows.filter((r) => r.status === "PAID").reduce((a, r) => a + n(r.net), 0);
  const madeTotal = rows.filter((r) => r.status !== "NONE").reduce((a, r) => a + n(r.net), 0);
  // Ready to generate = not made yet, has a usable basis, and actually logged hours.
  const readyToMake = rows.filter((r) => r.status === "NONE" && choice[r.id] && n(r.preview?.workedHours) > 0);

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "REQUESTS" ? r.requests.length === 0 : filter !== "ALL" && r.status !== filter) return false;
      return !s || r.name.toLowerCase().includes(s) || (r.code || "").toLowerCase().includes(s);
    });
  }, [rows, filter, q]);

  const picked = rows.filter((r) => selected[r.id]);
  const pickedNone = picked.filter((r) => r.status === "NONE" && choice[r.id]);
  const pickedPending = picked.filter((r) => r.status === "PENDING");
  const pickedApproved = picked.filter((r) => r.status === "APPROVED");
  const allVisiblePicked = visible.length > 0 && visible.every((r) => selected[r.id]);
  const toggleAll = () => setSelected((s) => {
    const o = { ...s };
    visible.forEach((r) => { o[r.id] = !allVisiblePicked; });
    return o;
  });

  // ---------- actions ----------
  const generate = async (list: RunRow[]) => {
    const choices: Record<number, Basis> = {};
    list.forEach((r) => { if (choice[r.id]) choices[r.id] = choice[r.id]; });
    const res = await payrollApi.generatePayslips(month, year, choices);
    if (res.errors?.length) toast.error(`${res.errors.length} couldn't be made: ${res.errors[0]}`);
    if (res.generated) toast.success(`${res.generated} payslip${res.generated === 1 ? "" : "s"} made. Check them, then approve.`);
  };
  const approveAll = async (list: RunRow[]) => {
    let ok = 0;
    for (const r of list) { try { await payrollApi.approvePayroll(r.recordId!); ok++; } catch (e) { toast.error(`${r.name}: ${errMsg(e, "couldn't approve")}`); } }
    if (ok) toast.success(`${ok} payslip${ok === 1 ? "" : "s"} approved — employees can see them now.`);
  };
  const payAll = async (list: RunRow[]) => {
    let ok = 0;
    for (const r of list) { try { await payrollApi.markPaid(r.recordId!); ok++; } catch (e) { toast.error(`${r.name}: ${errMsg(e, "couldn't mark paid")}`); } }
    if (ok) toast.success(`${ok} marked paid.`);
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); setSelected({}); refresh(); }
    finally { setBusy(false); setConfirm(null); }
  };

  const askGenerate = (list: RunRow[]) => setConfirm({
    title: `Make ${list.length} payslip${list.length === 1 ? "" : "s"}?`,
    body: "Payslips are built from attendance hours on each person's chosen basis, plus approved bonuses, deductions, repayments and lead / review pay. You can check and edit each one before approving.",
    cta: `Make ${list.length}`, run: () => generate(list),
  });
  const askApprove = (list: RunRow[]) => setConfirm({
    title: `Approve ${list.length} payslip${list.length === 1 ? "" : "s"}?`,
    body: "Approved payslips show in each employee's app straight away. You can still edit them until they're paid.",
    cta: `Approve ${list.length}`, run: () => approveAll(list),
  });
  const askPay = (list: RunRow[]) => setConfirm({
    title: `Mark ${list.length} as paid · ${inr(list.reduce((a, r) => a + n(r.net), 0))}?`,
    body: "Do this after the money has gone out. Paid payslips are locked and each employee is notified.",
    cta: `Mark ${list.length} paid`, run: () => payAll(list),
  });

  const generateOne = (r: RunRow) => {
    const b = choice[r.id];
    if (!b) { onEditWage?.(r.id); return; }
    setBusy(true);
    payrollApi.generatePayslip(r.id, month, year, b)
      .then(() => { toast.success("Payslip made — check it, then approve."); refresh(); onOpenSlip(r.id, r.name); })
      .catch((e) => toast.error(errMsg(e, "Couldn't make the payslip")))
      .finally(() => setBusy(false));
  };
  const approveOne = (r: RunRow) => run(() => approveAll([r]));

  // ---------- step bar ----------
  const steps = [
    { key: "REQUESTS" as Filter, label: "Requests", done: waitingRequests === 0,
      detail: waitingRequests ? `${waitingRequests} waiting` : "None waiting" },
    { key: "NONE" as Filter, label: "Make payslips", done: rows.length > 0 && counts.NONE === 0,
      detail: rows.length ? `${rows.length - counts.NONE} of ${rows.length} made` : "No employees" },
    { key: "PENDING" as Filter, label: "Approve", done: counts.NONE < rows.length && counts.PENDING === 0,
      detail: counts.PENDING ? `${counts.PENDING} to approve` : counts.NONE === rows.length ? "—" : "All approved" },
    { key: "APPROVED" as Filter, label: "Pay", done: rows.length > 0 && counts.PAID === rows.length,
      detail: counts.APPROVED ? `${counts.APPROVED} · ${inr(toPayTotal)}` : counts.PAID ? `${counts.PAID} paid` : "—" },
  ];
  const current = steps.find((s) => !s.done)?.key;
  const nextAction = (() => {
    if (!canProcess) return null;
    if (current === "REQUESTS") return <Button onClick={() => setFilter("REQUESTS")}><Inbox className="mr-1.5 h-4 w-4" /> Review {waitingRequests} request{waitingRequests === 1 ? "" : "s"}</Button>;
    if (current === "NONE" && readyToMake.length) return <Button onClick={() => askGenerate(readyToMake)} disabled={busy}><PlayCircle className="mr-1.5 h-4 w-4" /> Make {readyToMake.length} payslip{readyToMake.length === 1 ? "" : "s"}</Button>;
    if (current === "PENDING" || (current === "NONE" && counts.PENDING)) {
      const list = rows.filter((r) => r.status === "PENDING");
      if (list.length) return <Button onClick={() => askApprove(list)} disabled={busy}><Check className="mr-1.5 h-4 w-4" /> Approve {list.length}</Button>;
    }
    const list = rows.filter((r) => r.status === "APPROVED");
    if (list.length) return <Button variant="forest" onClick={() => askPay(list)} disabled={busy}><BadgeIndianRupee className="mr-1.5 h-4 w-4" /> Pay {list.length} · {inr(toPayTotal)}</Button>;
    return null;
  })();

  return (
    <div className="space-y-4">
      {/* Where the month stands — each step filters the list; the next bulk action sits on the right */}
      <section className="rounded-xl border bg-card p-3 shadow-sm md:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <ol className="grid flex-1 grid-cols-2 gap-2 md:grid-cols-4">
            {steps.map((s, i) => {
              const isCurrent = s.key === current;
              return (
                <li key={s.key}>
                  <button type="button" onClick={() => setFilter(s.key)}
                    className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors ${
                      filter === s.key ? "border-primary/60 bg-primary/5" : isCurrent ? "border-amber-300 bg-amber-50/60" : "border-transparent bg-slate-50 hover:border-slate-200"}`}>
                    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                      s.done ? "bg-emerald-600 text-white" : isCurrent ? "bg-amber-500 text-white" : "bg-slate-200 text-slate-600"}`}>
                      {s.done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-900">{s.label}</span>
                      <span className="block truncate text-xs text-slate-500">{s.detail}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          {nextAction && <div className="flex shrink-0 lg:pl-2">{nextAction}</div>}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t pt-3 text-xs text-slate-500">
          <span>Payslips made <b className="tabular-nums text-slate-800">{inr(madeTotal)}</b></span>
          <span>Still to pay <b className="tabular-nums text-amber-700">{inr(toPayTotal)}</b></span>
          <span>Paid <b className="tabular-nums text-emerald-700">{inr(paidTotal)}</b></span>
        </div>
      </section>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <FilterChips<Filter>
          value={filter} onChange={setFilter}
          options={[
            { key: "ALL", label: "All", count: counts.ALL },
            { key: "NONE", label: "Not made", count: counts.NONE },
            { key: "PENDING", label: "To approve", count: counts.PENDING },
            { key: "APPROVED", label: "To pay", count: counts.APPROVED },
            { key: "PAID", label: "Paid", count: counts.PAID },
            ...(counts.REQUESTS ? [{ key: "REQUESTS" as Filter, label: "Has requests", count: counts.REQUESTS }] : []),
          ]}
        />
        <SearchField value={q} onChange={setQ} placeholder="Search employee or code…" className="md:w-64" />
      </div>

      {/* ---------- list: table on md+, cards on phones ---------- */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        {loading ? (
          <div className="space-y-3 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : visible.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="font-medium text-slate-900">{rows.length ? "No one matches" : "No payroll employees"}</p>
            <p className="mt-1 text-sm text-slate-500">
              {rows.length ? "Change the filter or search." : "Turn on payroll for an employee in their profile to include them here."}
            </p>
            {rows.length > 0 && (filter !== "ALL" || q) && (
              <Button size="sm" variant="outline" className="mt-3" onClick={() => { setFilter("ALL"); setQ(""); }}>Show everyone</Button>
            )}
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50/70 text-xs text-slate-500">
                <tr>
                  {canProcess && (
                    <th className="w-10 px-3 py-2.5">
                      <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={allVisiblePicked} onChange={toggleAll} aria-label="Select all shown" />
                    </th>
                  )}
                  <th className="px-3 py-2.5 text-left font-medium">Employee</th>
                  <th className="px-3 py-2.5 text-left font-medium">Hours</th>
                  <th className="hidden px-3 py-2.5 text-left font-medium 2xl:table-cell">Pay basis</th>
                  <th className="px-3 py-2.5 text-right font-medium">Net pay</th>
                  <th className="px-3 py-2.5 text-left font-medium">Status</th>
                  <th className="px-3 py-2.5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {visible.map((r) => (
                  <tr key={r.id} className={selected[r.id] ? "bg-primary/5" : "hover:bg-slate-50/60"}>
                    {canProcess && (
                      <td className="px-3 py-3 align-top">
                        <input type="checkbox" className="mt-2 h-4 w-4 accent-[hsl(var(--primary))]" checked={!!selected[r.id]}
                          onChange={(e) => setSelected((s) => ({ ...s, [r.id]: e.target.checked }))} aria-label={`Select ${r.name}`} />
                      </td>
                    )}
                    <td className="max-w-[260px] px-3 py-3 align-top"><Who r={r} onRequests={() => setReqFor(r)} /></td>
                    <td className="px-3 py-3 align-top">
                      <HoursCell p={r.preview} />
                      {/* Below 2xl the basis choice sits under the hours instead of its own column */}
                      {r.status === "NONE" && (
                        <div className="mt-2 2xl:hidden">
                          <BasisCell r={r} chosen={choice[r.id]} canProcess={canProcess}
                            onPick={(b) => setChoice((c) => ({ ...c, [r.id]: b }))} onEditWage={onEditWage} />
                        </div>
                      )}
                    </td>
                    <td className="hidden px-3 py-3 align-top 2xl:table-cell">
                      <BasisCell r={r} chosen={choice[r.id]} canProcess={canProcess}
                        onPick={(b) => setChoice((c) => ({ ...c, [r.id]: b }))} onEditWage={onEditWage} />
                    </td>
                    <td className="px-3 py-3 text-right align-top"><NetCell r={r} est={estimate(r.preview, choice[r.id])} /></td>
                    <td className="px-3 py-3 align-top"><div className="pt-1.5"><StatusPill status={r.status} labels={SLIP_LABELS} /></div></td>
                    <td className="px-3 py-3 text-right align-top">
                      <RowActions r={r} canProcess={canProcess} busy={busy} month={month} year={year}
                        onGenerate={() => generateOne(r)} onApprove={() => approveOne(r)} onPay={() => askPay([r])}
                        onOpen={() => onOpenSlip(r.id, r.name)} onEditWage={onEditWage} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            <ul className="divide-y lg:hidden">
              {visible.map((r) => (
                <li key={r.id} className={`space-y-3 p-4 ${selected[r.id] ? "bg-primary/5" : ""}`}>
                  <div className="flex items-start gap-3">
                    {canProcess && (
                      <input type="checkbox" className="mt-2.5 h-5 w-5 shrink-0 accent-[hsl(var(--primary))]" checked={!!selected[r.id]}
                        onChange={(e) => setSelected((s) => ({ ...s, [r.id]: e.target.checked }))} aria-label={`Select ${r.name}`} />
                    )}
                    <div className="min-w-0 flex-1"><Who r={r} onRequests={() => setReqFor(r)} /></div>
                    <StatusPill status={r.status} labels={SLIP_LABELS} />
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <HoursCell p={r.preview} />
                    <NetCell r={r} est={estimate(r.preview, choice[r.id])} />
                  </div>
                  {r.status === "NONE" && (
                    <BasisCell r={r} chosen={choice[r.id]} canProcess={canProcess}
                      onPick={(b) => setChoice((c) => ({ ...c, [r.id]: b }))} onEditWage={onEditWage} />
                  )}
                  <div className="flex justify-end">
                    <RowActions r={r} canProcess={canProcess} busy={busy} month={month} year={year}
                      onGenerate={() => generateOne(r)} onApprove={() => approveOne(r)} onPay={() => askPay([r])}
                      onOpen={() => onOpenSlip(r.id, r.name)} onEditWage={onEditWage} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      {!loading && visible.length > 0 && (
        <p className="text-xs text-slate-500">Showing {visible.length} of {rows.length} · {MONTHS[month - 1]} {year}</p>
      )}

      {/* ---------- bulk bar for ticked rows ---------- */}
      {canProcess && picked.length > 0 && (
        <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-2 rounded-xl border bg-card/95 p-3 shadow-lg backdrop-blur">
          <span className="mr-auto text-sm text-slate-700"><b>{picked.length}</b> selected</span>
          {pickedNone.length > 0 && <Button size="sm" onClick={() => askGenerate(pickedNone)} disabled={busy}><PlayCircle className="mr-1 h-4 w-4" /> Make {pickedNone.length}</Button>}
          {pickedPending.length > 0 && <Button size="sm" variant="outline" onClick={() => askApprove(pickedPending)} disabled={busy}><Check className="mr-1 h-4 w-4" /> Approve {pickedPending.length}</Button>}
          {pickedApproved.length > 0 && <Button size="sm" variant="forest" onClick={() => askPay(pickedApproved)} disabled={busy}><BadgeIndianRupee className="mr-1 h-4 w-4" /> Pay {pickedApproved.length}</Button>}
          <Button size="sm" variant="ghost" onClick={() => setSelected({})}><X className="mr-1 h-4 w-4" /> Clear</Button>
        </div>
      )}

      {/* ---------- confirm bulk action ---------- */}
      <Dialog open={!!confirm} onOpenChange={(o) => { if (!o && !busy) setConfirm(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{confirm?.title}</DialogTitle>
            <DialogDescription>{confirm?.body}</DialogDescription>
          </DialogHeader>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirm(null)} disabled={busy}>Cancel</Button>
            <Button onClick={() => confirm && run(confirm.run)} disabled={busy}>{busy ? "Working…" : confirm?.cta}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {reqFor && (
        <RequestsDialog row={reqFor} canProcess={canProcess} onClose={() => setReqFor(null)}
          onDone={() => { setReqFor(null); refresh(); }} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- cells

function Who({ r, onRequests }: { r: RunRow; onRequests: () => void }) {
  return (
    <div className="min-w-0 space-y-1">
      <PersonChip name={r.name} sub={[r.code, r.designation].filter(Boolean).join(" · ")} to={`/hr/employees/${r.id}`} />
      {(r.requests.length > 0 || r.owed > 0) && (
        <div className="flex flex-wrap items-center gap-1.5 pl-[46px] text-[11px]">
          {r.requests.length > 0 && (
            <button type="button" onClick={onRequests}
              className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-900 hover:bg-amber-200">
              <Inbox className="h-3 w-3" /> {r.requests.length} request{r.requests.length === 1 ? "" : "s"} waiting
            </button>
          )}
          {r.owed > 0 && <span className="text-slate-500">Owes <b className="text-rose-700">{inr(r.owed)}</b></span>}
        </div>
      )}
    </div>
  );
}

function HoursCell({ p }: { p?: PayrollPreviewRow }) {
  if (!p) return <span className="text-slate-400">—</span>;
  const pending = n(p.pendingSessions);
  return (
    <div className="min-w-[110px]">
      <div className="font-medium tabular-nums text-slate-900">{hrs(p.workedHours)} h</div>
      <div className="text-xs text-slate-500">
        {p.attendanceDays} day{p.attendanceDays === 1 ? "" : "s"}{n(p.overtimeHours) > 0 ? ` · ${hrs(p.overtimeHours)} h OT` : ""}
      </div>
      {pending > 0 && (
        <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-amber-700"><Clock className="h-3 w-3" /> {pending} punch{pending === 1 ? "" : "es"} to approve</div>
      )}
    </div>
  );
}

function BasisCell({ r, chosen, canProcess, onPick, onEditWage }: {
  r: RunRow; chosen?: Basis; canProcess: boolean; onPick: (b: Basis) => void; onEditWage?: (id: number) => void;
}) {
  if (r.status !== "NONE") {
    return <span className="text-xs text-slate-600">{r.payType === "HOURLY" ? "Hourly" : "Monthly"}</span>;
  }
  const p = r.preview;
  if (!p) return <span className="text-slate-400">—</span>;
  if (!p.hourly.available && !p.monthly.available) {
    return canProcess && onEditWage
      ? <button type="button" onClick={() => onEditWage(r.id)} className="text-xs font-semibold text-primary hover:underline">Set salary or rate</button>
      : <span className="text-xs text-slate-400">No salary set</span>;
  }
  const opts: { b: Basis; label: string; amount?: number | null; ok: boolean }[] = [
    { b: "MONTHLY", label: "Monthly", amount: p.monthly.total, ok: p.monthly.available },
    { b: "HOURLY", label: "Hourly", amount: p.hourly.total, ok: p.hourly.available },
  ];
  return (
    <div className="inline-flex flex-wrap rounded-lg border bg-slate-50 p-0.5" role="radiogroup" aria-label={`Pay basis for ${r.name}`}>
      {opts.filter((o) => o.ok).map((o) => {
        const on = chosen === o.b;
        return (
          <button key={o.b} type="button" role="radio" aria-checked={on} disabled={!canProcess} onClick={() => onPick(o.b)}
            className={`rounded-md px-2.5 py-1 text-left text-xs transition-colors ${on ? "bg-card font-semibold text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
            {o.label} <span className="tabular-nums">{inr(o.amount)}</span>
          </button>
        );
      })}
    </div>
  );
}

function NetCell({ r, est }: { r: RunRow; est: number | null }) {
  if (r.status === "NONE") {
    return est == null
      ? <span className="text-slate-400">—</span>
      : <div className="text-right"><div className="tabular-nums text-slate-500">≈ {inr(est)}</div><div className="text-[11px] text-slate-400">before extras</div></div>;
  }
  return (
    <div className="text-right">
      <div className="font-semibold tabular-nums text-slate-900">{inr(r.net)}</div>
      {r.gross != null && (
        <div className="whitespace-nowrap text-[11px] text-slate-500 tabular-nums">
          {inr(r.gross)}{n(r.deductions) > 0 && <span className="text-rose-700"> − {inr(r.deductions)}</span>}
        </div>
      )}
    </div>
  );
}

function RowActions({ r, canProcess, busy, onGenerate, onApprove, onPay, onOpen, onEditWage }: {
  r: RunRow; canProcess: boolean; busy: boolean; month: number; year: number;
  onGenerate: () => void; onApprove: () => void; onPay: () => void; onOpen: () => void; onEditWage?: (id: number) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1.5">
      {canProcess && r.status === "NONE" && (
        <Button size="sm" variant="outline" onClick={onGenerate} disabled={busy}><PlayCircle className="mr-1 h-3.5 w-3.5" /> Make</Button>
      )}
      {canProcess && r.status === "PENDING" && (
        <Button size="sm" variant="outline" onClick={onApprove} disabled={busy}><Check className="mr-1 h-3.5 w-3.5" /> Approve</Button>
      )}
      {canProcess && r.status === "APPROVED" && (
        <Button size="sm" variant="forest" onClick={onPay} disabled={busy}><BadgeIndianRupee className="mr-1 h-3.5 w-3.5" /> Pay</Button>
      )}
      {r.status !== "NONE" && (
        <Button size="sm" variant="ghost" onClick={onOpen} aria-label={`${r.status === "PAID" || !canProcess ? "View" : "Edit"} payslip for ${r.name}`}>
          {r.status === "PAID" || !canProcess ? <><FileText className="mr-1 h-3.5 w-3.5" /> View</> : <><Pencil className="mr-1 h-3.5 w-3.5" /> Edit</>}
        </Button>
      )}
      {(r.recordId || (canProcess && onEditWage)) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="h-9 w-9 p-0" aria-label={`More for ${r.name}`}><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {r.recordId && (
              <DropdownMenuItem asChild>
                <Link to={`/hr/payslip/${r.recordId}`} target="_blank" rel="noreferrer"><FileText className="mr-2 h-4 w-4" /> Print payslip</Link>
              </DropdownMenuItem>
            )}
            {canProcess && onEditWage && (
              <DropdownMenuItem onClick={() => onEditWage(r.id)}><Settings2 className="mr-2 h-4 w-4" /> Wage &amp; pay basis</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

/** One employee's waiting money requests — approve or reject without leaving the pay run. */
function RequestsDialog({ row, canProcess, onClose, onDone }: {
  row: RunRow; canProcess: boolean; onClose: () => void; onDone: () => void;
}) {
  const [busy, setBusy] = useState<number | null>(null);
  const [left, setLeft] = useState(row.requests);
  const act = (q: PendingMoneyRequest, approve: boolean) => {
    setBusy(q.id);
    (approve ? payrollApi.approvePayrollRequest(q.id) : payrollApi.rejectPayrollRequest(q.id))
      .then(() => {
        toast.success(approve ? "Approved — it goes on that month's payslip." : "Request rejected.");
        const rest = left.filter((x) => x.id !== q.id);
        setLeft(rest);
        if (rest.length === 0) onDone();
      })
      .catch((e) => toast.error(errMsg(e, "Couldn't update the request")))
      .finally(() => setBusy(null));
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) { left.length < row.requests.length ? onDone() : onClose(); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Money requests · {row.name}</DialogTitle>
          <DialogDescription>
            {row.owed > 0 ? <>Owes <b className="text-rose-700">{inr(row.owed)}</b> right now. </> : null}
            Approved repayments come off that month's payslip automatically.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2">
          {left.map((q) => (
            <li key={q.id} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-slate-900">{REQ_TITLE[q.requestType] || q.requestType} · <span className="tabular-nums">{inr(q.amount)}</span></div>
                  <div className="text-xs text-slate-500">
                    {q.targetMonth ? `From ${MON[q.targetMonth]} ${q.targetYear} salary` : q.requestType === "ADVANCE" ? (n(q.monthlyRecovery) > 0 ? `Pays back ${inr(q.monthlyRecovery)}/month` : "Pays back from next salary") : ""}
                  </div>
                  {q.reason && <p className="mt-1 text-sm text-slate-700">{q.reason}</p>}
                </div>
                {canProcess && (
                  <div className="flex shrink-0 flex-col gap-1.5">
                    <Button size="sm" variant="forest" disabled={busy === q.id} onClick={() => act(q, true)}><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Approve</Button>
                    <Button size="sm" variant="ghost" disabled={busy === q.id} onClick={() => act(q, false)}>Reject</Button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

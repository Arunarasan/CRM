import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { workforceApi } from "@/api/workforceApi";
import { payrollApi } from "@/api/payrollApi";
import { contractorApi } from "@/api/contractorApi";
import type { WorkforceFinance, PayrollRequest, PayrollPreviewRow } from "@/types/payroll";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExternalLink, Plus } from "lucide-react";

export const inr = (v: number | undefined | null) =>
  v == null ? "₹0" : "₹" + Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 });

export default function WorkforceFinanceTab({ workforceId }: { workforceId: number }) {
  const [fin, setFin] = useState<WorkforceFinance | null>(null);
  const [projectWise, setProjectWise] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    workforceApi.finance(workforceId)
      .then((f: any) => {
        setFin(f);
        if (f?.contractorId) contractorApi.getProjectPayments(f.contractorId).then(setProjectWise).catch(() => {});
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [workforceId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="p-6 text-muted-foreground">Loading financials…</div>;
  if (!fin) return <div className="p-6 text-muted-foreground">No financial data.</div>;

  return fin.workforceType === "EMPLOYEE"
    ? <EmployeeFinance fin={fin} reload={load} />
    : <ContractorFinance fin={fin} projectWise={projectWise} />;
}

/* ----------------------------------------------------------------- Employee */
function EmployeeFinance({ fin, reload }: { fin: WorkforceFinance; reload: () => void }) {
  const empId = fin.employeeId!;
  const [advOpen, setAdvOpen] = useState(false);
  const [loanOpen, setLoanOpen] = useState(false);
  const [runOpen, setRunOpen] = useState(false);
  const [reqs, setReqs] = useState<PayrollRequest[]>([]);

  const loadReqs = useCallback(() => {
    payrollApi.payrollRequestsForEmployee(empId).then(setReqs).catch(() => setReqs([]));
  }, [empId]);
  useEffect(() => { loadReqs(); }, [loadReqs]);
  // Reload both the finance snapshot (advances/loans/payslips) and the request list after an action.
  const reloadAll = () => { reload(); loadReqs(); };

  // Route each request to the card it belongs with; SET_RECOVERY follows its target (loan vs advance).
  const advanceReqs = reqs.filter((r) =>
    r.requestType === "ADVANCE" || r.requestType === "REPAY" || r.requestType === "ADVANCE_REPAYMENT"
    || (r.requestType === "SET_RECOVERY" && r.advanceId != null));
  const loanReqs = reqs.filter((r) =>
    r.requestType === "LOAN_REPAYMENT" || (r.requestType === "SET_RECOVERY" && r.loanId != null));
  const otherReqs = reqs.filter((r) => r.requestType === "OTHER");

  return (
    <div className="space-y-5">
      <Card title="Payslips" action={<Button size="sm" onClick={() => setRunOpen(true)}><Plus className="w-4 h-4 mr-1" />Generate</Button>}>
        <table className="w-full text-sm">
          <thead className="text-slate-500 text-left"><tr>
            <th className="p-2">Period</th><th className="p-2">Payslip #</th><th className="p-2 text-right">Gross</th>
            <th className="p-2 text-right">Deductions</th><th className="p-2 text-right">Net</th><th className="p-2">Status</th><th className="p-2" />
          </tr></thead>
          <tbody className="divide-y">
            {(fin.payslips ?? []).map((p) => (
              <tr key={p.id}>
                <td className="p-2">{p.month}/{p.year}</td>
                <td className="p-2 font-mono text-xs">{p.payslipNumber}</td>
                <td className="p-2 text-right">{inr(p.grossEarnings)}</td>
                <td className="p-2 text-right">{inr(p.totalDeductions)}</td>
                <td className="p-2 text-right font-semibold">{inr(p.netSalary)}</td>
                <td className="p-2"><Badge className={p.status === "PAID" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>{p.status}</Badge></td>
                <td className="p-2 text-right whitespace-nowrap">
                  <Link to={`/hr/payslip/${p.id}`} className="text-primary text-xs mr-2">View</Link>
                  {p.status !== "PAID" && (
                    <button className="text-xs text-emerald-600" onClick={() => payrollApi.markPaid(p.id).then(reload)}>Mark paid</button>
                  )}
                </td>
              </tr>
            ))}
            {(fin.payslips ?? []).length === 0 && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">No payslips yet.</td></tr>}
          </tbody>
        </table>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Advances" action={<Button size="sm" variant="outline" onClick={() => setAdvOpen(true)}><Plus className="w-4 h-4 mr-1" />Add</Button>}>
          <RequestBlock title="Requested by employee" reqs={advanceReqs} reload={reloadAll} />
          <MiniList rows={(fin.advances ?? []).map((a) => ({
            id: a.id!, main: inr(a.amount), sub: a.reason || "—",
            right: `Bal ${inr(a.balance)}`, status: a.status,
            action: a.status === "PENDING" ? { label: "Approve", fn: () => payrollApi.approveAdvance(a.id!).then(reload) } : undefined,
          }))} empty="No advances." />
        </Card>
        <Card title="Loans" action={<Button size="sm" variant="outline" onClick={() => setLoanOpen(true)}><Plus className="w-4 h-4 mr-1" />Add</Button>}>
          <RequestBlock title="Repayment requests" reqs={loanReqs} reload={reloadAll} />
          <MiniList rows={(fin.loans ?? []).map((l) => ({
            id: l.id!, main: inr(l.principal), sub: `EMI ${inr(l.emiAmount)}`,
            right: `Bal ${inr(l.balance)}`, status: l.status,
            action: l.status === "ACTIVE" ? { label: "Close", fn: () => payrollApi.closeLoan(l.id!).then(reload) } : undefined,
          }))} empty="No loans." />
        </Card>
      </div>

      {otherReqs.length > 0 && (
        <Card title="Other requests">
          <RequestBlock reqs={otherReqs} reload={reloadAll} />
        </Card>
      )}

      {advOpen && <AdvanceDialog employeeId={empId} onClose={() => setAdvOpen(false)} onSaved={() => { setAdvOpen(false); reload(); }} />}
      {loanOpen && <LoanDialog employeeId={empId} onClose={() => setLoanOpen(false)} onSaved={() => { setLoanOpen(false); reload(); }} />}
      {runOpen && <RunPayrollDialog employeeId={empId} onClose={() => setRunOpen(false)} onSaved={() => { setRunOpen(false); reload(); }} />}
    </div>
  );
}

/* --------------------------------------------------------------- Contractor */
function ContractorFinance({ fin, projectWise }: { fin: WorkforceFinance; projectWise: any[] }) {
  const cid = fin.contractorId!;
  const sum = fin.summary || {};
  const cd = fin.contractDetails || {};
  const contractValue = projectWise.reduce((a, p) => a + (p.contractValue || 0), 0);
  const pending = (sum.billedOutstanding || 0);

  return (
    <div className="space-y-5">
      <Card title="Contract details" action={<Link to={`/contractors/directory/${cid}`} className="text-sm text-primary flex items-center gap-1">Contractor module <ExternalLink className="w-3.5 h-3.5" /></Link>}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <KV label="Agreement #" value={cd.agreementNumber || "—"} />
          <KV label="Start" value={cd.contractStartDate || "—"} />
          <KV label="End" value={cd.contractEndDate || "—"} />
          <KV label="Payment terms" value={cd.paymentTerms || "—"} />
          <KV label="GST" value={cd.gstNumber || "—"} />
          <KV label="PAN" value={cd.panNumber || "—"} />
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile label="Contract value" value={inr(contractValue)} />
        <Tile label="Total paid" value={inr(sum.totalPaid)} />
        <Tile label="Pending" value={inr(pending)} tone="amber" />
        <Tile label="Retention held" value={inr(sum.retentionHeld)} />
        <Tile label="Advance paid" value={inr(sum.advancesPaid)} />
        <Tile label="Ledger balance" value={inr(sum.ledgerBalance)} />
      </div>

      <Card title="Payment requests (bills)" action={<Link to="/contractors/bills/new" className="text-sm text-primary flex items-center gap-1">New <Plus className="w-3.5 h-3.5" /></Link>}>
        <table className="w-full text-sm">
          <thead className="text-slate-500 text-left"><tr>
            <th className="p-2">Bill #</th><th className="p-2">Type</th><th className="p-2 text-right">Net</th>
            <th className="p-2 text-right">Balance</th><th className="p-2">Status</th><th className="p-2" />
          </tr></thead>
          <tbody className="divide-y">
            {(fin.paymentRequests ?? []).map((b: any) => (
              <tr key={b.id}>
                <td className="p-2 font-mono text-xs">{b.billNumber}</td>
                <td className="p-2">{b.billType}</td>
                <td className="p-2 text-right">{inr(b.netAmount)}</td>
                <td className="p-2 text-right">{inr(b.balanceAmount)}</td>
                <td className="p-2"><Badge className="bg-slate-100 text-slate-700">{String(b.status).replace(/_/g, " ")}</Badge></td>
                <td className="p-2 text-right"><Link to={`/contractors/bills/${b.id}`} className="text-primary text-xs">Open</Link></td>
              </tr>
            ))}
            {(fin.paymentRequests ?? []).length === 0 && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No payment requests.</td></tr>}
          </tbody>
        </table>
      </Card>

      <Card title="Project-wise payments">
        <table className="w-full text-sm">
          <thead className="text-slate-500 text-left"><tr>
            <th className="p-2">Project</th><th className="p-2 text-right">Contract</th><th className="p-2 text-right">Paid</th>
            <th className="p-2 text-right">Pending</th><th className="p-2">Status</th>
          </tr></thead>
          <tbody className="divide-y">
            {projectWise.map((p) => (
              <tr key={p.projectId}>
                <td className="p-2 font-medium">{p.projectName}</td>
                <td className="p-2 text-right">{inr(p.contractValue)}</td>
                <td className="p-2 text-right">{inr(p.paid)}</td>
                <td className="p-2 text-right">{inr(p.pending)}</td>
                <td className="p-2"><Badge className="bg-slate-100 text-slate-700">{p.status}</Badge></td>
              </tr>
            ))}
            {projectWise.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No project work packages.</td></tr>}
          </tbody>
        </table>
      </Card>

      <Card title="Payment history" action={<Link to={`/contractors/ledger`} className="text-sm text-primary flex items-center gap-1">Ledger <ExternalLink className="w-3.5 h-3.5" /></Link>}>
        <table className="w-full text-sm">
          <thead className="text-slate-500 text-left"><tr>
            <th className="p-2">Date</th><th className="p-2">Reference</th><th className="p-2">Method</th>
            <th className="p-2 text-right">Amount</th><th className="p-2">Status</th>
          </tr></thead>
          <tbody className="divide-y">
            {(fin.paymentHistory ?? []).map((p: any) => (
              <tr key={p.id}>
                <td className="p-2">{p.paymentDate || "—"}</td>
                <td className="p-2 font-mono text-xs">{p.referenceNumber || p.transactionReference || "—"}</td>
                <td className="p-2">{p.paymentMode || "—"}</td>
                <td className="p-2 text-right font-semibold">{inr(p.amount)}</td>
                <td className="p-2"><Badge className="bg-slate-100 text-slate-700">{p.status}</Badge></td>
              </tr>
            ))}
            {(fin.paymentHistory ?? []).length === 0 && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No payments recorded.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------- dialogs */
function AdvanceDialog({ employeeId, onClose, onSaved }: { employeeId: number; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ amount: 0, monthlyRecovery: 0, reason: "" });
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add advance</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Num label="Amount" v={f.amount} on={(v) => setF({ ...f, amount: v })} />
          <Num label="Monthly recovery" v={f.monthlyRecovery} on={(v) => setF({ ...f, monthlyRecovery: v })} />
          <div className="col-span-2"><Label className="text-xs text-slate-500">Reason</Label><Input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => payrollApi.createAdvance(employeeId, f as any).then(onSaved)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LoanDialog({ employeeId, onClose, onSaved }: { employeeId: number; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ principal: 0, emiAmount: 0, tenureMonths: 0 });
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add loan</DialogTitle></DialogHeader>
        <div className="grid grid-cols-3 gap-3">
          <Num label="Principal" v={f.principal} on={(v) => setF({ ...f, principal: v })} />
          <Num label="EMI" v={f.emiAmount} on={(v) => setF({ ...f, emiAmount: v })} />
          <Num label="Tenure (mo)" v={f.tenureMonths} on={(v) => setF({ ...f, tenureMonths: v })} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => payrollApi.createLoan(employeeId, f as any).then(onSaved)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Generate one month's payslip from attendance hours — the employee's hours priced Hourly vs Monthly. */
function RunPayrollDialog({ employeeId, onClose, onSaved }: { employeeId: number; onClose: () => void; onSaved: () => void }) {
  const now = new Date();
  const [f, setF] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
  const [row, setRow] = useState<PayrollPreviewRow | null>(null);
  const [basis, setBasis] = useState<"HOURLY" | "MONTHLY" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setRow(null);
    payrollApi.payrollPreview(f.month, f.year)
      .then((rows) => { const r = rows.find((x) => x.employeeId === employeeId) || null; setRow(r); setBasis(r?.defaultBasis ?? null); })
      .catch(() => setRow(null));
  }, [employeeId, f.month, f.year]);
  const run = () => {
    setErr(null);
    payrollApi.generatePayslip(employeeId, f.month, f.year, basis ?? undefined).then(onSaved)
      .catch((e) => setErr(e?.response?.data?.message || e?.message || "Failed"));
  };
  const opt = (b: "HOURLY" | "MONTHLY") => {
    const o = row ? (b === "HOURLY" ? row.hourly : row.monthly) : null;
    const on = basis === b;
    return (
      <button type="button" disabled={!o?.available} onClick={() => setBasis(b)}
        className={`rounded-lg border px-3 py-2 text-left disabled:opacity-40 ${on ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-white"}`}>
        <div className="text-[10px] font-bold uppercase text-slate-500">{b === "HOURLY" ? "Hourly" : "Monthly"}</div>
        <div className="text-base font-bold">{o?.available ? inr(o.total) : "—"}</div>
        <div className="text-[11px] text-slate-500">
          {!o?.available ? (b === "HOURLY" ? "No hourly rate" : "No monthly salary")
            : b === "HOURLY" ? `${inr(row!.hourly.rate)}/h` : `${inr(row!.monthly.salary)}/mo`}
        </div>
      </button>
    );
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Generate payslip</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Num label="Month" v={f.month} on={(v) => setF({ ...f, month: v })} />
          <Num label="Year" v={f.year} on={(v) => setF({ ...f, year: v })} />
        </div>
        {row ? (
          <div className="space-y-2">
            <p className="text-sm text-slate-600">
              <b>{row.workedHours} h</b> worked of {row.standardHours} std · {row.attendanceDays} days
              {Number(row.overtimeHours) > 0 ? ` · ${row.overtimeHours} h OT` : ""}
            </p>
            {row.recordId
              ? <p className="text-sm text-amber-700">A payslip already exists for this month.</p>
              : <div className="grid grid-cols-2 gap-2">{opt("HOURLY")}{opt("MONTHLY")}</div>}
            <p className="text-xs text-slate-400">Approved bonuses, deductions and advance/loan recovery are added on generate. Extra items can be added after with “Edit payslip”.</p>
          </div>
        ) : <p className="text-sm text-slate-400">Loading hours…</p>}
        {err && <p className="text-sm text-rose-600">{err}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={run} disabled={!basis || !!row?.recordId}>Generate</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------------------------------------- primitives */
function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white border rounded-2xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-3"><h3 className="font-bold text-slate-800">{title}</h3>{action}</div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}
function Tile({ label, value, tone }: { label: string; value: string; tone?: "amber" }) {
  return (
    <div className={`rounded-xl border p-4 ${tone === "amber" ? "bg-amber-50 border-amber-200" : ""}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-bold text-slate-900 mt-1">{value}</div>
    </div>
  );
}
function KV({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs text-slate-500">{label}</div><div className="font-medium text-slate-800">{value}</div></div>;
}
function Num({ label, v, on }: { label: string; v: number; on: (v: number) => void }) {
  return <div><Label className="text-xs text-slate-500">{label}</Label><Input type="number" value={v} onChange={(e) => on(Number(e.target.value))} /></div>;
}
const REQ_MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const REQ_TYPE_LABEL: Record<string, string> = {
  ADVANCE: "Borrow", REPAY: "Repay", LOAN_REPAYMENT: "Loan repayment", ADVANCE_REPAYMENT: "Advance repayment",
  SET_RECOVERY: "Recovery plan", OTHER: "Other",
};
const REQ_STATUS_TONE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700", APPROVED: "bg-emerald-100 text-emerald-700",
  APPLIED: "bg-slate-200 text-slate-700", CONVERTED: "bg-teal-100 text-teal-700",
  REJECTED: "bg-rose-100 text-rose-700",
};

// Employee-raised requests surfaced inside the Advances / Loans cards, approvable in place.
function RequestBlock({ title, reqs, reload }: { title?: string; reqs: PayrollRequest[]; reload: () => void }) {
  if (reqs.length === 0) return null;
  const approve = (id: number) =>
    payrollApi.approvePayrollRequest(id).then(() => { toast.success("Request approved."); reload(); })
      .catch((e: any) => toast.error(e?.response?.data?.message || "Failed to approve"));
  const reject = (id: number) => {
    const remarks = window.prompt("Reason for rejection (optional):") ?? undefined;
    payrollApi.rejectPayrollRequest(id, remarks).then(() => { toast.success("Request rejected."); reload(); })
      .catch((e: any) => toast.error(e?.response?.data?.message || "Failed to reject"));
  };
  return (
    <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50/50 p-2">
      {title && <div className="mb-1 px-1 text-[11px] font-bold uppercase tracking-wide text-amber-700">{title}</div>}
      <ul className="divide-y divide-amber-100">
        {reqs.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2 py-2 text-sm">
            <div className="min-w-0">
              <div className="font-semibold">
                {inr(r.amount)}
                <span className="ml-1 text-[11px] font-normal text-slate-400">{REQ_TYPE_LABEL[r.requestType] || r.requestType}{r.requestType === "SET_RECOVERY" ? "/mo" : ""}</span>
                {r.requestType === "OTHER" && r.direction === "CREDIT" && <span className="ml-1 text-xs font-normal text-emerald-600">reimbursement</span>}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {r.targetMonth ? `${REQ_MONTHS[r.targetMonth]} ${r.targetYear} · ` : ""}{r.reason || "—"}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge className={REQ_STATUS_TONE[r.status] || "bg-slate-100 text-slate-700"}>{r.status}</Badge>
              {r.status === "PENDING" && (
                <>
                  <button className="text-xs font-medium text-primary" onClick={() => approve(r.id)}>Approve</button>
                  <button className="text-xs font-medium text-rose-600" onClick={() => reject(r.id)}>Reject</button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MiniList({ rows, empty }: { rows: { id: number; main: string; sub: string; right: string; status?: string; action?: { label: string; fn: () => void } }[]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="divide-y">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center justify-between py-2 text-sm">
          <div><div className="font-semibold">{r.main}</div><div className="text-xs text-muted-foreground">{r.sub}</div></div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">{r.right}</span>
            {r.status && <Badge className="bg-slate-100 text-slate-700">{r.status}</Badge>}
            {r.action && <button className="text-xs text-primary" onClick={r.action.fn}>{r.action.label}</button>}
          </div>
        </li>
      ))}
    </ul>
  );
}

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { workforceApi } from "@/api/workforceApi";
import { payrollApi } from "@/api/payrollApi";
import { contractorApi } from "@/api/contractorApi";
import type { WorkforceFinance, PayrollRequest } from "@/types/payroll";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExternalLink, FileText, Pencil, Plus, Printer } from "lucide-react";
import PayslipEditor from "@/pages/hr/PayslipEditor";

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
const SLIP_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "To approve", cls: "bg-amber-100 text-amber-800" },
  APPROVED: { label: "To pay", cls: "bg-sky-100 text-sky-800" },
  PAID: { label: "Paid", cls: "bg-emerald-100 text-emerald-700" },
};
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * One employee's pay: what they owe, their payslips (opened in the same editor as the pay run, which
 * can also make, regenerate or delete a month), everything they've borrowed, and their borrow /
 * repay requests.
 */
function EmployeeFinance({ fin, reload }: { fin: WorkforceFinance; reload: () => void }) {
  const empId = fin.employeeId!;
  const now = new Date();
  const [advOpen, setAdvOpen] = useState(false);
  const [loanOpen, setLoanOpen] = useState(false);
  const [reqs, setReqs] = useState<PayrollRequest[]>([]);
  const [slip, setSlip] = useState<{ month: number; year: number } | null>(null);
  const [pickMonth, setPickMonth] = useState(now.getMonth() + 1);
  const [pickYear, setPickYear] = useState(now.getFullYear());

  const loadReqs = useCallback(() => {
    payrollApi.payrollRequestsForEmployee(empId).then(setReqs).catch(() => setReqs([]));
  }, [empId]);
  useEffect(() => { loadReqs(); }, [loadReqs]);
  const reloadAll = () => { reload(); loadReqs(); };

  const payslips = [...(fin.payslips ?? [])].sort((a, b) => b.year - a.year || b.month - a.month);
  const last = payslips[0];
  const paidThisYear = payslips.filter((p) => p.status === "PAID" && p.year === now.getFullYear())
    .reduce((a, p) => a + Number(p.netSalary || 0), 0);
  const debts = [
    ...(fin.advances ?? []).map((a) => ({
      key: `a-${a.id}`, kind: "Advance", date: a.advanceDate, amount: a.amount, perMonth: a.monthlyRecovery,
      balance: a.balance, status: a.status, open: Number(a.balance || 0) > 0 && a.status !== "RECOVERED",
      action: a.status === "PENDING" ? { label: "Approve", fn: () => payrollApi.approveAdvance(a.id!).then(() => { toast.success("Advance approved."); reload(); }) } : undefined,
    })),
    ...(fin.loans ?? []).map((l) => ({
      key: `l-${l.id}`, kind: "Loan", date: (l as any).disbursedDate as string | undefined, amount: l.principal, perMonth: l.emiAmount,
      balance: l.balance, status: l.status, open: Number(l.balance || 0) > 0 && l.status !== "CLOSED",
      action: l.status === "ACTIVE" ? { label: "Close", fn: () => payrollApi.closeLoan(l.id!).then(() => { toast.success("Loan closed."); reload(); }) } : undefined,
    })),
  ].sort((a, b) => Number(b.open) - Number(a.open) || String(b.date || "").localeCompare(String(a.date || "")));
  const owed = debts.filter((d) => d.open && d.status !== "PENDING").reduce((a, d) => a + Number(d.balance || 0), 0);
  const sortedReqs = [...reqs].sort((a, b) => Number(b.status === "PENDING") - Number(a.status === "PENDING") || b.id - a.id);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <SummaryTile label="Owes now" value={inr(owed)} tone={owed > 0 ? "text-rose-700" : "text-slate-900"}
          hint={owed > 0 ? "Comes off their salary each month" : "Nothing to pay back"} />
        <SummaryTile label="Last payslip" value={last ? inr(last.netSalary) : "—"}
          hint={last ? `${MONTH_NAMES[last.month - 1]} ${last.year} · ${SLIP_STATUS[last.status]?.label ?? last.status}` : "None yet"} />
        <SummaryTile label={`Paid in ${now.getFullYear()}`} value={inr(paidThisYear)} tone="text-emerald-700" />
      </div>

      <Card title="Payslips" action={
        <div className="flex flex-wrap items-center gap-1.5">
          <select value={pickMonth} onChange={(e) => setPickMonth(Number(e.target.value))} aria-label="Month"
            className="h-9 rounded-md border border-input bg-card px-2 text-sm">
            {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m.slice(0, 3)}</option>)}
          </select>
          <select value={pickYear} onChange={(e) => setPickYear(Number(e.target.value))} aria-label="Year"
            className="h-9 rounded-md border border-input bg-card px-2 text-sm">
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <Button size="sm" variant="outline" onClick={() => setSlip({ month: pickMonth, year: pickYear })}>Open month</Button>
        </div>
      }>
        {payslips.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No payslips yet. Pick a month and open it to make one.</p>
        ) : (
          <ul className="divide-y">
            {payslips.map((p) => {
              const st = SLIP_STATUS[p.status] ?? { label: p.status, cls: "bg-slate-100 text-slate-700" };
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                  <div className="min-w-[8rem] flex-1">
                    <div className="font-medium text-slate-900">{MONTH_NAMES[p.month - 1]} {p.year}</div>
                    <div className="text-xs text-slate-500 tabular-nums">
                      {inr(p.grossEarnings)}{Number(p.totalDeductions || 0) > 0 && <span className="text-rose-700"> − {inr(p.totalDeductions)}</span>}
                    </div>
                  </div>
                  <div className="text-right font-semibold tabular-nums text-slate-900">{inr(p.netSalary)}</div>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setSlip({ month: p.month, year: p.year })}>
                      {p.status === "PAID" ? <><FileText className="mr-1 h-3.5 w-3.5" /> View</> : <><Pencil className="mr-1 h-3.5 w-3.5" /> Edit</>}
                    </Button>
                    <Button asChild size="sm" variant="ghost"><Link to={`/hr/payslip/${p.id}`} target="_blank" rel="noreferrer" aria-label={`Print ${MONTH_NAMES[p.month - 1]} payslip`}><Printer className="h-3.5 w-3.5" /></Link></Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-2 text-xs text-slate-500">Approve and pay from the pay run, where the whole month is handled together.</p>
      </Card>

      <Card title="Borrowed money" action={
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" onClick={() => setAdvOpen(true)}><Plus className="mr-1 h-4 w-4" /> Lend</Button>
          <Button size="sm" variant="outline" onClick={() => setLoanOpen(true)}><Plus className="mr-1 h-4 w-4" /> Loan</Button>
        </div>
      }>
        {debts.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">They haven't borrowed anything.</p>
        ) : (
          <ul className="divide-y">
            {debts.map((d) => (
              <li key={d.key} className={`flex flex-wrap items-center gap-x-4 gap-y-1 py-3 ${d.open ? "" : "opacity-60"}`}>
                <div className="min-w-[9rem] flex-1">
                  <div className="font-medium text-slate-900">{d.kind} · {inr(d.amount)}</div>
                  <div className="text-xs text-slate-500">{[d.date, Number(d.perMonth || 0) > 0 ? `${inr(d.perMonth)}/month` : null].filter(Boolean).join(" · ") || "—"}</div>
                </div>
                <div className="text-right">
                  <div className={`font-semibold tabular-nums ${d.open ? "text-rose-700" : "text-slate-500"}`}>{inr(d.balance)}</div>
                  <div className="text-[11px] text-slate-500">left</div>
                </div>
                <Badge className="bg-slate-100 text-slate-700">{String(d.status || "").replace(/_/g, " ").toLowerCase()}</Badge>
                {d.action && <Button size="sm" variant="ghost" onClick={d.action.fn}>{d.action.label}</Button>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Borrow & repay requests">
        {sortedReqs.length === 0
          ? <p className="py-4 text-center text-sm text-muted-foreground">No requests from the employee app.</p>
          : <RequestBlock reqs={sortedReqs} reload={reloadAll} />}
      </Card>

      {advOpen && <AdvanceDialog employeeId={empId} onClose={() => setAdvOpen(false)} onSaved={() => { setAdvOpen(false); toast.success("Advance added."); reload(); }} />}
      {loanOpen && <LoanDialog employeeId={empId} onClose={() => setLoanOpen(false)} onSaved={() => { setLoanOpen(false); toast.success("Loan added."); reload(); }} />}
      {slip && (
        <PayslipEditor employeeId={empId} name={fin.fullName} month={slip.month} year={slip.year}
          onClose={() => { setSlip(null); reloadAll(); }} onChanged={reloadAll} />
      )}
    </div>
  );
}

function SummaryTile({ label, value, hint, tone = "text-slate-900" }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="min-w-0 rounded-xl border bg-white p-3 shadow-sm sm:p-4">
      <div className="truncate text-[11px] text-slate-500 sm:text-xs">{label}</div>
      <div className={`truncate text-base font-semibold tabular-nums sm:text-xl ${tone}`}>{value}</div>
      {hint && <div className="mt-0.5 hidden truncate text-xs text-slate-500 sm:block">{hint}</div>}
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
        <DialogHeader><DialogTitle>Lend money (advance)</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Num label="Amount" v={f.amount} on={(v) => setF({ ...f, amount: v })} />
          <Num label="Pay back per month" v={f.monthlyRecovery} on={(v) => setF({ ...f, monthlyRecovery: v })} />
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

/* --------------------------------------------------------------- primitives */
function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white border rounded-2xl shadow-sm p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-slate-900">{title}</h3>{action}</div>
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
const REQ_STATUS_LABEL: Record<string, string> = {
  PENDING: "Waiting", APPROVED: "Approved", CONVERTED: "Given", APPLIED: "On payslip", REJECTED: "Rejected",
};
const REQ_STATUS_TONE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700", APPROVED: "bg-emerald-100 text-emerald-700",
  APPLIED: "bg-slate-200 text-slate-700", CONVERTED: "bg-teal-100 text-teal-700",
  REJECTED: "bg-rose-100 text-rose-700",
};

// Employee-raised borrow / repay requests, approvable in place.
function RequestBlock({ reqs, reload }: { reqs: PayrollRequest[]; reload: () => void }) {
  const [rejecting, setRejecting] = useState<{ id: number; remarks: string } | null>(null);
  const approve = (id: number) =>
    payrollApi.approvePayrollRequest(id).then(() => { toast.success("Request approved."); reload(); })
      .catch((e: any) => toast.error(e?.response?.data?.message || "Failed to approve"));
  const reject = () => {
    if (!rejecting) return;
    payrollApi.rejectPayrollRequest(rejecting.id, rejecting.remarks.trim() || undefined)
      .then(() => { toast.success("Request rejected."); setRejecting(null); reload(); })
      .catch((e: any) => toast.error(e?.response?.data?.message || "Failed to reject"));
  };
  return (
    <>
      <ul className="divide-y">
        {reqs.map((r) => (
          <li key={r.id} className={`flex flex-wrap items-center justify-between gap-2 py-3 text-sm ${r.status === "PENDING" ? "" : "opacity-70"}`}>
            <div className="min-w-0">
              <div className="font-medium text-slate-900">
                {REQ_TYPE_LABEL[r.requestType] || r.requestType} · <span className="tabular-nums">{inr(r.amount)}</span>
                {r.requestType === "OTHER" && r.direction === "CREDIT" && <span className="ml-1 text-xs font-normal text-emerald-600">reimbursement</span>}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {r.targetMonth ? `${REQ_MONTHS[r.targetMonth]} ${r.targetYear} · ` : ""}{r.reason || "—"}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge className={REQ_STATUS_TONE[r.status] || "bg-slate-100 text-slate-700"}>{REQ_STATUS_LABEL[r.status] ?? r.status}</Badge>
              {r.status === "PENDING" && (
                <>
                  <Button size="sm" variant="forest" onClick={() => approve(r.id)}>Approve</Button>
                  <Button size="sm" variant="ghost" onClick={() => setRejecting({ id: r.id, remarks: "" })}>Reject</Button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Reject request</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Reason (the employee sees this)</Label>
            <Input autoFocus value={rejecting?.remarks ?? ""} onChange={(e) => setRejecting((x) => x && { ...x, remarks: e.target.value })} placeholder="Optional" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button variant="destructive" onClick={reject}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}


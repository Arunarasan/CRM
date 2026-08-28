import { useEffect, useMemo, useState } from "react";
import { payrollApi } from "@/api/payrollApi";
import { contractorApi } from "@/api/contractorApi";
import { inr } from "@/pages/workforce/WorkforceFinanceTab";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Users, X, Zap } from "lucide-react";

/**
 * Quick Pay — search any employee or contractor by name and record a payment inline, without
 * leaving the payroll page. Reuses the existing engines end to end (no control bypass):
 *   • Employee salary  → generate (hourly/monthly per basis) → approve → pay
 *   • Employee advance → create → approve
 *   • Employee bonus / incentive / other → award → approve → pay
 *   • Contractor       → contractor payment (ADVANCE type, ledger-posted; no bill required)
 *
 * Employee ids come from the caller's already-loaded list (Employee/HR ids — the ids the payroll
 * endpoints expect). Contractors are fetched here by name. The contractor path needs CONTRACTOR_PAYMENT
 * (or admin) on the backend; the caller passes canPayContractor so we only offer it when usable.
 */

type Person = { type: "EMPLOYEE" | "CONTRACTOR"; id: number; name: string; code?: string; raw: any };

const EMP_PAY_TYPES = [
  { key: "SALARY", label: "Salary payslip" },
  { key: "ADVANCE", label: "Advance" },
  { key: "BONUS", label: "Bonus" },
  { key: "INCENTIVE", label: "Incentive" },
  { key: "OTHER", label: "Other one-off" },
] as const;
type EmpPayType = (typeof EMP_PAY_TYPES)[number]["key"];

const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const empName = (e: any) => [e?.firstName, e?.lastName].filter(Boolean).join(" ") || e?.name || "Employee";
const isHourlyBasis = (e: any) => {
  const t = (e?.salaryType || "").toUpperCase();
  if (t) return t === "HOURLY";
  return e?.hourlyRate != null && e?.hourlyRate !== "";
};

export default function QuickPayDialog({
  open, onClose, employees, canPayContractor, onDone,
}: {
  open: boolean;
  onClose: () => void;
  employees: any[];
  canPayContractor: boolean;
  onDone: () => void;
}) {
  const [contractors, setContractors] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [person, setPerson] = useState<Person | null>(null);
  const [busy, setBusy] = useState(false);

  // Employee payment form
  const now = new Date();
  const [empType, setEmpType] = useState<EmpPayType>("SALARY");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [amount, setAmount] = useState("");
  const [monthlyRecovery, setMonthlyRecovery] = useState("");
  const [note, setNote] = useState("");

  // Contractor payment form
  const [payMode, setPayMode] = useState("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (!open) return;
    // Reset each time it opens.
    setQ(""); setPerson(null); setBusy(false);
    setEmpType("SALARY"); setAmount(""); setMonthlyRecovery(""); setNote("");
    setPayMode("BANK_TRANSFER"); setReference(""); setPayDate(new Date().toISOString().slice(0, 10));
    if (canPayContractor) {
      contractorApi.list({ size: 500 }).then((r) => setContractors(r.content || [])).catch(() => setContractors([]));
    } else {
      setContractors([]);
    }
  }, [open, canPayContractor]);

  const results = useMemo<Person[]>(() => {
    const needle = q.trim().toLowerCase();
    const emps: Person[] = employees.map((e) => ({
      type: "EMPLOYEE", id: e.id, name: empName(e), code: e.employeeCode, raw: e,
    }));
    const cons: Person[] = contractors.map((c) => ({
      type: "CONTRACTOR", id: c.id, name: c.name || c.companyName || `Contractor #${c.id}`, code: c.contractorCode, raw: c,
    }));
    const all = [...emps, ...cons];
    if (!needle) return all.slice(0, 30);
    return all.filter((p) =>
      p.name.toLowerCase().includes(needle) || (p.code || "").toLowerCase().includes(needle)
    ).slice(0, 30);
  }, [q, employees, contractors]);

  const amt = Number(amount);
  const amtValid = amount !== "" && amt > 0;

  const finish = (msg: string) => { toast.success(msg); onDone(); onClose(); };
  const fail = (e: any, fallback: string) => toast.error(e?.response?.data?.message || e?.message || fallback);

  // ---- employee actions -------------------------------------------------
  const paySalary = async (empId: number, hourly: boolean) => {
    let recordId: number | undefined;
    try {
      const rec: any = hourly
        ? await payrollApi.runHourlyPayroll({ employeeId: empId, month, year })
        : await payrollApi.runPayroll({ employeeId: empId, month, year });
      recordId = rec?.id;
    } catch (e: any) {
      // Likely already generated for this period — reuse the existing record.
      const reg = await payrollApi.register(month, year).catch(() => [] as any[]);
      const existing = (reg as any[]).find((r) => r?.employee?.id === empId);
      if (!existing) throw e;
      recordId = existing.id;
    }
    if (!recordId) throw new Error("Could not resolve the payslip to pay.");
    try { await payrollApi.approvePayroll(recordId); } catch { /* already approved/paid — proceed to pay */ }
    await payrollApi.markPaid(recordId);
  };

  const submitEmployee = async () => {
    if (!person) return;
    const empId = person.id;
    setBusy(true);
    try {
      if (empType === "SALARY") {
        await paySalary(empId, isHourlyBasis(person.raw));
        finish(`Salary paid to ${person.name} for ${MONTHS[month]} ${year}.`);
      } else if (empType === "ADVANCE") {
        if (!amtValid) { toast.error("Enter an amount greater than zero."); setBusy(false); return; }
        const adv: any = await payrollApi.createAdvance(empId, {
          amount: amt, monthlyRecovery: monthlyRecovery ? Number(monthlyRecovery) : undefined, reason: note || undefined,
        } as any);
        await payrollApi.approveAdvance(adv.id);
        finish(`Advance of ${inr(amt)} approved for ${person.name}.`);
      } else {
        if (!amtValid) { toast.error("Enter an amount greater than zero."); setBusy(false); return; }
        const bonusType = empType === "BONUS" ? "MANUAL" : empType === "INCENTIVE" ? "INCENTIVE" : "OTHER";
        const b: any = await payrollApi.awardBonus(empId, { bonusType, amount: amt, reason: note || undefined });
        await payrollApi.approveBonus(b.id);
        await payrollApi.payBonus(b.id);
        const label = empType === "BONUS" ? "Bonus" : empType === "INCENTIVE" ? "Incentive" : "Payment";
        finish(`${label} of ${inr(amt)} paid to ${person.name}.`);
      }
    } catch (e) {
      fail(e, "Could not complete the payment.");
      setBusy(false);
    }
  };

  // ---- contractor action ------------------------------------------------
  const submitContractor = async () => {
    if (!person) return;
    if (!amtValid) { toast.error("Enter an amount greater than zero."); return; }
    setBusy(true);
    try {
      await contractorApi.recordPayment({
        contractorId: person.id,
        payment: {
          amount: amt, paymentType: "ADVANCE", paymentMode: payMode,
          referenceNumber: reference || undefined, paymentDate: payDate, remarks: note || undefined,
        } as any,
      });
      finish(`Payment of ${inr(amt)} recorded for ${person.name}.`);
    } catch (e) {
      fail(e, "Could not record the contractor payment.");
      setBusy(false);
    }
  };

  const inputCls = "w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Zap className="w-5 h-5 text-emerald-600" /> Quick Pay</DialogTitle>
        </DialogHeader>

        {!person ? (
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-2 px-3 h-10 rounded-md border bg-slate-50">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                autoFocus value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Search employee or contractor by name…"
                className="flex-1 bg-transparent text-sm outline-none"
              />
            </div>
            <div className="max-h-72 overflow-y-auto rounded-md border divide-y">
              {results.length === 0 && <div className="p-4 text-center text-sm text-slate-400">No matches.</div>}
              {results.map((p) => (
                <button
                  key={`${p.type}:${p.id}`} type="button" onClick={() => { setPerson(p); if (p.type === "CONTRACTOR") setEmpType("OTHER"); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50"
                >
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${p.type === "CONTRACTOR" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                    {p.type === "CONTRACTOR" ? "Contractor" : "Employee"}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-800 truncate">{p.name}</span>
                    {p.code && <span className="block text-xs text-slate-400 truncate">{p.code}</span>}
                  </span>
                </button>
              ))}
            </div>
            {!canPayContractor && (
              <p className="flex items-center gap-1.5 text-xs text-slate-400"><Users className="w-3.5 h-3.5" /> Contractors are hidden — paying them needs contractor-payment rights.</p>
            )}
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            {/* selected person */}
            <div className="flex items-center justify-between rounded-lg border bg-slate-50 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${person.type === "CONTRACTOR" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                  {person.type === "CONTRACTOR" ? "Contractor" : "Employee"}
                </span>
                <div>
                  <div className="text-sm font-semibold text-slate-800">{person.name}</div>
                  {person.code && <div className="text-xs text-slate-400">{person.code}</div>}
                </div>
              </div>
              <button type="button" onClick={() => setPerson(null)} className="text-slate-400 hover:text-slate-700" title="Change person">
                <X className="w-4 h-4" />
              </button>
            </div>

            {person.type === "EMPLOYEE" ? (
              <>
                <div className="space-y-1.5">
                  <Label>Payment</Label>
                  <select className={inputCls} value={empType} onChange={(e) => setEmpType(e.target.value as EmpPayType)}>
                    {EMP_PAY_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                </div>

                {empType === "SALARY" ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5"><Label>Month</Label>
                        <select className={inputCls} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                          {MONTHS.slice(1).map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5"><Label>Year</Label><Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} /></div>
                    </div>
                    <p className="text-xs text-slate-400">
                      Generates the {isHourlyBasis(person.raw) ? "hourly" : "monthly"} payslip for this period (from their basis), then approves and pays it. If one already exists, it is approved and paid.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5"><Label>Amount (₹)</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
                      {empType === "ADVANCE" && (
                        <div className="space-y-1.5"><Label>Monthly recovery (₹)</Label><Input type="number" value={monthlyRecovery} onChange={(e) => setMonthlyRecovery(e.target.value)} placeholder="optional" /></div>
                      )}
                    </div>
                    <div className="space-y-1.5"><Label>Note / reason</Label><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" /></div>
                    {empType === "ADVANCE" && <p className="text-xs text-slate-400">Creates a recoverable advance and approves it.</p>}
                  </>
                )}

                <Button className="w-full" disabled={busy} onClick={submitEmployee}>
                  {busy ? "Working…" : empType === "SALARY" ? `Pay salary` : `Pay ${amtValid ? inr(amt) : ""}`.trim()}
                </Button>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Amount (₹)</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Payment mode</Label>
                    <select className={inputCls} value={payMode} onChange={(e) => setPayMode(e.target.value)}>
                      {["BANK_TRANSFER", "CASH", "CHEQUE", "UPI"].map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5"><Label>Reference #</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="optional" /></div>
                  <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} /></div>
                </div>
                <div className="space-y-1.5"><Label>Note / remarks</Label><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" /></div>
                <p className="text-xs text-slate-400">
                  Records a direct <b>advance</b> payment to the contractor and posts it to their ledger. It is not tied to a bill — for bill settlement with approval, use the contractor module.
                </p>
                <Button className="w-full" disabled={busy} onClick={submitContractor}>
                  {busy ? "Working…" : `Pay ${amtValid ? inr(amt) : ""}`.trim()}
                </Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

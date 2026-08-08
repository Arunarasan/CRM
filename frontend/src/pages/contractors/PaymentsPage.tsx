import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { contractorApi } from "@/api/contractorApi";
import type { Contractor, ContractorBill, ContractorPayment } from "@/types/contractor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet, PiggyBank } from "lucide-react";

const currency = (n?: number) => `₹${(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default function PaymentsPage() {
  const [payable, setPayable] = useState<ContractorBill[]>([]);
  const [payments, setPayments] = useState<ContractorPayment[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    contractorApi.getPayableBills().then(setPayable).catch(() => {});
    contractorApi.getPayments("PAID").then(setPayments).catch(() => {});
    contractorApi.list({ status: "ACTIVE", size: 200 }).then((p) => setContractors(p.content ?? [])).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      {notice && <div className="text-sm bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md p-3">{notice}</div>}

      <Tabs defaultValue="due">
        <div className="flex items-center gap-3">
          <TabsList>
            <TabsTrigger value="due">Due for payment</TabsTrigger>
            <TabsTrigger value="history">Payment history</TabsTrigger>
          </TabsList>
          <div className="flex-1" />
          <AdvanceButton contractors={contractors} onDone={() => { load(); setNotice("Advance recorded."); }} />
          <RetentionButton onDone={() => { load(); setNotice("Retention released."); }} />
        </div>

        <TabsContent value="due">
          <Panel>
            <SimpleTable
              head={["Bill", "Contractor", "Project · Package", "Net", "Paid", "Balance", ""]}
              rows={payable.map((b) => [
                <Link to={`/contractors/bills/${b.id}`} className="font-bold text-slate-800 hover:text-primary">
                  {b.billNumber}
                  <div className="text-[11px] font-normal text-slate-400">{b.billDate}</div>
                </Link>,
                b.contractor.name,
                <div className="text-xs">
                  <div>{b.project?.projectName}</div>
                  <div className="text-muted-foreground">{b.workPackage?.packageCode ?? "—"}</div>
                </div>,
                currency(b.netAmount), currency(b.paidAmount),
                <span className="font-bold text-rose-600">{currency(b.balanceAmount)}</span>,
                <Link to={`/contractors/bills/${b.id}`}>
                  <Button size="sm"><Wallet className="w-3.5 h-3.5 mr-1" /> Pay</Button>
                </Link>,
              ])}
              empty="Nothing awaiting payment — bills appear here once Finance approves them."
            />
          </Panel>
        </TabsContent>

        <TabsContent value="history">
          <Panel>
            <SimpleTable
              head={["Date", "Contractor", "Type", "Amount", "Mode", "Reference", "Bill", "Project"]}
              rows={payments.map((p) => [
                p.paymentDate ?? "—",
                <Link to={`/contractors/directory/${p.contractor.id}`} className="hover:text-primary">{p.contractor.name}</Link>,
                <Badge className={
                  p.paymentType === "ADVANCE" ? "bg-amber-100 text-amber-700"
                  : p.paymentType === "RETENTION_RELEASE" ? "bg-violet-100 text-violet-700"
                  : "bg-emerald-100 text-emerald-700"
                }>{p.paymentType.replace(/_/g, " ")}</Badge>,
                <span className="font-semibold">{currency(p.amount)}</span>,
                p.paymentMode ?? "—", p.referenceNumber ?? "—",
                p.bill ? <Link to={`/contractors/bills/${p.bill.id}`} className="text-primary hover:underline">{p.bill.billNumber}</Link> : "—",
                p.project?.projectName ?? "—",
              ])}
              empty="No payments recorded yet."
            />
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AdvanceButton({ contractors, onDone }: { contractors: Contractor[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [contractorId, setContractorId] = useState("");
  const [form, setForm] = useState<Record<string, string>>({ paymentMode: "BANK_TRANSFER" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!contractorId || !form.amount) { setError("Contractor and amount are required."); return; }
    setSaving(true); setError(null);
    try {
      await contractorApi.recordPayment({
        contractorId: Number(contractorId),
        payment: {
          amount: Number(form.amount),
          paymentType: "ADVANCE",
          paymentMode: form.paymentMode,
          referenceNumber: form.referenceNumber,
          paymentDate: form.paymentDate || undefined,
          remarks: form.remarks,
        },
      });
      setOpen(false); onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record the advance.");
    } finally { setSaving(false); }
  };

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <>
      <Button variant="outline" onClick={() => { setError(null); setOpen(true); }}>Pay advance</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Contractor advance</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2">
            An advance stands alone — no bill needed. It's set off against a later running or final bill.
          </p>
          <div className="space-y-3">
            <Field label="Contractor">
              <select className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                      value={contractorId} onChange={(e) => setContractorId(e.target.value)}>
                <option value="">Select…</option>
                {contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount (₹)"><Input type="number" onChange={(e) => set("amount", e.target.value)} /></Field>
              <Field label="Date"><Input type="date" onChange={(e) => set("paymentDate", e.target.value)} /></Field>
              <Field label="Mode">
                <select className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                        value={form.paymentMode} onChange={(e) => set("paymentMode", e.target.value)}>
                  {["BANK_TRANSFER", "NEFT", "RTGS", "UPI", "CHEQUE", "CASH"].map((m) =>
                    <option key={m} value={m}>{m.replace(/_/g, " ")}</option>)}
                </select>
              </Field>
              <Field label="Reference"><Input onChange={(e) => set("referenceNumber", e.target.value)} /></Field>
            </div>
            {error && <div className="text-sm bg-rose-50 border border-rose-200 text-rose-700 rounded-md p-3">{error}</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Record advance"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RetentionButton({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [packages, setPackages] = useState<{ id: number; packageCode?: string; packageName: string }[]>([]);
  const [workPackageId, setWorkPackageId] = useState("");
  const [contractorId, setContractorId] = useState("");
  const [assignees, setAssignees] = useState<Contractor[]>([]);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Retention is only releasable once a package is closed.
    contractorApi.listWorkPackages({ status: "COMPLETED", size: 200 })
      .then((p) => setPackages(p.content ?? [])).catch(() => {});
  }, [open]);

  useEffect(() => {
    setContractorId("");
    if (!workPackageId) { setAssignees([]); return; }
    contractorApi.getAssignments(Number(workPackageId))
      .then((a) => setAssignees(a.filter((x) => x.status !== "REJECTED").map((x) => x.contractor)))
      .catch(() => setAssignees([]));
  }, [workPackageId]);

  const save = async () => {
    if (!workPackageId || !contractorId) { setError("Pick a completed package and its contractor."); return; }
    setSaving(true); setError(null);
    try {
      await contractorApi.releaseRetention(Number(contractorId), Number(workPackageId),
        amount ? Number(amount) : undefined, "Defect liability period completed");
      setOpen(false); onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not release retention.");
    } finally { setSaving(false); }
  };

  return (
    <>
      <Button variant="outline" onClick={() => { setError(null); setOpen(true); }}>
        <PiggyBank className="w-4 h-4 mr-1" /> Release retention
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Release retention</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2">
            Only completed work packages appear — retention is held until the package closes.
          </p>
          <div className="space-y-3">
            <Field label="Work package">
              <select className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                      value={workPackageId} onChange={(e) => setWorkPackageId(e.target.value)}>
                <option value="">Select…</option>
                {packages.map((p) => <option key={p.id} value={p.id}>{p.packageCode} · {p.packageName}</option>)}
              </select>
            </Field>
            <Field label="Contractor">
              <select className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                      value={contractorId} onChange={(e) => setContractorId(e.target.value)} disabled={!assignees.length}>
                <option value="">Select…</option>
                {assignees.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Amount (₹) — blank releases everything held">
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            {error && <div className="text-sm bg-rose-50 border border-rose-200 text-rose-700 rounded-md p-3">{error}</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Releasing…" : "Release"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="bg-white border rounded-2xl shadow-sm overflow-hidden mt-4">{children}</div>;
}

function SimpleTable({ head, rows, empty }: { head: string[]; rows: React.ReactNode[][]; empty: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-500">
          <tr className="text-left">{head.map((h, i) => <th key={i} className="p-3 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y">
          {rows.length === 0 && (
            <tr><td colSpan={head.length} className="p-8 text-center text-muted-foreground">{empty}</td></tr>
          )}
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-slate-50">
              {r.map((cell, j) => <td key={j} className="p-3">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-slate-500">{label}</Label>
      {children}
    </div>
  );
}

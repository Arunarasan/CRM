import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { contractorApi } from "@/api/contractorApi";
import type { BillDetail } from "@/types/contractor";
import { BILL_STATUS_TONE } from "@/types/contractor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, CheckCircle2, XCircle, Wallet } from "lucide-react";
import { useGoBack } from "@/hooks/useGoBack";

const currency = (n?: number) => `₹${(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const STAGE_LABEL: Record<string, string> = {
  SITE_ENGINEER: "Site Engineer",
  PROJECT_MANAGER: "Project Manager",
  FINANCE: "Finance",
};

export default function BillDetailPage() {
  const { id } = useParams();
  const billId = Number(id);
  const goBack = useGoBack("/contractors/bills");
  const [detail, setDetail] = useState<BillDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = useCallback(() => {
    contractorApi.getBill(billId).then(setDetail).catch((e) => setError(String(e)));
  }, [billId]);

  useEffect(() => { reload(); }, [reload]);

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    setError(null); setNotice(null);
    try { await fn(); setNotice(msg); reload(); }
    catch (e) { setError(e instanceof Error ? e.message : "Action failed."); }
  };

  if (!detail) return <div className="p-8 text-sm text-muted-foreground">Loading bill…</div>;

  const b = detail.bill;
  const canApprove = ["SUBMITTED", "ENGINEER_APPROVED", "PM_APPROVED"].includes(b.status);
  const canPay = ["FINANCE_APPROVED", "PARTIALLY_PAID"].includes(b.status) && Number(b.balanceAmount) > 0;

  const deductions = [
    ["Material recovery", b.materialDeduction],
    ["Advance adjustment", b.advanceAdjustment],
    ["Penalty", b.penaltyAmount],
    ["Other deduction", b.otherDeduction],
  ] as const;

  return (
    <div className="space-y-5">
      <button type="button" onClick={goBack} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="bg-white border rounded-2xl shadow-sm p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-2xl font-black text-slate-900">{b.billNumber}</h2>
              <Badge className={BILL_STATUS_TONE[b.status]}>{b.status.replace(/_/g, " ")}</Badge>
              <Badge className="bg-slate-100 text-slate-700">{b.billType}</Badge>
            </div>
            <div className="mt-2 text-sm text-slate-600">
              <Link to={`/contractors/directory/${b.contractor.id}`} className="font-semibold hover:text-primary">
                {b.contractor.name}
              </Link>
              {" · "}
              <Link to={`/projects/${b.project.id}`} className="hover:text-primary">{b.project.projectName}</Link>
              {b.workPackage && (
                <>
                  {" · "}
                  <Link to={`/contractors/work-packages/${b.workPackage.id}`} className="hover:text-primary">
                    {b.workPackage.packageCode}
                  </Link>
                </>
              )}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Bill date {b.billDate}
              {b.periodFrom && ` · period ${b.periodFrom} → ${b.periodTo}`}
              {b.contractorInvoiceNumber && ` · contractor invoice ${b.contractorInvoiceNumber}`}
              {b.workCompletedPercentage != null && ` · work ${b.workCompletedPercentage}% complete`}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            {b.status === "DRAFT" && (
              <Button onClick={() => act(() => contractorApi.submitBill(billId), "Bill submitted for approval.")}>
                Submit for approval
              </Button>
            )}
            {canApprove && (
              <>
                <ApproveButton billId={billId} netAmount={Number(b.netAmount)}
                               stage={b.currentApprovalStage} onDone={reload} />
                <Button variant="outline"
                        onClick={() => act(() => contractorApi.rejectBill(billId, "Rejected on review"), "Bill rejected.")}>
                  <XCircle className="w-4 h-4 mr-1" /> Reject
                </Button>
              </>
            )}
            {canPay && <PayButton billId={billId} contractorId={b.contractor.id}
                                  balance={Number(b.balanceAmount)} onDone={reload} />}
          </div>
        </div>
      </div>

      {notice && <div className="text-sm bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md p-3">{notice}</div>}
      {error && <div className="text-sm bg-rose-50 border border-rose-200 text-rose-700 rounded-md p-3">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-slate-50"><h3 className="font-bold text-slate-800 text-sm">Measured work</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-slate-500 border-b">
                  <tr className="text-left">
                    <th className="p-3 font-semibold">Description</th>
                    <th className="p-3 font-semibold">Unit</th>
                    <th className="p-3 font-semibold text-right">Qty</th>
                    <th className="p-3 font-semibold text-right">Prev. billed</th>
                    <th className="p-3 font-semibold text-right">Rate</th>
                    <th className="p-3 font-semibold text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {detail.items.length === 0 && (
                    <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No measured lines.</td></tr>
                  )}
                  {detail.items.map((i) => (
                    <tr key={i.id}>
                      <td className="p-3">{i.description}</td>
                      <td className="p-3">{i.unit ?? "—"}</td>
                      <td className="p-3 text-right">{i.quantity}</td>
                      <td className="p-3 text-right text-muted-foreground">{i.previouslyBilledQuantity ?? 0}</td>
                      <td className="p-3 text-right">{currency(i.rate)}</td>
                      <td className="p-3 text-right font-semibold">{currency(i.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-slate-50"><h3 className="font-bold text-slate-800 text-sm">Approval trail</h3></div>
            <div className="divide-y">
              {detail.approvals.map((a) => (
                <div key={a.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-sm text-slate-800">
                      {a.sequence}. {STAGE_LABEL[a.stage] ?? a.stage}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {a.approver?.name ? `${a.approver.name} · ` : ""}{a.actedAt ?? "awaiting action"}
                      {a.comments ? ` · ${a.comments}` : ""}
                    </div>
                  </div>
                  <Badge className={
                    a.status === "APPROVED" ? "bg-emerald-100 text-emerald-700"
                    : a.status === "REJECTED" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                  }>{a.status}</Badge>
                </div>
              ))}
              {detail.approvals.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">Not submitted yet.</div>
              )}
            </div>
          </div>

          <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-slate-50"><h3 className="font-bold text-slate-800 text-sm">Payments</h3></div>
            <div className="divide-y">
              {detail.payments.map((p) => (
                <div key={p.id} className="p-4 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-semibold text-slate-800">{currency(p.amount)}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.paymentDate} · {p.paymentMode ?? "—"} · {p.referenceNumber ?? "—"}
                    </div>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-700">{p.paymentType.replace(/_/g, " ")}</Badge>
                </div>
              ))}
              {detail.payments.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">No payments released yet.</div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white border rounded-2xl shadow-sm p-5 h-fit">
          <h3 className="font-bold text-slate-800 text-sm mb-4">Bill summary</h3>
          <Row label="Gross amount" value={currency(b.grossAmount)} bold />
          {deductions.map(([label, value]) =>
            Number(value) > 0 ? <Row key={label} label={label} value={`− ${currency(Number(value))}`} tone="minus" /> : null)}
          <div className="border-t my-2" />
          <Row label="Taxable amount" value={currency(b.taxableAmount)} bold />
          {Number(b.gstAmount) > 0 && <Row label={`GST @ ${b.gstPercentage}%`} value={`+ ${currency(b.gstAmount)}`} />}
          {Number(b.tdsAmount) > 0 && <Row label={`TDS @ ${b.tdsPercentage}%`} value={`− ${currency(b.tdsAmount)}`} tone="minus" />}
          {Number(b.retentionAmount) > 0 && (
            <Row label={`Retention @ ${b.retentionPercentage}%`} value={`− ${currency(b.retentionAmount)}`} tone="minus" />
          )}
          <div className="border-t my-2" />
          <Row label="Net payable" value={currency(b.netAmount)} bold big />
          <Row label="Paid" value={currency(b.paidAmount)} />
          <Row label="Balance" value={currency(b.balanceAmount)} bold tone={Number(b.balanceAmount) > 0 ? "minus" : undefined} />

          {b.measurementNotes && (
            <div className="mt-4 pt-4 border-t">
              <div className="text-xs font-semibold uppercase text-slate-400">Measurement notes</div>
              <p className="text-sm text-slate-600 mt-1">{b.measurementNotes}</p>
            </div>
          )}
          {b.remarks && (
            <div className="mt-3">
              <div className="text-xs font-semibold uppercase text-slate-400">Remarks</div>
              <p className="text-sm text-slate-600 mt-1">{b.remarks}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold, big, tone }: {
  label: string; value: string; bold?: boolean; big?: boolean; tone?: "minus";
}) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className={bold ? "font-semibold text-slate-700" : "text-slate-500"}>{label}</span>
      <span className={`${bold ? "font-black" : ""} ${big ? "text-lg" : ""} ${tone === "minus" ? "text-rose-600" : "text-slate-900"}`}>
        {value}
      </span>
    </div>
  );
}

function ApproveButton({ billId, netAmount, stage, onDone }: {
  billId: number; netAmount: number; stage?: string | null; onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState("");
  const [approvedAmount, setApprovedAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true); setError(null);
    try {
      await contractorApi.approveBill(billId, comments || undefined,
        approvedAmount ? Number(approvedAmount) : undefined);
      setOpen(false); onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not approve the bill.");
    } finally { setSaving(false); }
  };

  return (
    <>
      <Button onClick={() => { setError(null); setOpen(true); }}>
        <CheckCircle2 className="w-4 h-4 mr-1" /> Approve as {STAGE_LABEL[stage ?? ""] ?? "reviewer"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Approve bill</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Comments</Label>
              <Input value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Measurements verified on site" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Certify a lower amount (optional)</Label>
              <Input type="number" value={approvedAmount} onChange={(e) => setApprovedAmount(e.target.value)}
                     placeholder={String(netAmount)} />
              <p className="text-[11px] text-muted-foreground">
                Leave blank to approve the claimed {currency(netAmount)}. A lower figure is booked as an extra
                deduction, so the original claim stays on record.
              </p>
            </div>
            {error && <div className="text-sm bg-rose-50 border border-rose-200 text-rose-700 rounded-md p-3">{error}</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Approving…" : "Approve"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PayButton({ billId, contractorId, balance, onDone }: {
  billId: number; contractorId: number; balance: number; onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ amount: String(balance), paymentMode: "BANK_TRANSFER" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true); setError(null);
    try {
      await contractorApi.recordPayment({
        contractorId, billId,
        payment: {
          amount: Number(form.amount),
          paymentType: "RUNNING_BILL",
          paymentMode: form.paymentMode,
          referenceNumber: form.referenceNumber,
          paymentDate: form.paymentDate || undefined,
          remarks: form.remarks,
        },
      });
      setOpen(false); onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record the payment.");
    } finally { setSaving(false); }
  };

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <>
      <Button onClick={() => { setError(null); setOpen(true); }}>
        <Wallet className="w-4 h-4 mr-1" /> Record payment
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Amount (₹)</Label>
                <Input type="number" value={form.amount} onChange={(e) => set("amount", e.target.value)} />
                <p className="text-[11px] text-muted-foreground">Outstanding {currency(balance)}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Mode</Label>
                <select className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                        value={form.paymentMode} onChange={(e) => set("paymentMode", e.target.value)}>
                  {["BANK_TRANSFER", "NEFT", "RTGS", "UPI", "CHEQUE", "CASH"].map((m) =>
                    <option key={m} value={m}>{m.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Reference</Label>
                <Input onChange={(e) => set("referenceNumber", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Date</Label>
                <Input type="date" onChange={(e) => set("paymentDate", e.target.value)} />
              </div>
            </div>
            {error && <div className="text-sm bg-rose-50 border border-rose-200 text-rose-700 rounded-md p-3">{error}</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Pay"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

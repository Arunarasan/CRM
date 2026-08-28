import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { financeApi } from "@/api/financeApi";
import type { Invoice, InvoiceItem, CustomerPayment } from "@/types/finance";
import { PAYMENT_METHODS } from "@/types/finance";
import { useGoBack } from "@/hooks/useGoBack";
import { apiError } from "@/lib/apiError";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  currency, currencyFull, INVOICE_STATUS_TONE, INVOICE_STATUS_LABEL, stageLabel,
} from "./helpers";
import { ArrowLeft, CheckCircle2, Send, XCircle, IndianRupee, RotateCcw } from "lucide-react";

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const invId = Number(id);
  const goBack = useGoBack("/finance/invoices");

  const [inv, setInv] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [payments, setPayments] = useState<CustomerPayment[]>([]);
  const [busy, setBusy] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<string>("BANK_TRANSFER");
  const [payRef, setPayRef] = useState("");

  const load = useCallback(() => {
    financeApi.getInvoice(invId).then((i) => { setInv(i); setPayAmount(String(i.balanceDue ?? "")); })
      .catch(() => setNotFound(true));
    financeApi.getInvoiceItems(invId).then(setItems).catch(console.error);
    financeApi.getInvoicePayments(invId).then(setPayments).catch(() => setPayments([]));
  }, [invId]);

  useEffect(() => { load(); }, [load]);

  const run = async (fn: () => Promise<Invoice>, successMsg?: string) => {
    setBusy(true);
    try {
      const updated = await fn(); setInv(updated); load();
      if (successMsg) toast.success(successMsg);
    } catch (e) {
      toast.error(apiError(e, "Action failed."));
    } finally { setBusy(false); }
  };

  const recordPayment = async () => {
    const amount = Number(payAmount);
    if (!amount || amount <= 0) { toast.error("Enter a payment amount."); return; }
    await run(() => financeApi.markInvoicePaid(invId, [{ method: payMethod, amount, referenceNumber: payRef || undefined }]), "Payment recorded.");
    setPayOpen(false); setPayRef("");
  };

  if (notFound) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <Button variant="ghost" onClick={goBack}><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3">Invoice not found.</div>
      </div>
    );
  }
  if (!inv) return <div className="p-8 text-slate-500">Loading invoice…</div>;

  const canIssue = inv.status === "DRAFT";
  const canSend = inv.status === "GENERATED";
  const canPay = ["GENERATED", "SENT", "PARTIAL", "OVERDUE"].includes(inv.status) && (inv.balanceDue ?? 0) > 0;
  const canCancel = !["CANCELLED", "PAID"].includes(inv.status);
  const canUnpay = (inv.amountPaid ?? 0) > 0 && inv.status !== "CANCELLED";

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goBack}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{inv.invoiceNumber}</h1>
              <Badge className={INVOICE_STATUS_TONE[inv.status]}>{INVOICE_STATUS_LABEL[inv.status]}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {inv.customer?.name}{inv.project?.projectName ? ` · ${inv.project.projectName}` : ""} · {inv.invoiceType}
              {inv.paymentStage ? ` · ${stageLabel(inv.paymentStage)}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canIssue && <Button size="sm" disabled={busy} onClick={() => run(() => financeApi.issueInvoice(invId), "Invoice issued.")}><CheckCircle2 className="w-4 h-4 mr-1" /> Issue</Button>}
          {canSend && <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => financeApi.sendInvoice(invId), "Marked as sent.")}><Send className="w-4 h-4 mr-1" /> Mark Sent</Button>}
          {canPay && <Button size="sm" disabled={busy} onClick={() => setPayOpen((o) => !o)}><IndianRupee className="w-4 h-4 mr-1" /> Record Payment</Button>}
          {canUnpay && <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => financeApi.markInvoiceUnpaid(invId), "Payment reversed.")}><RotateCcw className="w-4 h-4 mr-1" /> Mark Unpaid</Button>}
          {canCancel && <Button size="sm" variant="destructive" disabled={busy} onClick={() => { if (confirm(`Cancel ${inv.invoiceNumber}? This cannot be undone.`)) run(() => financeApi.cancelInvoice(invId, "Cancelled from invoice view"), "Invoice cancelled."); }}><XCircle className="w-4 h-4 mr-1" /> Cancel</Button>}
        </div>
      </div>

      {payOpen && canPay && (
        <div className="bg-white border rounded-2xl shadow-sm p-5">
          <h2 className="font-semibold text-slate-800 mb-3">Record a payment</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <label className="text-sm">
              <span className="font-semibold text-slate-700">Amount ₹</span>
              <Input type="number" min={0} className="mt-1" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
            </label>
            <label className="text-sm">
              <span className="font-semibold text-slate-700">Method</span>
              <select className="mt-1 w-full h-10 rounded-md border border-input px-3 text-sm" value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}>
                {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.replaceAll("_", " ")}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="font-semibold text-slate-700">Reference #</span>
              <Input className="mt-1" value={payRef} onChange={(e) => setPayRef(e.target.value)} />
            </label>
            <Button disabled={busy} onClick={recordPayment}>{busy ? "Saving…" : "Confirm Payment"}</Button>
          </div>
        </div>
      )}

      {/* Meta */}
      <div className="bg-white border rounded-2xl shadow-sm p-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <Meta label="Invoice Date" value={inv.date} />
        <Meta label="Due Date" value={inv.dueDate || "—"} />
        <Meta label="GST Type" value={inv.gstType === "IGST" ? "IGST" : "CGST + SGST"} />
        <Meta label="Place of Supply" value={inv.placeOfSupply || "—"} />
      </div>

      {/* Items */}
      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">HSN</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">Rate</th>
                <th className="px-4 py-3 text-right">GST %</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((it, i) => (
                <tr key={it.id ?? i}>
                  <td className="px-4 py-3 font-medium text-slate-800">{it.description}</td>
                  <td className="px-4 py-3 text-slate-500">{it.hsnCode || "—"}</td>
                  <td className="px-4 py-3 text-right">{it.quantity} {it.unit || ""}</td>
                  <td className="px-4 py-3 text-right">{currencyFull(it.unitPrice)}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{it.gstRate ?? 0}%</td>
                  <td className="px-4 py-3 text-right font-semibold">{currencyFull(it.totalPrice)}</td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No line items.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="border-t p-5 flex justify-end">
          <div className="w-full max-w-xs space-y-1 text-sm">
            <Row label="Subtotal" value={currencyFull(inv.subTotal)} />
            {!!inv.discountAmount && <Row label="Discount" value={`− ${currencyFull(inv.discountAmount)}`} />}
            {inv.gstType === "IGST"
              ? <Row label="IGST" value={currencyFull(inv.igstAmount)} />
              : (<><Row label="CGST" value={currencyFull(inv.cgstAmount)} /><Row label="SGST" value={currencyFull(inv.sgstAmount)} /></>)}
            {!!inv.roundOff && <Row label="Round Off" value={currencyFull(inv.roundOff)} />}
            <div className="flex justify-between border-t pt-2 mt-1 text-base font-bold text-slate-900">
              <span>Total</span><span>{currencyFull(inv.totalAmount)}</span>
            </div>
            <Row label="Paid" value={currencyFull(inv.amountPaid)} />
            {!!inv.retentionAmount && <Row label="Retention held" value={currencyFull(inv.retentionAmount)} />}
            <div className="flex justify-between text-amber-700 font-semibold">
              <span>Balance Due</span><span>{currencyFull(inv.balanceDue)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payments */}
      <div className="bg-white border rounded-2xl shadow-sm p-5">
        <h2 className="font-semibold text-slate-800 mb-3">Payments</h2>
        {payments.length === 0 ? (
          <p className="text-sm text-slate-500">No payments recorded yet.</p>
        ) : (
          <ul className="divide-y text-sm">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2">
                <div>
                  <span className="font-medium text-slate-700">{p.paymentNumber}</span>
                  <span className="text-slate-500"> · {p.paymentDate} · {p.paymentMethod?.replaceAll("_", " ")}</span>
                  {p.referenceNumber && <span className="text-slate-400"> · {p.referenceNumber}</span>}
                </div>
                <span className="font-semibold">{currency(p.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {(inv.notes || inv.terms) && (
        <div className="bg-white border rounded-2xl shadow-sm p-5 text-sm space-y-3">
          {inv.notes && <div><div className="text-xs uppercase text-slate-500 mb-1">Notes</div><p className="text-slate-700">{inv.notes}</p></div>}
          {inv.terms && <div><div className="text-xs uppercase text-slate-500 mb-1">Terms</div><p className="text-slate-700">{inv.terms}</p></div>}
        </div>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div className="text-xs uppercase text-slate-500">{label}</div>
      <div className="font-semibold text-slate-800 mt-0.5">{value || "—"}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-slate-500">{label}</span><span className="font-semibold">{value}</span></div>;
}

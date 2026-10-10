import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { financeApi } from "@/api/financeApi";
import type { Invoice, InvoiceItem, CustomerPayment } from "@/types/finance";
import { PAYMENT_METHODS } from "@/types/finance";
import { useGoBack } from "@/hooks/useGoBack";
import { apiError } from "@/lib/apiError";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { currency, currencyFull, stageLabel } from "./helpers";
import {
  InvoiceStatusBadge, PaidBar, dueInfo, fmtDay, invoiceTypeLabel, waReminderHref,
} from "@/components/billing/billing-ui";
import { printInvoice } from "../projectFinance/printInvoice";
import { printReceipt } from "./printReceipt";
import { fetchCompanyProfile, type CompanyProfile } from "@/lib/companyProfile";
import InvoiceBundles from "@/components/bundles/InvoiceBundles";
import { resolveFileUrl } from "@/lib/uploadFile";
import { ArrowLeft, CheckCircle2, Send, XCircle, IndianRupee, RotateCcw, Printer, ChevronDown, MoreHorizontal, MessageCircle, Phone, MapPin, User } from "lucide-react";

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const invId = Number(id);
  const goBack = useGoBack("/billing/invoices");
  const [searchParams, setSearchParams] = useSearchParams();
  const autoPrinted = useRef(false);
  const [company, setCompany] = useState<CompanyProfile | undefined>(undefined);

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
  useEffect(() => { fetchCompanyProfile().then(setCompany).catch(() => {}); }, []);
  // ?pay=1 (from the invoice list's "Record payment") opens the payment form straight away.
  useEffect(() => {
    if (searchParams.get("pay") === "1" && inv) {
      setPayOpen(true);
      setSearchParams((prev) => { const n = new URLSearchParams(prev); n.delete("pay"); return n; }, { replace: true });
    }
  }, [searchParams, inv, setSearchParams]);

  const doPrint = useCallback((fmt: "receipt" | "invoice") => {
    if (!inv) return;
    if (fmt === "receipt") printReceipt(inv, items, company);
    else printInvoice(inv, items, inv.project ?? undefined, company);
  }, [inv, items, company]);

  // Auto-print once after a counter sale (?print=receipt|invoice), then strip the flag.
  // Waits for the company profile so the first bill already carries the real shop details.
  useEffect(() => {
    const fmt = searchParams.get("print");
    if (!fmt || autoPrinted.current || !inv || items.length === 0 || !company) return;
    autoPrinted.current = true;
    doPrint(fmt === "invoice" ? "invoice" : "receipt");
    const next = new URLSearchParams(searchParams);
    next.delete("print");
    setSearchParams(next, { replace: true });
  }, [searchParams, inv, items, company, doPrint, setSearchParams]);

  const stripStickers = useCallback(() => {
    setSearchParams((prev) => { const next = new URLSearchParams(prev); next.delete("stickers"); return next; }, { replace: true });
  }, [setSearchParams]);

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

  const due = dueInfo(inv);
  const wa = canPay ? waReminderHref(inv, company?.name || "JB Decor") : null;
  const cust: any = inv.customer || {};
  const custPhone: string | undefined = cust.phone || cust.whatsappNumber;
  const custAddress = [cust.billingAddress || cust.address || cust.siteAddress, cust.city, cust.pincode].filter(Boolean).join(", ");
  const cancel = () => {
    if (confirm(`Cancel ${inv.invoiceNumber}? This cannot be undone.`)) run(() => financeApi.cancelInvoice(invId, "Cancelled from invoice view"), "Invoice cancelled.");
  };
  // One main button for where the invoice is: issue a draft → mark it sent → collect the money.
  const primary = canIssue
    ? { label: "Issue invoice", icon: CheckCircle2, onClick: () => run(() => financeApi.issueInvoice(invId), "Invoice issued.") }
    : canSend
      ? { label: "Mark sent", icon: Send, onClick: () => run(() => financeApi.sendInvoice(invId), "Marked as sent.") }
      : canPay
        ? { label: "Record payment", icon: IndianRupee, onClick: () => setPayOpen((o) => !o) }
        : null;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={goBack} aria-label="Back"><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{inv.invoiceNumber}</h1>
              <InvoiceStatusBadge status={inv.status} size="md" />
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {invoiceTypeLabel(inv.invoiceType)}{inv.paymentStage ? ` · ${stageLabel(inv.paymentStage)}` : ""} · {fmtDay(inv.date)}
              {inv.project?.id && <> · <Link to={`/projects/${inv.project.id}`} className="font-semibold text-emerald-700 hover:underline">{inv.project.projectName}</Link></>}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline"><Printer className="w-4 h-4 mr-1" /> Print <ChevronDown className="w-3.5 h-3.5 ml-1" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => doPrint("invoice")}>Tax Invoice (A4)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => doPrint("receipt")}>POS Receipt (80mm)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {canSend && canPay && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setPayOpen((o) => !o)}><IndianRupee className="w-4 h-4 mr-1" /> Record payment</Button>
          )}
          {primary && (
            <Button size="sm" disabled={busy} onClick={primary.onClick} className="active:scale-[0.98]"><primary.icon className="w-4 h-4 mr-1" /> {primary.label}</Button>
          )}
          {(canUnpay || canCancel || wa) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" aria-label="More actions"><MoreHorizontal className="w-4 h-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {wa && <DropdownMenuItem onClick={() => window.open(wa, "_blank", "noopener")}><MessageCircle className="mr-2 h-4 w-4" /> WhatsApp reminder</DropdownMenuItem>}
                {canUnpay && <DropdownMenuItem onClick={() => run(() => financeApi.markInvoiceUnpaid(invId), "Payment reversed.")}><RotateCcw className="mr-2 h-4 w-4" /> Mark unpaid</DropdownMenuItem>}
                {canCancel && <DropdownMenuItem onClick={cancel} className="text-red-600 focus:text-red-700"><XCircle className="mr-2 h-4 w-4" /> Cancel invoice</DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Money summary */}
      <div className="grid grid-cols-2 divide-slate-100 overflow-hidden rounded-2xl border bg-white shadow-sm md:grid-cols-4 md:divide-x">
        <Figure label="Invoice total" value={currencyFull(inv.totalAmount)} tone="text-slate-900" />
        <Figure label="Paid" value={currencyFull(inv.amountPaid)} tone="text-emerald-700">
          <PaidBar total={inv.totalAmount} paid={inv.amountPaid} className="mt-1.5" />
        </Figure>
        <Figure label="Balance due" value={currencyFull(inv.balanceDue)} tone={Number(inv.balanceDue) > 0 ? "text-rose-600" : "text-slate-400"} />
        <Figure label="Due date" value={fmtDay(inv.dueDate)} tone="text-slate-900">
          {due && <div className={`text-xs ${due.tone}`}>{due.text}</div>}
        </Figure>
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

      {/* Customer + invoice details */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400"><User className="h-3.5 w-3.5" /> Bill to</div>
          <div className="text-base font-bold text-slate-900">
            {cust.id ? <Link to={`/customers/${cust.id}`} className="hover:underline">{cust.name}</Link> : cust.name}
          </div>
          {cust.gstNumber && <div className="text-xs text-slate-500">GSTIN {cust.gstNumber}</div>}
          {custAddress && <div className="mt-1.5 flex items-start gap-1.5 text-sm text-slate-600"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />{custAddress}</div>}
          {custPhone && (
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={`tel:${String(custPhone).replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-[0.98]">
                <Phone className="h-3.5 w-3.5" /> {custPhone}
              </a>
              {wa && (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 active:scale-[0.98]">
                  <MessageCircle className="h-3.5 w-3.5" /> Send reminder
                </a>
              )}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4 rounded-2xl border bg-white p-5 text-sm shadow-sm">
          <Meta label="Invoice date" value={fmtDay(inv.date)} />
          <Meta label="Type" value={invoiceTypeLabel(inv.invoiceType)} />
          <Meta label="GST" value={inv.gstType === "IGST" ? "IGST (other state)" : "CGST + SGST"} />
          <Meta label="Prices" value={inv.taxInclusive ? "GST included" : "+ GST extra"} />
          <Meta label="Place of supply" value={inv.placeOfSupply || "—"} />
          {!!inv.retentionPercent && <Meta label="Retention" value={`${inv.retentionPercent}%`} />}
        </div>
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
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      {it.imageUrl && (
                        <a href={resolveFileUrl(it.imageUrl)} target="_blank" rel="noreferrer" className="shrink-0">
                          <img src={resolveFileUrl(it.imageUrl)} alt="" className="h-10 w-10 rounded-md border object-cover" />
                        </a>
                      )}
                      <div className="min-w-0">
                        <div className="font-medium text-slate-800">{it.description}</div>
                        {it.notes && <div className="text-xs text-slate-500 whitespace-pre-wrap">{it.notes}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{it.hsnCode || "—"}</td>
                  <td className="px-4 py-3 text-right">{it.quantity} {it.unit || ""}</td>
                  <td className="px-4 py-3 text-right">{currencyFull(inv.taxInclusive && it.unitPriceIncl != null ? it.unitPriceIncl : it.unitPrice)}</td>
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
            {inv.taxInclusive && <p className="pb-1 text-xs font-semibold text-emerald-700">Prices include GST</p>}
            <Row label={inv.taxInclusive ? "Subtotal (before GST)" : "Subtotal"} value={currencyFull(inv.subTotal)} />
            {!!inv.discountAmount && <Row label={inv.taxInclusive ? "Discount (before GST)" : "Discount"} value={`− ${currencyFull(inv.discountAmount)}`} />}
            {inv.gstType === "IGST"
              ? <Row label={inv.taxInclusive ? "IGST (included)" : "IGST"} value={currencyFull(inv.igstAmount)} />
              : (<><Row label={inv.taxInclusive ? "CGST (included)" : "CGST"} value={currencyFull(inv.cgstAmount)} /><Row label={inv.taxInclusive ? "SGST (included)" : "SGST"} value={currencyFull(inv.sgstAmount)} /></>)}
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

      <InvoiceBundles invoiceId={inv.id} items={items} cancelled={inv.status === "CANCELLED"} company={company} onChanged={load} paidKey={String(inv.amountPaid ?? "")}
        autoStickers={searchParams.get("stickers") === "1"} onAutoDone={stripStickers} />

      {/* Payments */}
      <div className="bg-white border rounded-2xl shadow-sm p-5">
        <h2 className="font-semibold text-slate-800 mb-3">Payments</h2>
        {payments.length === 0 ? (
          <p className="text-sm text-slate-500">
            No payments recorded yet.{canPay && <> <button onClick={() => setPayOpen(true)} className="font-semibold text-emerald-700 hover:underline">Record one</button></>}
          </p>
        ) : (
          <ul className="divide-y text-sm">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2">
                <div>
                  <span className="font-medium text-slate-700">{p.paymentNumber}</span>
                  <span className="text-slate-500"> · {fmtDay(p.paymentDate)} · {p.paymentMethod?.replaceAll("_", " ")}</span>
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

function Figure({ label, value, tone, children }: { label: string; value: string; tone: string; children?: React.ReactNode }) {
  return (
    <div className="px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-1 text-xl font-black tabular-nums tracking-tight ${tone}`}>{value}</div>
      {children}
    </div>
  );
}

function Meta({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="font-semibold text-slate-800 mt-0.5">{value || "—"}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-slate-500">{label}</span><span className="font-semibold">{value}</span></div>;
}

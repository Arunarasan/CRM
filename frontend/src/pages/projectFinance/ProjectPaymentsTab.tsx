import { useEffect, useMemo, useState } from "react";
import GstModeToggle from "@/components/ui/gst-mode-toggle";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import {
  Plus, Trash2, Pencil, FileText, Loader2, IndianRupee, AlertCircle,
  CheckCircle2, RotateCcw, Printer, Ban, Clock, User as UserIcon, MessageCircle,
} from "lucide-react";
import { financeApi } from "@/api/financeApi";
import { smartAssignmentApi, type RosterRow } from "@/api/smartAssignmentApi";
import SearchableSelect from "@/components/ui/searchable-select";
import type { Invoice, InvoiceType, CustomerPayment } from "@/types/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/toast";
import DeleteWithRemarkDialog from "@/components/DeleteWithRemarkDialog";
import { openInvoicePdf, shareInvoiceWhatsApp } from "./printInvoice";
import { MoneySection } from "./MoneySection";
import { Skeleton } from "@/components/ui/skeleton";
import ProjectProfitPanel from "./ProjectProfitPanel";
import { quotationApi } from "@/api/quotationApi";
import { quoteCharges } from "@/types/quotation";
import { readPricing } from "@/pages/quotations/quotationPricing";

const inr = (n?: number | null) =>
  "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);

type InvoiceFilter = "ALL" | "UNPAID" | "PAID" | "DRAFT";
const INVOICE_FILTERS: [InvoiceFilter, string][] = [["ALL", "All"], ["UNPAID", "Unpaid"], ["PAID", "Paid"], ["DRAFT", "Draft"]];
const invoiceBucket = (st: string): InvoiceFilter | null =>
  st === "PAID" ? "PAID" : st === "DRAFT" ? "DRAFT" : st === "CANCELLED" ? null : "UNPAID";

const INVOICE_TYPES: InvoiceType[] = ["ADVANCE", "PROGRESS", "FINAL", "PROFORMA"];
const METHODS = ["CASH", "UPI", "CARD", "BANK_TRANSFER", "CHEQUE", "NEFT", "OTHER"];

/** Map the invoice's real status to a simple Paid / Unpaid / Partial marking. */
function paidLabel(status: string): { text: string; cls: string } {
  if (status === "PAID") return { text: "Paid", cls: "bg-emerald-100 text-emerald-700" };
  if (status === "PARTIAL") return { text: "Partial", cls: "bg-amber-100 text-amber-700" };
  if (status === "CANCELLED") return { text: "Cancelled", cls: "bg-slate-100 text-slate-400 line-through" };
  if (status === "DRAFT") return { text: "Draft", cls: "bg-slate-100 text-slate-500" };
  return { text: "Unpaid", cls: "bg-red-100 text-red-600" };
}

interface LineItem { description: string; quantity: number; unitPrice: number; }

export type CommercialMode = "all" | "billing" | "payments" | "profit";

/**
 * Project money (the shared stats row lives on the page):
 *  - all:      one compact screen — invoices and expenses on the left; profit and payments received
 *              on the right (stacks on narrow screens)
 *  - billing:  invoices (maker, issue, paid/unpaid, print)
 *  - payments: money received, as a timeline, with pending field collections to approve
 *  - profit:   cash vs accrual profit + project expenses
 * `focus` scrolls the combined screen to the payments or expenses block (old deep links).
 * Reuses /api/finance.
 */
export default function ProjectPaymentsTab({ project, onChanged, mode = "billing", focus }: { project: any; onChanged?: () => void; mode?: CommercialMode; focus?: "payments" | "expenses" }) {
  const { hasAuthority, hasAnyAuthority } = useAuth();
  const canRead = hasAuthority("FINANCE_READ");
  const canWrite = hasAuthority("FINANCE_WRITE");
  const canCollect = hasAnyAuthority(["FINANCE_WRITE", "FINANCE_COLLECT"]);

  const navigate = useNavigate();
  const projectId = project?.id;
  const customerId = project?.customer?.id;

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [tick, setTick] = useState(0); // bumps so the profit panels re-fetch after invoice changes

  const load = () => {
    if (!projectId) return;
    setLoading(true);
    financeApi.getInvoices({ projectId, size: 100 })
      .then((inv) => { setInvoices(inv.content || []); setDenied(false); })
      .catch((err) => { if (err?.response?.status === 403) setDenied(true); })
      .finally(() => setLoading(false));
  };

  useEffect(load, [projectId]);

  // Reload invoices AND signal the billing tracker to refresh (payment % moved).
  const reloadAll = () => { load(); setTick((t) => t + 1); };

  useEffect(() => {
    if (mode !== "all" || !focus) return;
    const t = setTimeout(() => document.getElementById(`money-${focus}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 350);
    return () => clearTimeout(t);
  }, [mode, focus]);

  const [invFilter, setInvFilter] = useState<InvoiceFilter>("ALL");
  const invCounts = useMemo(() => {
    const c: Record<string, number> = { ALL: invoices.length };
    invoices.forEach((i) => { const b = invoiceBucket(i.status); if (b) c[b] = (c[b] || 0) + 1; });
    return c;
  }, [invoices]);
  const shownInvoices = invFilter === "ALL" ? invoices : invoices.filter((i) => invoiceBucket(i.status) === invFilter);

  // WhatsApp hand-off: opens a chat with the customer and a ready-to-send invoice message.
  const customerPhone: string | undefined = project?.customer?.whatsappNumber || project?.customer?.phone;
  const sendWhatsApp = (i: Invoice) => {
    let d = String(customerPhone || "").replace(/\D/g, "");
    if (d.length === 10) d = `91${d}`;
    const bal = Number(i.balanceDue || 0);
    const msg = `Dear ${project?.customer?.name || "Customer"},\n\nInvoice ${i.invoiceNumber} for ${inr(i.totalAmount)}`
      + (bal > 0 ? ` — balance due ${inr(bal)}` : " — fully paid")
      + (i.dueDate && bal > 0 ? ` (due ${format(new Date(i.dueDate), "dd MMM yyyy")})` : "")
      + `.\n\nThank you,\nJB Decor`;
    shareInvoiceWhatsApp(async () => {
      const [invoice, items] = await Promise.all([financeApi.getInvoice(i.id), financeApi.getInvoiceItems(i.id)]);
      return { invoice, items, project };
    }, msg, d)
      .then((note) => toast.success(note))
      .catch(() => toast.error("Could not prepare the invoice PDF."));
  };

  const [makerOpen, setMakerOpen] = useState(false);
  const [payFor, setPayFor] = useState<Invoice | null>(null);
  const [editInv, setEditInv] = useState<Invoice | null>(null);

  if (!canRead) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-white p-6 text-slate-500">
        <AlertCircle className="h-5 w-5" /> You don't have access to project billing.
      </div>
    );
  }

  const markUnpaid = (inv: Invoice) => {
    if (!confirm(`Mark invoice ${inv.invoiceNumber} as unpaid? This voids its recorded payments.`)) return;
    setBusyId(inv.id);
    financeApi.markInvoiceUnpaid(inv.id)
      .then(() => { reloadAll(); onChanged?.(); })
      .catch((e) => toast.error(e?.response?.data?.message || "Failed to mark unpaid"))
      .finally(() => setBusyId(null));
  };

  const issue = (id: number) => {
    setBusyId(id);
    financeApi.issueInvoice(id)
      .then(() => { reloadAll(); onChanged?.(); toast.success("Invoice issued"); })
      .catch((e) => toast.error(e?.response?.data?.message || "Failed to issue invoice"))
      .finally(() => setBusyId(null));
  };

  // Same PDF design as the quotation; the tab opens on the click, the PDF loads into it.
  const doPrint = (inv: Invoice) =>
    openInvoicePdf(async () => {
      const [invoice, items] = await Promise.all([financeApi.getInvoice(inv.id), financeApi.getInvoiceItems(inv.id)]);
      return { invoice, items, project };
    }).catch(() => toast.error("Could not open the invoice for printing."));

  if (mode === "payments") {
    return <PaymentsSection projectId={projectId} customerId={customerId} canWrite={canWrite} canCollect={canCollect} onChanged={() => { reloadAll(); onChanged?.(); }} />;
  }
  if (mode === "profit") {
    return <ProjectProfitPanel project={project} refreshSignal={tick} />;
  }

  const compact = mode === "all";
  const moneyChanged = () => { reloadAll(); onChanged?.(); };

  return (
    <div className={compact ? "grid grid-cols-1 @5xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] gap-3 items-start" : "space-y-3"}>
      <div className="space-y-3 min-w-0">
      {loading ? (
        <MoneySection icon={FileText} title="Invoices">
          <div className="space-y-2 p-4">{[0, 1, 2].map((k) => <Skeleton key={k} className="h-12 w-full" />)}</div>
        </MoneySection>
      ) : denied ? (
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 text-sm text-slate-500">Billing data is restricted for your role.</div>
      ) : (
        <MoneySection
          icon={FileText}
          title="Invoices"
          count={invoices.length}
          actions={<>
            {invoices.length > 0 && (
              <div role="tablist" aria-label="Filter invoices" className="flex gap-0.5 rounded-lg bg-slate-100 p-0.5">
                {INVOICE_FILTERS.map(([f, label]) => (
                  <button key={f} type="button" role="tab" aria-selected={invFilter === f} onClick={() => setInvFilter(f)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${invFilter === f ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                    {label} <span className="tabular-nums text-slate-400">{invCounts[f] || 0}</span>
                  </button>
                ))}
              </div>
            )}
            {canWrite && customerId && (
              <Button size="sm" variant="forest" onClick={() => navigate(`/billing/invoices/new?projectId=${projectId}${customerId ? `&customerId=${customerId}` : ""}`)} className="active:scale-[0.98]"><Plus /> New invoice</Button>
            )}
          </>}
        >
          {!customerId && (
            <p className="border-b border-amber-200/70 bg-amber-50/70 px-4 py-2.5 text-sm text-amber-800">This project has no linked customer, so invoices can't be raised yet.</p>
          )}
          {invoices.length === 0 ? (
            <div className="flex flex-col items-start gap-1 px-4 py-8 sm:items-center sm:text-center">
              <p className="text-sm font-semibold text-slate-800">No invoices yet</p>
              <p className="max-w-[48ch] text-sm text-slate-500">Raise an invoice with New invoice when a payment is due.</p>
            </div>
          ) : shownInvoices.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">No invoices in this filter.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {shownInvoices.map((i) => {
                const badge = paidLabel(i.status);
                const busy = busyId === i.id;
                const total = Number(i.totalAmount || 0);
                const paid = Number(i.amountPaid || 0);
                const pct = total ? Math.min(100, Math.round((paid / total) * 100)) : 0;
                const live = i.status !== "CANCELLED" && i.status !== "DRAFT";
                const overdue = live && i.dueDate && i.status !== "PAID"
                  && new Date(i.dueDate).getTime() < new Date(new Date().toDateString()).getTime();
                return (
                  <li key={i.id} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-slate-50/70 @xl:grid-cols-[minmax(0,1fr)_10rem_auto] ${i.status === "CANCELLED" ? "opacity-60" : ""}`}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-slate-900">{i.invoiceNumber}</span>
                        <span className={`shrink-0 rounded-full px-1.5 py-px text-[11px] font-semibold ${overdue ? "bg-rose-100 text-rose-700" : badge.cls}`}>{overdue ? "Overdue" : badge.text}</span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        <span className="capitalize">{String(i.invoiceType || "").toLowerCase()}</span> · {i.date ? format(new Date(i.date), "dd MMM yyyy") : "—"}
                        {i.dueDate && live && i.status !== "PAID" && <span className={overdue ? "font-semibold text-rose-600" : ""}> · due {format(new Date(i.dueDate), "dd MMM")}</span>}
                      </p>
                    </div>

                    <div className="text-right @xl:text-left">
                      <div className="flex items-baseline justify-end gap-2 @xl:justify-between">
                        <span className="text-sm font-semibold tabular-nums text-slate-900">{inr(total)}</span>
                        {live && Number(i.balanceDue || 0) > 0 && <span className="hidden text-[11px] font-medium tabular-nums text-rose-600 @xl:inline">{inr(i.balanceDue)} due</span>}
                      </div>
                      {live && (
                        <div className="mt-1 hidden h-1 overflow-hidden rounded-full bg-slate-100 @xl:block" title={`${inr(paid)} received · ${pct}%`}>
                          <div className="h-full rounded-full bg-emerald-600" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </div>

                    <div className="col-span-2 flex items-center justify-end gap-1 @xl:col-span-1">
                      {busy && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                      {canWrite && i.status === "DRAFT" && !busy && <ActionBtn onClick={() => setEditInv(i)} title="Edit this draft invoice"><Pencil className="h-3.5 w-3.5" /> Edit</ActionBtn>}
                      {canWrite && i.status === "DRAFT" && !busy && <ActionBtn onClick={() => issue(i.id)} title="Issue this invoice">Issue</ActionBtn>}
                      {canCollect && live && i.status !== "PAID" && !busy && (
                        <ActionBtn onClick={() => setPayFor(i)} tone="green" title="Record payment against this invoice"><CheckCircle2 className="h-3.5 w-3.5" /> Mark paid</ActionBtn>
                      )}
                      {canWrite && i.status === "PAID" && !busy && (
                        <ActionBtn onClick={() => markUnpaid(i)} tone="red" title="Mark unpaid"><RotateCcw className="h-3.5 w-3.5" /></ActionBtn>
                      )}
                      {live && customerPhone && (
                        <button type="button" onClick={() => sendWhatsApp(i)} title="Send PDF + message on WhatsApp" aria-label={`Send ${i.invoiceNumber} on WhatsApp`}
                          className="inline-flex items-center rounded-md border border-slate-200 px-1.5 py-1 text-slate-600 hover:bg-slate-50"><MessageCircle className="h-3.5 w-3.5" /></button>
                      )}
                      <ActionBtn onClick={() => doPrint(i)} title={`Print ${i.invoiceNumber}`}><Printer className="h-3.5 w-3.5" /></ActionBtn>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </MoneySection>
      )}

      {/* Expenses sit under the invoices — money in on top, money out below */}
      {compact && (
        <div id="money-expenses" className="scroll-mt-40">
          <ProjectProfitPanel project={project} refreshSignal={tick} part="expenses" compact onChanged={moneyChanged} />
        </div>
      )}
      </div>

      {compact && (
        <div className="space-y-3 min-w-0">
          <ProjectProfitPanel project={project} refreshSignal={tick} part="profit" compact />
          <div id="money-payments" className="scroll-mt-40">
            <PaymentsSection projectId={projectId} customerId={customerId} canWrite={canWrite} canCollect={canCollect} onChanged={moneyChanged} compact />
          </div>
        </div>
      )}

      {(makerOpen || editInv) && customerId && (
        <InvoiceMaker
          key={editInv?.id ?? "new"}
          project={project}
          invoice={editInv}
          onClose={() => { setMakerOpen(false); setEditInv(null); }}
          onSaved={() => { setMakerOpen(false); setEditInv(null); reloadAll(); onChanged?.(); }}
        />
      )}
      {payFor && (
        <MarkPaidDialog
          invoice={payFor}
          onClose={() => setPayFor(null)}
          onSaved={() => { setPayFor(null); reloadAll(); onChanged?.(); }}
        />
      )}
    </div>
  );
}

function ActionBtn({ children, onClick, tone, title }: { children: React.ReactNode; onClick: () => void; tone?: "green" | "red"; title?: string }) {
  const cls = tone === "green"
    ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
    : tone === "red"
      ? "border-red-200 text-red-600 hover:bg-red-50"
      : "border-slate-200 text-slate-600 hover:bg-slate-50";
  return (
    <button type="button" title={title} onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors ${cls}`}>
      {children}
    </button>
  );
}

const PAY_STATUS: Record<string, { text: string; cls: string; dot: string; icon: React.ReactNode }> = {
  CONFIRMED: { text: "Confirmed", cls: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-600", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  PENDING_APPROVAL: { text: "Pending approval", cls: "bg-amber-100 text-amber-800", dot: "bg-amber-500", icon: <Clock className="h-3.5 w-3.5" /> },
  REJECTED: { text: "Rejected", cls: "bg-rose-100 text-rose-700", dot: "bg-rose-400", icon: <Ban className="h-3.5 w-3.5" /> },
};
const methodLabel = (m?: string) => (m || "—").replace(/_/g, " ");

/**
 * Money actually received on this project, as a timeline grouped by month. Cash field staff
 * collected on site (from their daily report) arrives PENDING_APPROVAL and is pinned on top with
 * Approve / Reject; office-collected money is added with "Record Payment" (confirmed immediately).
 */
function PaymentsSection({ projectId, customerId, canWrite, canCollect, onChanged, compact }: {
  projectId: number; customerId?: number; canWrite: boolean; canCollect: boolean; onChanged: () => void;
  /** Latest five as a flat list, with "Show all" opening the full month timeline. */
  compact?: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const [rows, setRows] = useState<CustomerPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [recordOpen, setRecordOpen] = useState(false);
  const [deleting, setDeleting] = useState<CustomerPayment | null>(null);
  const [editing, setEditing] = useState<CustomerPayment | null>(null);

  const load = () => {
    setLoading(true);
    financeApi.getPayments({ projectId, size: 100 })
      .then((r) => setRows([...(r.content || [])].sort((a, b) => String(b.paymentDate).localeCompare(String(a.paymentDate)))))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };
  useEffect(load, [projectId]);

  const pending = rows.filter((p) => p.status === "PENDING_APPROVAL");
  const history = rows.filter((p) => p.status !== "PENDING_APPROVAL");
  const confirmedTotal = rows.filter((p) => p.status === "CONFIRMED").reduce((s, p) => s + (p.amount || 0), 0);
  const pendingTotal = pending.reduce((s, p) => s + (p.amount || 0), 0);

  // Month buckets for the timeline, newest first.
  const months = useMemo(() => {
    const m = new Map<string, CustomerPayment[]>();
    history.forEach((p) => {
      const k = p.paymentDate ? format(new Date(p.paymentDate), "MMMM yyyy") : "Undated";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(p);
    });
    return [...m.entries()];
  }, [history]);

  const approve = (id: number) => {
    setBusyId(id);
    financeApi.approvePayment(id).then(() => { load(); onChanged(); toast.success("Payment approved"); })
      .catch((e) => toast.error(e?.response?.data?.message || "Approve failed")).finally(() => setBusyId(null));
  };
  const reject = (id: number) => {
    if (!confirm("Reject this payment? It won't count as received.")) return;
    setBusyId(id);
    financeApi.rejectPayment(id).then(() => { load(); onChanged(); toast.success("Payment rejected"); })
      .catch((e) => toast.error(e?.response?.data?.message || "Reject failed")).finally(() => setBusyId(null));
  };

  return (
    <MoneySection
      icon={IndianRupee}
      title="Payments received"
      subtitle={<>
        <span className="font-semibold tabular-nums text-emerald-700">{inr(confirmedTotal)}</span> confirmed
        {pendingTotal > 0 && <> · <span className="font-semibold tabular-nums text-amber-700">{inr(pendingTotal)}</span> awaiting approval</>}
      </>}
      actions={canCollect && customerId ? (
        <Button size="sm" variant="forest" onClick={() => setRecordOpen(true)} className="active:scale-[0.98]">
          <Plus /> Record payment
        </Button>
      ) : undefined}
    >
      {loading ? (
        <div className="flex justify-center py-10 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <div className="py-10 text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400"><IndianRupee className="h-5 w-5" /></span>
          <div className="mt-2 text-sm font-semibold text-slate-600">No payments yet</div>
          <div className="text-xs text-slate-400">Record money received here. Field staff can also log cash collected in their daily report.</div>
        </div>
      ) : (
        <div className={compact ? "space-y-2.5 pb-3" : "space-y-4 pb-3"}>
          {/* Waiting for approval — pinned on top */}
          {pending.length > 0 && (
            <div className="border-b border-amber-200/70 bg-amber-50/60">
              <div className="flex items-center gap-2 px-4 pt-3 text-xs font-semibold text-amber-900">
                <Clock className="h-3.5 w-3.5" /> Waiting for approval
                <span className="rounded-full bg-amber-200/70 px-1.5 py-px text-[11px] tabular-nums">{pending.length}</span>
              </div>
              <div className="divide-y divide-amber-200/60">
                {pending.map((p) => {
                  const busy = busyId === p.id;
                  return (
                    <div key={p.id} className="flex flex-col @xl:flex-row @xl:items-center gap-2 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-base font-semibold tabular-nums text-slate-900">{inr(p.amount)}</span>
                          <span className="text-xs capitalize text-slate-500">{methodLabel(p.paymentMethod).toLowerCase()}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {p.paymentDate ? format(new Date(p.paymentDate), "dd MMM yyyy") : "—"}
                          {p.collectedBy?.name && <> · collected by <span className="font-semibold text-slate-600">{p.collectedBy.name}</span></>}
                          {p.referenceNumber && <> · Ref {p.referenceNumber}</>}
                        </div>
                      </div>
                      {canWrite ? (
                        <div className="flex items-center gap-2 shrink-0">
                          {busy && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => reject(p.id)} className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700">
                            <Ban /> Reject
                          </Button>
                          <Button size="sm" variant="forest" disabled={busy} onClick={() => approve(p.id)} className="active:scale-[0.98]">
                            <CheckCircle2 /> Approve
                          </Button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-amber-700 shrink-0">Finance will approve</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Compact: latest payments as a flat list */}
          {compact && !showAll && history.length > 0 && (
            <div className="divide-y divide-slate-100 border-b border-slate-100">
              {history.slice(0, 5).map((p) => {
                const st = PAY_STATUS[p.status] || PAY_STATUS.CONFIRMED;
                const rejected = p.status === "REJECTED";
                return (
                  <div key={p.id} className={`flex items-center gap-2.5 px-4 py-2.5 ${rejected ? "opacity-60" : ""}`}>
                    <span className={`h-2 w-2 shrink-0 rounded-full ${st.dot}`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-slate-500 truncate">
                        {p.paymentDate ? format(new Date(p.paymentDate), "dd MMM") : "—"} · <span className="capitalize">{methodLabel(p.paymentMethod).toLowerCase()}</span>
                        {p.collectedBy?.name && <> · {p.collectedBy.name}</>}
                        {p.invoice?.invoiceNumber && <> · {p.invoice.invoiceNumber}</>}
                      </div>
                    </div>
                    <span className={`text-sm font-semibold tabular-nums shrink-0 ${rejected ? "line-through text-slate-400" : "text-slate-900"}`}>{inr(p.amount)}</span>
                    {canWrite && !rejected && (
                      <button type="button" title="Edit payment" onClick={() => setEditing(p)}
                        className="rounded-lg p-1 text-slate-300 hover:bg-emerald-50 hover:text-emerald-700"><Pencil className="h-3.5 w-3.5" /></button>
                    )}
                    {canWrite && (
                              <button type="button" title="Delete payment" onClick={() => setDeleting(p)}
                                className=" rounded-lg p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
                            )}
                  </div>
                );
              })}
            </div>
          )}
          {compact && history.length > 5 && (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="mx-4 w-[calc(100%-2rem)] rounded-lg py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50">
              {showAll ? "Show less" : `Show all ${history.length} payments`}
            </button>
          )}

          {/* Timeline */}
          {(!compact || showAll) && months.map(([month, list]) => {
            const monthTotal = list.filter((p) => p.status === "CONFIRMED").reduce((s, p) => s + (p.amount || 0), 0);
            return (
              <div key={month} className="px-4">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{month}</span>
                  <span className="text-xs font-semibold text-emerald-700">{inr(monthTotal)}</span>
                </div>
                <ol className="relative space-y-2 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-slate-200">
                  {list.map((p) => {
                    const st = PAY_STATUS[p.status] || PAY_STATUS.CONFIRMED;
                    const rejected = p.status === "REJECTED";
                    return (
                      <li key={p.id} className="relative flex gap-3">
                        <span className={`relative z-10 mt-3 h-[9px] w-[9px] shrink-0 translate-x-[7px] rounded-full ring-4 ring-white ${st.dot}`} />
                        <div className={`ml-2 min-w-0 flex-1 rounded-xl border border-slate-100 px-3 py-2.5 transition-shadow hover:shadow-sm ${rejected ? "opacity-60" : ""}`}>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className={`text-base font-bold ${rejected ? "line-through text-slate-400" : "text-slate-900"}`}>{inr(p.amount)}</span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{methodLabel(p.paymentMethod)}</span>
                            <span className={`ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>{st.icon} {st.text}</span>
                            {canWrite && !rejected && (
                              <button type="button" title="Edit payment" onClick={() => setEditing(p)}
                                className="ml-1 rounded-lg p-1 text-slate-300 hover:bg-emerald-50 hover:text-emerald-700"><Pencil className="h-3.5 w-3.5" /></button>
                            )}
                            {canWrite && (
                              <button type="button" title="Delete payment" onClick={() => setDeleting(p)}
                                className="ml-1rounded-lg p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
                            )}
                          </div>
                          <div className="mt-1 text-[11px] text-slate-400 flex flex-wrap gap-x-2">
                            <span>{p.paymentDate ? format(new Date(p.paymentDate), "EEE, dd MMM") : "—"}</span>
                            {p.paymentNumber && <span>· {p.paymentNumber}</span>}
                            {p.invoice?.invoiceNumber && <span>· for {p.invoice.invoiceNumber}</span>}
                            {p.collectedBy?.name && <span className="inline-flex items-center gap-1">· <UserIcon className="h-3 w-3" /> {p.collectedBy.name}</span>}
                            {p.referenceNumber && <span>· Ref {p.referenceNumber}</span>}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            );
          })}
        </div>
      )}

      {recordOpen && customerId && (
        <RecordPaymentDialog projectId={projectId} customerId={customerId}
          onClose={() => setRecordOpen(false)} onSaved={() => { setRecordOpen(false); load(); onChanged(); }} />
      )}
      {editing && (
        <RecordPaymentDialog projectId={projectId} customerId={customerId ?? editing.customer?.id as number} editing={editing}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); onChanged(); }} />
      )}
      <DeleteWithRemarkDialog open={!!deleting} title="Delete payment" subject="Payment" onClose={() => setDeleting(null)}
        onConfirm={(reason) => financeApi.deletePayment(deleting!.id, reason)} onDone={() => { load(); onChanged(); }} />
    </MoneySection>
  );
}

/** Record an office-collected payment directly (CONFIRMED). */
function RecordPaymentDialog({ projectId, customerId, editing, onClose, onSaved }: {
  projectId: number; customerId: number; editing?: CustomerPayment; onClose: () => void; onSaved: () => void;
}) {
  const [amount, setAmount] = useState<string>(editing ? String(editing.amount) : "");
  const [method, setMethod] = useState(editing?.paymentMethod || "CASH");
  const [date, setDate] = useState(editing?.paymentDate ? String(editing.paymentDate).slice(0, 10) : today());
  const [reference, setReference] = useState(editing?.referenceNumber || "");
  // Who received the money (an employee who collected it on site); blank = the logged-in user.
  const [collectedBy, setCollectedBy] = useState(editing?.collectedBy?.id != null ? String(editing.collectedBy.id) : "");
  const [employees, setEmployees] = useState<RosterRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    smartAssignmentApi.roster().then((r) => setEmployees((r || []).filter((e) => e.userId != null))).catch(() => setEmployees([]));
  }, []);

  const save = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) { setError("Enter an amount."); return; }
    setSaving(true); setError(null);
    try {
      if (editing) {
        await financeApi.updatePayment(editing.id, {
          amount: amt, paymentMethod: method, paymentDate: date,
          referenceNumber: reference || undefined, remarks: editing.remarks,
          ...(collectedBy ? { collectedBy: { id: Number(collectedBy) } } : {}),
        });
        toast.success("Payment updated");
      } else {
      await financeApi.recordPayment({
        customer: { id: customerId }, project: { id: projectId },
        amount: amt, paymentMethod: method, paymentDate: date,
        referenceNumber: reference || undefined, paymentType: "PARTIAL", status: "CONFIRMED",
        ...(collectedBy ? { collectedBy: { id: Number(collectedBy) } } : {}),
      });
      toast.success("Payment recorded");
      }
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to record payment.");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><IndianRupee className="h-5 w-5 text-emerald-600" /> {editing ? `Edit ${editing.paymentNumber || "Payment"}` : "Record Payment"}</DialogTitle>
          <DialogDescription>{editing ? "Correct the amount, method, date or reference. A changed amount is adjusted in the ledger." : "Money received for this project. It's confirmed immediately."}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Amount</span>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} className="pl-7 text-lg font-semibold" placeholder="0" autoFocus />
              </div>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Method</span>
              <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm">
                {METHODS.map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-sm"><span className="font-medium">Date</span><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
            <label className="space-y-1 text-sm"><span className="font-medium">Reference</span><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Txn / ref" /></label>
          </div>
          {employees.length > 0 && (
            <div className="space-y-1 text-sm">
              <span className="font-medium">Collected by</span>
              <SearchableSelect
                value={collectedBy}
                onChange={setCollectedBy}
                options={employees.map((e) => ({ value: String(e.userId), label: e.name, hint: [e.employeeCode, e.designation].filter(Boolean).join(" · ") }))}
                placeholder="Select the employee who received it…"
                clearLabel="Me (office / no employee)"
              />
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {editing ? "Save changes" : "Record"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Mark an invoice paid — one or more payment methods that combine to settle the balance. */
function MarkPaidDialog({ invoice, onClose, onSaved }: { invoice: Invoice; onClose: () => void; onSaved: () => void }) {
  const balance = invoice.balanceDue ?? invoice.totalAmount ?? 0;
  const [tenders, setTenders] = useState<{ method: string; amount: number; referenceNumber: string }[]>([
    { method: "UPI", amount: balance, referenceNumber: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setTender = (idx: number, patch: Partial<{ method: string; amount: number; referenceNumber: string }>) =>
    setTenders((t) => t.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  const addTender = () => setTenders((t) => [...t, { method: "CASH", amount: Math.max(0, balance - total), referenceNumber: "" }]);
  const removeTender = (idx: number) => setTenders((t) => t.filter((_, i) => i !== idx));

  const total = tenders.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const over = total - balance > 0.009;

  const save = async () => {
    const splits = tenders
      .filter((t) => Number(t.amount) > 0)
      .map((t) => ({ method: t.method, amount: Number(t.amount), referenceNumber: t.referenceNumber || undefined }));
    if (splits.length === 0) { setError("Enter at least one payment amount."); return; }
    if (over) { setError("Total exceeds the balance due."); return; }
    setSaving(true);
    setError(null);
    try {
      await financeApi.markInvoicePaid(invoice.id, splits);
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to record payment.");
    } finally {
      setSaving(false);
    }
  };

  const fullyPaid = Math.abs(total - balance) < 0.01;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" /> Mark {invoice.invoiceNumber} paid</DialogTitle>
          <DialogDescription>Balance due {inr(balance)}. Choose how it was paid — combine methods if needed.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {tenders.map((t, idx) => (
            <div key={idx} className="grid grid-cols-12 items-center gap-2">
              <select value={t.method} onChange={(e) => setTender(idx, { method: e.target.value })}
                className="col-span-4 rounded-md border border-input bg-background px-2 py-1.5 text-sm">
                {METHODS.map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
              </select>
              <Input className="col-span-4 text-right" type="number" min={0} value={t.amount}
                onChange={(e) => setTender(idx, { amount: Number(e.target.value) })} placeholder="Amount" />
              <Input className="col-span-3" value={t.referenceNumber}
                onChange={(e) => setTender(idx, { referenceNumber: e.target.value })} placeholder="Ref / Txn" />
              <button type="button" className="col-span-1 flex justify-center text-slate-400 hover:text-red-500 disabled:opacity-30"
                onClick={() => removeTender(idx)} disabled={tenders.length === 1}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button type="button" onClick={addTender} className="flex items-center gap-1 text-sm font-medium text-emerald-600 hover:underline">
            <Plus className="h-4 w-4" /> Add another method (combine)
          </button>

          <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm">
            <span className="text-slate-500">Entered total</span>
            <span className={`font-semibold ${over ? "text-red-600" : fullyPaid ? "text-emerald-600" : "text-amber-600"}`}>
              {inr(total)} {fullyPaid ? "· full" : over ? "· over" : "· partial"}
            </span>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {fullyPaid ? "Mark Paid" : "Record"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Default line description per invoice type — used in the simple single-amount mode.
const DEFAULT_DESC: Record<InvoiceType, string> = {
  ADVANCE: "Advance payment",
  PROGRESS: "Progress payment",
  FINAL: "Final payment",
  PROFORMA: "Proforma amount",
  QUOTATION: "Quotation amount",
};

/**
 * Invoice maker. Simple by default: pick a type, enter one amount, done — GST/totals auto. An
 * "Itemize" toggle reveals the multi-line editor when a detailed breakdown is needed.
 */
function InvoiceMaker({ project, invoice: editing, onClose, onSaved }: { project: any; invoice?: Invoice | null; onClose: () => void; onSaved: () => void }) {
  const [invoiceType, setInvoiceType] = useState<InvoiceType>("ADVANCE");
  const [date, setDate] = useState(today());
  const [dueDate, setDueDate] = useState("");
  const [gstRate, setGstRate] = useState(18);
  const [taxInclusive, setTaxInclusive] = useState(false);
  const [notes, setNotes] = useState("");
  const [itemized, setItemized] = useState(false);
  // Discount on the invoice: % or ₹ amount. Editing the final total back-solves a flat discount.
  const [discType, setDiscType] = useState<"PERCENTAGE" | "FLAT">("FLAT");
  const [discValue, setDiscValue] = useState<number | "">("");

  // Simple mode (default)
  const [amount, setAmount] = useState<number>(0);
  const [description, setDescription] = useState("");

  // Itemized mode
  const [lines, setLines] = useState<LineItem[]>([{ description: "", quantity: 1, unitPrice: 0 }]);
  const setLine = (idx: number, patch: Partial<LineItem>) =>
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const addLine = () => setLines((ls) => [...ls, { description: "", quantity: 1, unitPrice: 0 }]);
  const removeLine = (idx: number) => setLines((ls) => ls.filter((_, i) => i !== idx));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Has the customer already paid this? NONE = unpaid; RECORDED = money already in Payments (link it);
  // NEW = paid but not recorded yet (record it now).
  const [payMode, setPayMode] = useState<"NONE" | "RECORDED" | "NEW">("NONE");
  const [unlinked, setUnlinked] = useState<CustomerPayment[] | null>(null);
  const [linkIds, setLinkIds] = useState<Set<number>>(new Set());
  const [newMethod, setNewMethod] = useState("UPI");
  const [newRef, setNewRef] = useState("");
  const [newAmount, setNewAmount] = useState<number | "">("");
  useEffect(() => {
    if (editing || payMode === "NONE" || unlinked) return;
    financeApi.getPayments({ projectId: project.id, size: 100 })
      .then((r) => setUnlinked((r.content || []).filter((p) => p.status === "CONFIRMED" && !p.invoice)))
      .catch(() => setUnlinked([]));
  }, [editing, payMode, unlinked, project.id]);
  const linkedTotal = (unlinked || []).filter((p) => linkIds.has(p.id)).reduce((s, p) => s + Number(p.amount || 0), 0);

  // Editing a draft: load its saved lines into the itemized editor.
  const [quoteId, setQuoteId] = useState<number | null>(editing?.quotation?.id ?? null);
  useEffect(() => {
    if (!editing) return;
    setInvoiceType(editing.invoiceType);
    setDate(editing.date || today());
    setDueDate(editing.dueDate || "");
    setTaxInclusive(!!editing.taxInclusive);
    setNotes(editing.notes || "");
    if (Number((editing as any).discountValue) > 0) {
      setDiscType((editing as any).discountType === "PERCENTAGE" ? "PERCENTAGE" : "FLAT");
      setDiscValue(Number((editing as any).discountValue));
    }
    financeApi.getInvoiceItems(editing.id).then((its) => {
      if (its.length) {
        setGstRate(Number(its[0].gstRate ?? 0));
        setItemized(true);
        setLines(its.map((i) => ({
          description: i.description || "",
          quantity: Number(i.quantity) || 1,
          unitPrice: Number(editing.taxInclusive ? (i.unitPriceIncl ?? i.unitPrice) : i.unitPrice) || 0,
        })));
      }
    }).catch(() => setError("Could not load the invoice lines."));
  }, [editing]);

  // Fill the lines from the project's quotation: products, labour/shipping charges, the customer discount
  // spread over the products, billed at the chosen % (e.g. 30% for an advance).
  const quotation = project.quotation;
  const [billPct, setBillPct] = useState(100);
  const [filling, setFilling] = useState(false);
  // Quotation lines priced as they would be billed (customer discount spread over the products, at billPct).
  const buildQuoteLines = (q: any) => {
    const n = (v: unknown) => Number(v ?? 0) || 0;
    const items = (q.items || []).filter((i: any) => i.status !== "REJECTED");
    const pricing = readPricing(q);
    const base = items.map((i: any) => {
      let t = n(i.rate) * n(i.quantity);
      if (n(i.discountPercentage) > 0) t -= t * n(i.discountPercentage) / 100;
      else if (n(i.discountAmount) > 0) t -= Math.min(n(i.discountAmount), t);
      return t + n(i.additionalCharges);
    });
    const charges = quoteCharges(q);
    const itemsSum = base.reduce((x: number, y: number) => x + y, 0);
    const chargesSum = charges.reduce((x, c) => x + c.amount, 0);
    const discBase = pricing.itemsOnly === false ? itemsSum + chargesSum : itemsSum;
    const discount = pricing.mode === "PERCENT" ? discBase * pricing.value / 100 : pricing.value;
    const f = discBase > 0 ? 1 - discount / discBase : 1;
    const k = (Number(billPct) || 100) / 100;
    const r2 = (v: number) => Math.round(v * 100) / 100;
    const built: LineItem[] = [
      ...items.map((i: any, idx: number) => ({
        description: [i.itemName, i.color].filter(Boolean).join(" — "),
        quantity: 1,
        unitPrice: r2(base[idx] * f * k),
      })),
      ...charges.map((c) => ({
        description: c.note ? `${c.label} — ${c.note}` : c.label,
        quantity: 1,
        unitPrice: r2(c.amount * (pricing.itemsOnly === false ? f : 1) * k),
      })),
    ].filter((l) => l.unitPrice > 0);
    return { built, pricing, k };
  };

  const applyQuoteSettings = (q: any, pricing: ReturnType<typeof readPricing>, k: number) => {
    setItemized(true);
    setGstRate(pricing.gst);
    setTaxInclusive(!!pricing.inclusive);
    setQuoteId(q.id as number);
    if (k < 1) setInvoiceType("ADVANCE");
  };

  const fillFromQuote = async () => {
    if (!quotation?.id) return;
    setFilling(true);
    setError(null);
    try {
      const q = await quotationApi.get(quotation.id);
      const { built, pricing, k } = buildQuoteLines(q);
      if (!built.length) { setError("The quotation has no priced items to bill."); return; }
      setLines(built);
      applyQuoteSettings(q, pricing, k);
      setPickList(null);
      toast.success(`Filled from ${q.quotationNumber}${k < 1 ? ` (${billPct}%)` : ""} — edit anything before saving`);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Could not read the quotation.");
    } finally { setFilling(false); }
  };

  // Item-wise billing: list the quotation's lines so only the ticked ones go on this invoice.
  const [pickList, setPickList] = useState<{ q: any; lines: LineItem[]; picked: Set<number> } | null>(null);
  const openPicker = async () => {
    if (!quotation?.id) return;
    setFilling(true);
    setError(null);
    try {
      const q = await quotationApi.get(quotation.id);
      const { built } = buildQuoteLines(q);
      if (!built.length) { setError("The quotation has no priced items to bill."); return; }
      setPickList({ q, lines: built, picked: new Set() });
    } catch (e: any) {
      setError(e?.response?.data?.message || "Could not read the quotation.");
    } finally { setFilling(false); }
  };
  const togglePick = (idx: number) => setPickList((pl) => {
    if (!pl) return pl;
    const picked = new Set(pl.picked);
    if (picked.has(idx)) picked.delete(idx); else picked.add(idx);
    return { ...pl, picked };
  });
  const addPicked = () => {
    if (!pickList || pickList.picked.size === 0) return;
    const chosen = pickList.lines.filter((_, i) => pickList.picked.has(i));
    const { pricing, k } = buildQuoteLines(pickList.q);
    const blank = lines.length === 1 && !lines[0].description.trim() && !Number(lines[0].unitPrice);
    setLines(blank || !itemized ? chosen : [...lines, ...chosen]);
    applyQuoteSettings(pickList.q, pricing, k);
    setPickList(null);
  };

  const entered = itemized
    ? lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0)
    : (Number(amount) || 0);
  // With GST-inclusive amounts the GST is worked out of them; otherwise it's added on top.
  const rate = Number(gstRate) || 0;
  const grossSub = taxInclusive ? entered / (1 + rate / 100) : entered;
  const dv = Number(discValue) || 0;
  const discount = dv <= 0 ? 0
    : discType === "PERCENTAGE" ? grossSub * Math.min(dv, 100) / 100
    : Math.min(taxInclusive && entered > 0 ? dv * grossSub / entered : dv, grossSub);
  const subTotal = grossSub - discount;
  const gstAmount = subTotal * rate / 100;
  const total = subTotal + gstAmount;
  const preDiscountTotal = grossSub * (1 + rate / 100);
  // Type the final total you want: the difference becomes a flat discount.
  const setFinalTotal = (v: number | "") => {
    if (v === "" || !(Number(v) >= 0)) { setDiscValue(""); return; }
    const off = Math.max(0, preDiscountTotal - Number(v));
    setDiscType("FLAT");
    setDiscValue(off <= 0 ? "" : Math.round((taxInclusive ? off : off / (1 + rate / 100)) * 100) / 100);
  };

  const save = async (issue: boolean) => {
    const items = itemized
      ? lines
          .filter((l) => l.description.trim() && Number(l.unitPrice) > 0)
          .map((l) => ({
            description: l.description.trim(),
            quantity: Number(l.quantity) || 1,
            unitPrice: Number(l.unitPrice) || 0,
            unitPriceIncl: taxInclusive ? Number(l.unitPrice) || 0 : null,
            gstRate: Number(gstRate) || 0,
            totalPrice: (Number(l.quantity) || 1) * (Number(l.unitPrice) || 0),
          }))
      : (Number(amount) > 0
          ? [{
              description: description.trim() || DEFAULT_DESC[invoiceType],
              quantity: 1,
              unitPrice: Number(amount),
              unitPriceIncl: taxInclusive ? Number(amount) : null,
              gstRate: Number(gstRate) || 0,
              totalPrice: Number(amount),
            }]
          : []);
    if (items.length === 0) { setError(itemized ? "Add at least one line item with an amount." : "Enter an amount."); return; }
    const settling = !editing && payMode !== "NONE";
    if (payMode === "RECORDED" && !editing && linkIds.size === 0) { setError("Tick the recorded payment(s) this invoice was paid with, or choose another option."); return; }
    if (payMode === "NEW" && !editing && !(Number(newAmount || total) > 0)) { setError("Enter the amount that was paid."); return; }
    setSaving(true);
    setError(null);
    try {
      const invoice = {
        invoiceType,
        customer: { id: project.customer.id },
        project: { id: project.id },
        date,
        dueDate: dueDate || undefined,
        gstType: "CGST_SGST",
        taxInclusive,
        ...(dv > 0 ? { discountType: discType, discountValue: dv } : { discountType: null, discountValue: null }),
        status: "DRAFT",
        notes: notes || undefined,
        ...(quoteId ? { quotation: { id: quoteId } } : {}),
      };
      const saved = editing
        ? await financeApi.updateDraftInvoice(editing.id, invoice, items)
        : await financeApi.createInvoice(invoice, items);
      if ((issue || settling) && saved?.id) await financeApi.issueInvoice(saved.id);
      if (settling && saved?.id) {
        if (payMode === "RECORDED") {
          for (const p of (unlinked || []).filter((x) => linkIds.has(x.id))) {
            await financeApi.updatePayment(p.id, { amount: p.amount, invoice: { id: saved.id } });
          }
        } else {
          await financeApi.markInvoicePaid(saved.id, [{ method: newMethod, amount: Number(newAmount || total), referenceNumber: newRef || undefined }]);
        }
      }
      toast.success(settling ? "Invoice issued & payment settled" : issue ? (editing ? "Invoice updated & issued" : "Invoice created & issued") : (editing ? "Draft updated" : "Draft invoice saved"));
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to create invoice.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> {editing ? `Edit ${editing.invoiceNumber}` : "New Invoice"}</DialogTitle>
          <DialogDescription>{editing ? "Draft invoices can be edited until they are issued." : "Enter the amount — GST and totals are calculated automatically."}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {quotation?.id && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm">
              <FileText className="h-4 w-4 text-emerald-700" />
              <span className="font-medium text-emerald-900">From quotation {quotation.quotationNumber}</span>
              <span className="ml-auto flex items-center gap-1.5">
                <span className="text-xs text-slate-500">Bill</span>
                <Input type="number" min={1} max={100} value={billPct} onChange={(e) => setBillPct(Number(e.target.value))} className="h-8 w-16 text-right" />
                <span className="text-xs text-slate-500">%</span>
                <Button type="button" size="sm" variant="outline" disabled={filling} onClick={fillFromQuote} className="h-8">
                  {filling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Fill all
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={filling} onClick={openPicker} className="h-8">Pick items</Button>
              </span>
            </div>
          )}

          {pickList && (
            <div className="rounded-lg border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <span>Select items to bill</span>
                <button type="button" className="font-medium normal-case text-emerald-600 hover:underline"
                  onClick={() => setPickList((pl) => pl && ({ ...pl, picked: pl.picked.size === pl.lines.length ? new Set() : new Set(pl.lines.map((_, i) => i)) }))}>
                  {pickList.picked.size === pickList.lines.length ? "Clear" : "Select all"}
                </button>
              </div>
              <div className="max-h-52 divide-y divide-slate-100 overflow-y-auto">
                {pickList.lines.map((l, i) => (
                  <label key={i} className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-50">
                    <input type="checkbox" checked={pickList.picked.has(i)} onChange={() => togglePick(i)} className="h-4 w-4 accent-emerald-600" />
                    <span className="min-w-0 flex-1 truncate">{l.description}</span>
                    <span className="shrink-0 tabular-nums font-medium text-slate-700">{inr(l.unitPrice)}</span>
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-200 px-3 py-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => setPickList(null)}>Cancel</Button>
                <Button type="button" size="sm" disabled={pickList.picked.size === 0} onClick={addPicked}>Add {pickList.picked.size || ""} selected</Button>
              </div>
            </div>
          )}

          {/* Type as segmented buttons */}
          <div className="space-y-1.5">
            <span className="text-sm font-medium">Type</span>
            <div className="grid grid-cols-4 gap-1.5">
              {INVOICE_TYPES.map((t) => (
                <button key={t} type="button" onClick={() => setInvoiceType(t)}
                  className={`rounded-lg border px-2 py-1.5 text-xs font-semibold capitalize transition-colors ${
                    invoiceType === t ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                  {t.toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {!itemized ? (
            <>
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Amount (before GST)</span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                  <Input type="number" min={0} value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))}
                    className="pl-7 text-lg font-semibold" placeholder="0" autoFocus />
                </div>
              </label>
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Description</span>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={DEFAULT_DESC[invoiceType]} />
              </label>
            </>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <span className="col-span-6">Description</span><span className="col-span-2 text-right">Qty</span>
                <span className="col-span-3 text-right">Rate</span><span className="col-span-1" />
              </div>
              {lines.map((l, idx) => (
                <div key={idx} className="grid grid-cols-12 items-center gap-2">
                  <Input className="col-span-6" placeholder="e.g. Design fee" value={l.description} onChange={(e) => setLine(idx, { description: e.target.value })} />
                  <Input className="col-span-2 text-right" type="number" min={1} value={l.quantity} onChange={(e) => setLine(idx, { quantity: Number(e.target.value) })} />
                  <Input className="col-span-3 text-right" type="number" min={0} value={l.unitPrice} onChange={(e) => setLine(idx, { unitPrice: Number(e.target.value) })} />
                  <button type="button" className="col-span-1 flex justify-center text-slate-400 hover:text-red-500 disabled:opacity-30" onClick={() => removeLine(idx)} disabled={lines.length === 1}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={addLine} className="flex items-center gap-1 text-sm font-medium text-emerald-600 hover:underline">
                <Plus className="h-4 w-4" /> Add line
              </button>
            </div>
          )}

          {/* Date · Due · GST in one compact row */}
          <div className="grid grid-cols-3 gap-3">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Date</span>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Due date</span>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">GST %</span>
              <Input type="number" min={0} max={28} value={gstRate} onChange={(e) => setGstRate(Number(e.target.value))} />
              <GstModeToggle size="sm" inclusive={taxInclusive} onChange={setTaxInclusive} />
            </label>
          </div>

          <button type="button" onClick={() => setItemized((v) => !v)} className="text-xs font-medium text-emerald-600 hover:underline">
            {itemized ? "← Back to simple amount" : "Itemize (multiple lines)"}
          </button>

          {!editing && (
            <div className="space-y-2 rounded-lg border border-slate-200 p-3">
              <span className="text-sm font-medium">Has the customer paid this?</span>
              <div className="grid grid-cols-3 gap-1.5">
                {([["NONE", "Not paid yet"], ["RECORDED", "Paid · already recorded"], ["NEW", "Paid · not recorded"]] as const).map(([k, label]) => (
                  <button key={k} type="button" onClick={() => setPayMode(k)}
                    className={`rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors ${
                      payMode === k ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                    {label}
                  </button>
                ))}
              </div>
              {payMode === "RECORDED" && (
                unlinked === null ? <p className="text-xs text-slate-500">Loading recorded payments…</p>
                : unlinked.length === 0 ? (
                  <p className="text-xs text-amber-700">No unlinked payments found on this project — choose “Paid · not recorded” to record it now.</p>
                ) : (
                  <div className="divide-y divide-slate-100 rounded-md border border-slate-200">
                    {unlinked.map((p) => (
                      <label key={p.id} className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-50">
                        <input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={linkIds.has(p.id)}
                          onChange={() => setLinkIds((s) => { const n = new Set(s); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; })} />
                        <span className="min-w-0 flex-1 truncate">{p.paymentNumber} · {(p.paymentMethod || "").replace("_", " ")} · {p.paymentDate ? format(new Date(p.paymentDate), "dd MMM yyyy") : "—"}</span>
                        <span className="shrink-0 font-medium tabular-nums">{inr(p.amount)}</span>
                      </label>
                    ))}
                  </div>
                )
              )}
              {payMode === "RECORDED" && linkIds.size > 0 && (
                <p className="text-xs text-slate-500">Linked {inr(linkedTotal)} of {inr(total)} — {linkedTotal >= total - 0.01 ? "invoice will be marked paid." : "invoice will be partly paid."}</p>
              )}
              {payMode === "NEW" && (
                <div className="grid grid-cols-12 items-center gap-2">
                  <select value={newMethod} onChange={(e) => setNewMethod(e.target.value)} className="col-span-4 rounded-md border border-input bg-background px-2 py-1.5 text-sm">
                    {METHODS.map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
                  </select>
                  <Input className="col-span-4 text-right" type="number" min={0} value={newAmount === "" ? "" : newAmount}
                    onChange={(e) => setNewAmount(e.target.value === "" ? "" : Number(e.target.value))} placeholder={`Paid ${Math.round(total)}`} />
                  <Input className="col-span-4" value={newRef} onChange={(e) => setNewRef(e.target.value)} placeholder="Ref / Txn" />
                </div>
              )}
              {payMode !== "NONE" && <p className="text-xs text-slate-500">The invoice is issued and the payment is settled when you save — no duplicate payment is created for recorded ones.</p>}
            </div>
          )}

          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Optional note shown on the invoice" />

          <div className="space-y-2 rounded-md bg-slate-50 px-4 py-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">Discount</span>
              <div className="flex rounded-md border border-slate-200 bg-white p-0.5">
                {([["FLAT", "₹"], ["PERCENTAGE", "%"]] as const).map(([k, l]) => (
                  <button key={k} type="button" onClick={() => setDiscType(k)}
                    className={`rounded px-2.5 py-0.5 text-xs font-semibold ${discType === k ? "bg-emerald-600 text-white" : "text-slate-500"}`}>{l}</button>
                ))}
              </div>
              <Input type="number" min={0} className="h-8 w-28 text-right" value={discValue === "" ? "" : discValue} placeholder="0"
                onChange={(e) => setDiscValue(e.target.value === "" ? "" : Number(e.target.value))} />
              <span className="ml-auto flex items-center gap-1.5">
                <span className="text-slate-500">Final total ₹</span>
                <Input type="number" min={0} className="h-8 w-28 text-right font-semibold" value={Math.round(total * 100) / 100 || ""}
                  onChange={(e) => setFinalTotal(e.target.value === "" ? "" : Number(e.target.value))} />
              </span>
            </div>
            <div className="flex justify-end gap-6">
              {discount > 0 && <span className="text-slate-500">Discount <strong className="ml-1 text-red-600">−{inr(discount)}</strong></span>}
              <span className="text-slate-500">Taxable <strong className="ml-1 text-slate-700">{inr(subTotal)}</strong></span>
              <span className="text-slate-500">GST <strong className="ml-1 text-slate-700">{inr(gstAmount)}</strong></span>
              <span className="text-slate-500">Total <strong className="ml-1 text-slate-900">{inr(total)}</strong></span>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="secondary" onClick={() => save(false)} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save draft</Button>
          <Button onClick={() => save(true)} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save & issue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

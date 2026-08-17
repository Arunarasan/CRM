import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Plus, Trash2, FileText, Wallet, Receipt, Loader2, IndianRupee, AlertCircle,
  CheckCircle2, RotateCcw, Printer,
} from "lucide-react";
import { financeApi } from "@/api/financeApi";
import type { Invoice, InvoiceType } from "@/types/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { printInvoice } from "./printInvoice";
import CompletionBillingTracker from "./CompletionBillingTracker";

const inr = (n?: number | null) =>
  "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);

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

/**
 * Project-scoped billing panel: budget vs invoiced vs paid vs due, the project's invoices with
 * inline Paid / Unpaid / Print actions, and an invoice maker. Payment is marked directly on the
 * invoice (methods combinable) — there is no separate payments component. Reuses /api/finance.
 */
export default function ProjectPaymentsTab({ project, onChanged }: { project: any; onChanged?: () => void }) {
  const { hasAuthority, hasAnyAuthority } = useAuth();
  const canRead = hasAuthority("FINANCE_READ");
  const canWrite = hasAuthority("FINANCE_WRITE");
  const canCollect = hasAnyAuthority(["FINANCE_WRITE", "FINANCE_COLLECT"]);

  const projectId = project?.id;
  const customerId = project?.customer?.id;

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [tick, setTick] = useState(0); // bumps so the billing tracker re-fetches after invoice changes

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

  const summary = useMemo(() => {
    const billable = invoices.filter((i) => i.status !== "DRAFT" && i.status !== "CANCELLED");
    const invoiced = billable.reduce((s, i) => s + (i.totalAmount || 0), 0);
    const paid = invoices.filter((i) => i.status !== "CANCELLED").reduce((s, i) => s + (i.amountPaid || 0), 0);
    const due = billable.reduce((s, i) => s + (i.balanceDue || 0), 0);
    return { budget: project?.budget || 0, invoiced, paid, due };
  }, [invoices, project]);

  const [makerOpen, setMakerOpen] = useState(false);
  const [payFor, setPayFor] = useState<Invoice | null>(null);

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
      .catch((e) => alert(e?.response?.data?.message || "Failed to mark unpaid"))
      .finally(() => setBusyId(null));
  };

  const issue = (id: number) => {
    setBusyId(id);
    financeApi.issueInvoice(id)
      .then(() => { reloadAll(); onChanged?.(); })
      .catch((e) => alert(e?.response?.data?.message || "Failed to issue invoice"))
      .finally(() => setBusyId(null));
  };

  const doPrint = async (inv: Invoice) => {
    try {
      const [full, items] = await Promise.all([financeApi.getInvoice(inv.id), financeApi.getInvoiceItems(inv.id)]);
      printInvoice(full, items, project);
    } catch {
      alert("Could not open the invoice for printing.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <SummaryCard label="Total Budget" value={inr(summary.budget)} icon={<Wallet className="h-5 w-5" />} tint="text-slate-700" />
        <SummaryCard label="Invoiced" value={inr(summary.invoiced)} icon={<FileText className="h-5 w-5" />} tint="text-blue-600" />
        <SummaryCard label="Paid" value={inr(summary.paid)} icon={<IndianRupee className="h-5 w-5" />} tint="text-emerald-600" />
        <SummaryCard label="Balance Due" value={inr(summary.due)} icon={<Receipt className="h-5 w-5" />} tint={summary.due > 0 ? "text-red-600" : "text-emerald-600"} />
      </div>

      {/* Combined completion + billing tracker (work % + payments, auto-billing milestones) */}
      <CompletionBillingTracker project={project} refreshSignal={tick} onChanged={reloadAll} />

      {loading ? (
        <div className="flex justify-center py-10 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : denied ? (
        <div className="rounded-xl border border-slate-100 bg-white p-6 text-slate-500">Billing data is restricted for your role.</div>
      ) : (
        <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800"><FileText className="h-5 w-5 text-blue-600" /> Invoices</h3>
            {canWrite && customerId && (
              <Button size="sm" onClick={() => setMakerOpen(true)}><Plus className="h-4 w-4" /> New Invoice</Button>
            )}
          </div>
          {!customerId && (
            <p className="mb-3 text-sm text-amber-600">This project has no linked customer, so invoices can't be raised yet.</p>
          )}
          {invoices.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No invoices for this project yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wider text-slate-400">
                    <th className="py-2 pr-4">Invoice #</th><th className="py-2 pr-4">Type</th><th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4 text-right">Total</th><th className="py-2 pr-4 text-right">Paid</th>
                    <th className="py-2 pr-4 text-right">Balance</th><th className="py-2 pr-4">Status</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((i) => {
                    const badge = paidLabel(i.status);
                    const busy = busyId === i.id;
                    return (
                      <tr key={i.id} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-medium text-slate-700">{i.invoiceNumber}</td>
                        <td className="py-2 pr-4 text-slate-500">{i.invoiceType}</td>
                        <td className="py-2 pr-4 text-slate-500">{i.date ? format(new Date(i.date), "dd MMM yyyy") : "-"}</td>
                        <td className="py-2 pr-4 text-right font-medium">{inr(i.totalAmount)}</td>
                        <td className="py-2 pr-4 text-right text-emerald-600">{inr(i.amountPaid)}</td>
                        <td className="py-2 pr-4 text-right text-slate-700">{inr(i.balanceDue)}</td>
                        <td className="py-2 pr-4"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}>{badge.text}</span></td>
                        <td className="py-2">
                          <div className="flex items-center justify-end gap-1.5">
                            {busy && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                            {canWrite && i.status === "DRAFT" && !busy && (
                              <ActionBtn onClick={() => issue(i.id)} title="Issue">Issue</ActionBtn>
                            )}
                            {canCollect && i.status !== "CANCELLED" && i.status !== "PAID" && !busy && (
                              <ActionBtn onClick={() => setPayFor(i)} tone="green" title="Mark paid">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Paid
                              </ActionBtn>
                            )}
                            {canWrite && i.status === "PAID" && !busy && (
                              <ActionBtn onClick={() => markUnpaid(i)} tone="red" title="Mark unpaid">
                                <RotateCcw className="h-3.5 w-3.5" /> Unpaid
                              </ActionBtn>
                            )}
                            {i.status !== "DRAFT" && (
                              <ActionBtn onClick={() => doPrint(i)} title="Print invoice">
                                <Printer className="h-3.5 w-3.5" /> Print
                              </ActionBtn>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {makerOpen && customerId && (
        <InvoiceMaker
          project={project}
          onClose={() => setMakerOpen(false)}
          onSaved={() => { setMakerOpen(false); reloadAll(); onChanged?.(); }}
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

function SummaryCard({ label, value, icon, tint }: { label: string; value: string; icon: React.ReactNode; tint: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className={`mb-2 ${tint}`}>{icon}</div>
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`text-2xl font-black ${tint}`}>{value}</div>
    </div>
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
          <button type="button" onClick={addTender} className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline">
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

/** Inline invoice maker — a few line items + a single GST rate. Backend recomputes GST/totals. */
function InvoiceMaker({ project, onClose, onSaved }: { project: any; onClose: () => void; onSaved: () => void }) {
  const [invoiceType, setInvoiceType] = useState<InvoiceType>("ADVANCE");
  const [date, setDate] = useState(today());
  const [dueDate, setDueDate] = useState("");
  const [gstRate, setGstRate] = useState(18);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineItem[]>([{ description: "Advance payment", quantity: 1, unitPrice: 0 }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setLine = (idx: number, patch: Partial<LineItem>) =>
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const addLine = () => setLines((ls) => [...ls, { description: "", quantity: 1, unitPrice: 0 }]);
  const removeLine = (idx: number) => setLines((ls) => ls.filter((_, i) => i !== idx));

  const subTotal = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);
  const gstAmount = subTotal * (Number(gstRate) || 0) / 100;
  const total = subTotal + gstAmount;

  const save = async (issue: boolean) => {
    const items = lines
      .filter((l) => l.description.trim() && Number(l.unitPrice) > 0)
      .map((l) => ({
        description: l.description.trim(),
        quantity: Number(l.quantity) || 1,
        unitPrice: Number(l.unitPrice) || 0,
        gstRate: Number(gstRate) || 0,
        totalPrice: (Number(l.quantity) || 1) * (Number(l.unitPrice) || 0),
      }));
    if (items.length === 0) { setError("Add at least one line item with an amount."); return; }
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
        status: "DRAFT",
        notes: notes || undefined,
      };
      const saved = await financeApi.createInvoice(invoice, items);
      if (issue && saved?.id) await financeApi.issueInvoice(saved.id);
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to create invoice.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> New Invoice</DialogTitle>
          <DialogDescription>Raise an advance or fee invoice for this project. GST and totals are calculated automatically.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Type</span>
              <select value={invoiceType} onChange={(e) => setInvoiceType(e.target.value as InvoiceType)} className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm">
                {INVOICE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
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
            </label>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <span className="col-span-6">Description</span><span className="col-span-2 text-right">Qty</span>
              <span className="col-span-3 text-right">Rate</span><span className="col-span-1" />
            </div>
            {lines.map((l, idx) => (
              <div key={idx} className="grid grid-cols-12 items-center gap-2">
                <Input className="col-span-6" placeholder="e.g. Advance payment / Design fee" value={l.description} onChange={(e) => setLine(idx, { description: e.target.value })} />
                <Input className="col-span-2 text-right" type="number" min={1} value={l.quantity} onChange={(e) => setLine(idx, { quantity: Number(e.target.value) })} />
                <Input className="col-span-3 text-right" type="number" min={0} value={l.unitPrice} onChange={(e) => setLine(idx, { unitPrice: Number(e.target.value) })} />
                <button type="button" className="col-span-1 flex justify-center text-slate-400 hover:text-red-500 disabled:opacity-30" onClick={() => removeLine(idx)} disabled={lines.length === 1}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button type="button" onClick={addLine} className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline">
              <Plus className="h-4 w-4" /> Add line
            </button>
          </div>

          <label className="block space-y-1 text-sm">
            <span className="font-medium">Notes</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Optional note shown on the invoice" />
          </label>

          <div className="flex justify-end gap-6 rounded-md bg-slate-50 px-4 py-3 text-sm">
            <span className="text-slate-500">Sub-total <strong className="ml-1 text-slate-700">{inr(subTotal)}</strong></span>
            <span className="text-slate-500">GST <strong className="ml-1 text-slate-700">{inr(gstAmount)}</strong></span>
            <span className="text-slate-500">Total <strong className="ml-1 text-slate-900">{inr(total)}</strong></span>
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

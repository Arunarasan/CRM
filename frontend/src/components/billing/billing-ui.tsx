import { format, differenceInCalendarDays } from "date-fns";
import type { Invoice } from "@/types/finance";

/*
 * One look for invoices across Billing — the list, the invoice page, returns and the summary strip:
 * plain status / type names, the same pill style as purchase orders, dates as "02 Oct 2026", and the
 * due-date and paid-progress read-outs.
 */

export const INVOICE_STATUS: Record<string, { label: string; pill: string; dot: string }> = {
  DRAFT: { label: "Draft", pill: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
  GENERATED: { label: "Issued", pill: "bg-sky-50 text-sky-700", dot: "bg-sky-500" },
  SENT: { label: "Sent", pill: "bg-indigo-50 text-indigo-700", dot: "bg-indigo-500" },
  PARTIAL: { label: "Partly paid", pill: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  PAID: { label: "Paid", pill: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  OVERDUE: { label: "Overdue", pill: "bg-rose-50 text-rose-700", dot: "bg-rose-500" },
  CANCELLED: { label: "Cancelled", pill: "bg-slate-100 text-slate-400 line-through", dot: "bg-slate-300" },
};

export const invoiceStatusLabel = (s?: string | null) => (s && INVOICE_STATUS[s]?.label) || s || "—";

export function InvoiceStatusBadge({ status, size = "sm" }: { status: string; size?: "sm" | "md" }) {
  const st = INVOICE_STATUS[status] || INVOICE_STATUS.DRAFT;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold ${st.pill} ${
      size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
      {st.label}
    </span>
  );
}

const TYPE_LABEL: Record<string, string> = {
  COUNTER_SALE: "Counter sale", QUOTATION: "Quotation", ADVANCE: "Advance", PROGRESS: "Progress",
  FINAL: "Final", PROFORMA: "Proforma", SERVICE: "Service",
};
export const invoiceTypeLabel = (t?: string | null) =>
  (t && TYPE_LABEL[t]) || (t || "").replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) || "—";

export const fmtDay = (d?: string | null) => (d ? format(new Date(d), "dd MMM yyyy") : "—");

export const inr = (n?: number | null) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const OPEN = ["GENERATED", "SENT", "PARTIAL", "OVERDUE"];

/** "due in 4 days" / "due today" / "overdue 6 days" — only for invoices that still have money owed. */
export function dueInfo(inv: Pick<Invoice, "dueDate" | "status" | "balanceDue">): { text: string; tone: string } | null {
  if (!inv.dueDate || !OPEN.includes(inv.status) || !(Number(inv.balanceDue) > 0)) return null;
  const days = differenceInCalendarDays(new Date(inv.dueDate), new Date());
  if (days < 0) return { text: `overdue ${-days} day${days === -1 ? "" : "s"}`, tone: "text-rose-600 font-semibold" };
  if (days === 0) return { text: "due today", tone: "text-amber-600 font-semibold" };
  return { text: `due in ${days} day${days === 1 ? "" : "s"}`, tone: days <= 3 ? "text-amber-600" : "text-slate-500" };
}

/** Paid share of an invoice as a slim bar with the percentage. */
export function PaidBar({ total, paid, className = "" }: { total?: number | null; paid?: number | null; className?: string }) {
  const t = Number(total) || 0;
  const pct = t > 0 ? Math.max(0, Math.min(100, Math.round((Number(paid) || 0) / t * 100))) : 0;
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${pct >= 100 ? "bg-emerald-500" : "bg-emerald-400"}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 text-right text-[11px] font-semibold tabular-nums text-slate-500">{pct}%</span>
    </div>
  );
}

/** WhatsApp link with a ready-made payment reminder for an invoice; null without a phone number. */
export function waReminderHref(inv: Invoice, company = "JB Decor"): string | null {
  const c: any = inv.customer || {};
  const raw = String(c.whatsappNumber || c.phone || "").replace(/\D/g, "");
  if (raw.length < 10) return null;
  const phone = raw.length === 10 ? `91${raw}` : raw;
  const first = String(c.name || "").split(" ")[0];
  const due = inv.dueDate ? ` due on ${format(new Date(inv.dueDate), "dd MMM")}` : "";
  const text = `Hi ${first || "there"}, invoice ${inv.invoiceNumber} for ${inr(inv.totalAmount)} has ${inr(inv.balanceDue)}${due}. Please arrange the payment. — ${company}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

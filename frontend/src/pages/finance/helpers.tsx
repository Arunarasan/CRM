import type { InvoiceStatus } from "@/types/finance";

export const currency = (n?: number | null) =>
  `₹${(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export const currencyFull = (n?: number | null) =>
  `₹${(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const INVOICE_STATUS_TONE: Record<InvoiceStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  GENERATED: "bg-emerald-100 text-emerald-700",
  SENT: "bg-emerald-100 text-emerald-700",
  PARTIAL: "bg-amber-100 text-amber-700",
  PAID: "bg-emerald-100 text-emerald-700",
  OVERDUE: "bg-red-100 text-red-700",
  CANCELLED: "bg-slate-200 text-slate-500 line-through",
};

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  DRAFT: "Draft",
  GENERATED: "Generated",
  SENT: "Sent",
  PARTIAL: "Partially Paid",
  PAID: "Paid",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled",
};

export const PAYMENT_STATUS_TONE: Record<string, string> = {
  PENDING_APPROVAL: "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
};

export const REFUND_STATUS_TONE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
  PAID: "bg-emerald-100 text-emerald-700",
};

export const SCHEDULE_STATUS_TONE: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-600",
  INVOICED: "bg-emerald-100 text-emerald-700",
  PARTIAL: "bg-amber-100 text-amber-700",
  PAID: "bg-emerald-100 text-emerald-700",
  OVERDUE: "bg-red-100 text-red-700",
};

export const stageLabel = (stage?: string) =>
  (stage ?? "").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

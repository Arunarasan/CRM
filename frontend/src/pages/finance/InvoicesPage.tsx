import { BaseInput } from "@/components/ui/input";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { financeApi } from "@/api/financeApi";
import type { Invoice, PageResp } from "@/types/finance";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  InvoiceStatusBadge, PaidBar, dueInfo, fmtDay, inr, invoiceTypeLabel, waReminderHref,
} from "@/components/billing/billing-ui";
import { FileText, IndianRupee, MessageCircle, MoreHorizontal, Plus, Printer, Search, X } from "lucide-react";

/** Status buttons: the questions people ask of the list. */
const STATUS_CHIPS: { id: string; label: string }[] = [
  { id: "", label: "All" },
  { id: "UNPAID", label: "Unpaid" },
  { id: "OVERDUE", label: "Overdue" },
  { id: "PARTIAL", label: "Partly paid" },
  { id: "DRAFT", label: "Draft" },
  { id: "PAID", label: "Paid" },
  { id: "CANCELLED", label: "Cancelled" },
];
const TYPES = ["", "COUNTER_SALE", "ADVANCE", "PROGRESS", "FINAL", "SERVICE", "PROFORMA", "QUOTATION"];
type Range = "all" | "this" | "last" | "custom";
const iso = (d: Date) => format(d, "yyyy-MM-dd");

export default function InvoicesPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "";
  const setStatus = (s: string) => setParams((p) => { const n = new URLSearchParams(p); if (s) n.set("status", s); else n.delete("status"); return n; }, { replace: true });

  const [data, setData] = useState<PageResp<Invoice> | null>(null);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [page, setPage] = useState(0);
  const [invoiceType, setInvoiceType] = useState("");
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<Range>("all");
  const [custom, setCustom] = useState({ from: "", to: "" });

  const { from, to } = useMemo(() => {
    const now = new Date();
    if (range === "this") return { from: iso(startOfMonth(now)), to: iso(endOfMonth(now)) };
    if (range === "last") { const m = subMonths(now, 1); return { from: iso(startOfMonth(m)), to: iso(endOfMonth(m)) }; }
    if (range === "custom") return custom;
    return { from: "", to: "" };
  }, [range, custom]);

  useEffect(() => { setPage(0); }, [status, invoiceType, search, from, to]);

  const load = useCallback(() => {
    setLoading(true);
    const t = setTimeout(() => {
      financeApi.getInvoices({ page, status, invoiceType, search, from, to, size: 15 })
        .then(setData).catch(() => setData(null)).finally(() => setLoading(false));
    }, search ? 250 : 0);
    return () => clearTimeout(t);
  }, [page, status, invoiceType, search, from, to]);
  useEffect(() => load(), [load]);

  // Count per status button (same type / search / dates), one tiny request each.
  useEffect(() => {
    let alive = true;
    Promise.all(STATUS_CHIPS.map((c) =>
      financeApi.getInvoices({ page: 0, size: 1, status: c.id, invoiceType, search, from, to })
        .then((r) => [c.id, r.totalElements] as const).catch(() => [c.id, 0] as const)))
      .then((pairs) => { if (alive) setCounts(Object.fromEntries(pairs)); });
    return () => { alive = false; };
  }, [invoiceType, search, from, to]);

  const rows = data?.content ?? [];
  const filtered = !!(status || invoiceType || search || range !== "all");

  return (
    <div className="space-y-3">
      {/* Status buttons */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {STATUS_CHIPS.map((c) => {
          const active = status === c.id;
          return (
            <button key={c.id || "all"} type="button" onClick={() => setStatus(c.id)} aria-pressed={active}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition active:scale-[0.98] ${
                active ? "border-primary bg-primary text-primary-foreground"
                  : c.id === "OVERDUE" && counts.OVERDUE ? "border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300"
                  : "bg-white text-slate-600 hover:border-slate-300"}`}>
              {c.label}
              <span className={`rounded-full px-1.5 text-[10px] tabular-nums ${active ? "bg-white/20" : "bg-slate-100 text-slate-500"}`}>
                {counts[c.id] ?? "·"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-[220px] flex-1 items-center rounded-lg border bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-primary/20">
          <Search className="mr-2 h-4 w-4 text-slate-400" />
          <BaseInput className="w-full text-sm outline-none" placeholder="Search invoice # or customer…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && <button aria-label="Clear search" onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>}
        </div>
        <select className="h-10 rounded-lg border bg-white px-3 text-sm" value={invoiceType} onChange={(e) => setInvoiceType(e.target.value)}>
          {TYPES.map((t) => <option key={t} value={t}>{t ? invoiceTypeLabel(t) : "All types"}</option>)}
        </select>
        <div role="radiogroup" aria-label="Date range" className="inline-flex h-10 items-center gap-0.5 rounded-lg border bg-white p-0.5">
          {([["all", "Any date"], ["this", "This month"], ["last", "Last month"], ["custom", "Custom"]] as const).map(([v, label]) => (
            <button key={v} type="button" role="radio" aria-checked={range === v} onClick={() => setRange(v)}
              className={`h-full whitespace-nowrap rounded-md px-2.5 text-xs font-semibold transition ${range === v ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
              {label}
            </button>
          ))}
        </div>
        {range === "custom" && (
          <div className="flex items-center gap-1.5">
            <BaseInput type="date" aria-label="From" className="h-10 rounded-lg border bg-white px-2 text-sm" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
            <span className="text-xs text-slate-400">to</span>
            <BaseInput type="date" aria-label="To" className="h-10 rounded-lg border bg-white px-2 text-sm" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
          </div>
        )}
      </div>

      {/* Table (desktop) */}
      <div className="hidden overflow-hidden rounded-2xl border bg-white shadow-sm md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5">Invoice</th>
              <th className="px-4 py-2.5">Customer</th>
              <th className="px-4 py-2.5">Type</th>
              <th className="px-4 py-2.5">Due</th>
              <th className="px-4 py-2.5 text-right">Total</th>
              <th className="hidden w-36 px-4 py-2.5 lg:table-cell">Paid</th>
              <th className="px-4 py-2.5 text-right">Balance</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && rows.length === 0 && [0, 1, 2, 3].map((i) => (
              <tr key={i}><td colSpan={9} className="px-4 py-3"><div className="h-8 animate-pulse rounded-lg bg-slate-100" /></td></tr>
            ))}
            {rows.map((i) => {
              const due = dueInfo(i);
              const wa = waReminderHref(i);
              const open = ["GENERATED", "SENT", "PARTIAL", "OVERDUE"].includes(i.status) && Number(i.balanceDue) > 0;
              return (
                <tr key={i.id} className="cursor-pointer transition-colors hover:bg-emerald-50/40" onClick={() => navigate(`/billing/invoices/${i.id}`)}>
                  <td className="px-4 py-3">
                    <div className="font-bold text-slate-800">{i.invoiceNumber}</div>
                    <div className="text-xs text-slate-400">{fmtDay(i.date)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-700">{i.customer?.name}</div>
                    {i.project?.projectName && <div className="text-xs text-slate-400">{i.project.projectName}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{invoiceTypeLabel(i.invoiceType)}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="text-slate-600">{fmtDay(i.dueDate)}</div>
                    {due && <div className={`text-xs ${due.tone}`}>{due.text}</div>}
                  </td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-800">{inr(i.totalAmount)}</td>
                  <td className="hidden px-4 py-3 lg:table-cell"><PaidBar total={i.totalAmount} paid={i.amountPaid} /></td>
                  <td className={`px-4 py-3 text-right font-semibold tabular-nums ${Number(i.balanceDue) > 0 ? "text-rose-600" : "text-slate-400"}`}>{inr(i.balanceDue)}</td>
                  <td className="px-4 py-3"><InvoiceStatusBadge status={i.status} /></td>
                  <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button aria-label="Actions" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><MoreHorizontal className="h-4 w-4" /></button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {open && <DropdownMenuItem onClick={() => navigate(`/billing/invoices/${i.id}?pay=1`)}><IndianRupee className="mr-2 h-4 w-4" /> Record payment</DropdownMenuItem>}
                        <DropdownMenuItem onClick={() => navigate(`/billing/invoices/${i.id}?print=invoice`)}><Printer className="mr-2 h-4 w-4" /> Print A4</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/billing/invoices/${i.id}?print=receipt`)}><Printer className="mr-2 h-4 w-4" /> Print receipt</DropdownMenuItem>
                        {open && wa && <DropdownMenuItem onClick={() => window.open(wa, "_blank", "noopener")}><MessageCircle className="mr-2 h-4 w-4" /> WhatsApp reminder</DropdownMenuItem>}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && rows.length === 0 && <Empty filtered={filtered} />}
      </div>

      {/* Cards (mobile) */}
      <div className="space-y-2.5 md:hidden">
        {rows.map((i) => {
          const due = dueInfo(i);
          return (
            <Link key={i.id} to={`/billing/invoices/${i.id}`} className="block rounded-2xl border bg-white p-4 shadow-sm active:scale-[0.99]">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-bold text-slate-800">{i.invoiceNumber}</span>
                <InvoiceStatusBadge status={i.status} />
              </div>
              <div className="text-sm text-slate-600">{i.customer?.name} · {invoiceTypeLabel(i.invoiceType)}</div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-slate-500">{fmtDay(i.date)}{due ? <span className={` ${due.tone}`}> · {due.text}</span> : null}</span>
                <span className="font-bold tabular-nums">{inr(i.totalAmount)}</span>
              </div>
              {Number(i.balanceDue) > 0 && <div className="mt-1 text-right text-xs font-semibold text-rose-600">Balance {inr(i.balanceDue)}</div>}
            </Link>
          );
        })}
        {!loading && rows.length === 0 && <div className="rounded-2xl border bg-white"><Empty filtered={filtered} /></div>}
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{data.totalElements} invoices · page {page + 1} of {data.totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= data.totalPages - 1} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Empty({ filtered }: { filtered: boolean }) {
  const navigate = useNavigate();
  return (
    <div className="px-6 py-12 text-center">
      <FileText className="mx-auto h-8 w-8 text-slate-300" />
      <p className="mt-2 text-sm font-semibold text-slate-600">{filtered ? "No invoices match these filters" : "No invoices yet"}</p>
      <p className="text-xs text-slate-400">{filtered ? "Try another status or date range." : "Counter sales and project invoices show up here."}</p>
      {!filtered && (
        <Button size="sm" className="mt-3" onClick={() => navigate("/billing/invoices/new")}><Plus className="mr-1 h-4 w-4" /> New invoice</Button>
      )}
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { financeApi } from "@/api/financeApi";
import type { Invoice, PageResp } from "@/types/finance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { currency, INVOICE_STATUS_TONE, INVOICE_STATUS_LABEL, stageLabel } from "./helpers";
import { Plus, Search } from "lucide-react";

const STATUSES = ["", "DRAFT", "GENERATED", "SENT", "PARTIAL", "PAID", "OVERDUE", "CANCELLED"];
const TYPES = ["", "QUOTATION", "ADVANCE", "PROGRESS", "FINAL", "PROFORMA"];

export default function InvoicesPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<PageResp<Invoice> | null>(null);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("");
  const [invoiceType, setInvoiceType] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(() => {
    financeApi.getInvoices({ page, status, invoiceType, search, from, to, size: 15 })
      .then(setData).catch(console.error);
  }, [page, status, invoiceType, search, from, to]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center bg-white border rounded-lg px-3 py-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 mr-2" />
          <input
            className="outline-none text-sm w-full"
            placeholder="Search invoice # or customer…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          />
        </div>
        <select className="border rounded-lg px-3 py-2 text-sm bg-white" value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
          {STATUSES.map((s) => <option key={s} value={s}>{s ? INVOICE_STATUS_LABEL[s as keyof typeof INVOICE_STATUS_LABEL] ?? s : "All Statuses"}</option>)}
        </select>
        <select className="border rounded-lg px-3 py-2 text-sm bg-white" value={invoiceType}
                onChange={(e) => { setInvoiceType(e.target.value); setPage(0); }}>
          {TYPES.map((t) => <option key={t} value={t}>{t || "All Types"}</option>)}
        </select>
        <input type="date" className="border rounded-lg px-3 py-2 text-sm bg-white" value={from}
               onChange={(e) => { setFrom(e.target.value); setPage(0); }} />
        <input type="date" className="border rounded-lg px-3 py-2 text-sm bg-white" value={to}
               onChange={(e) => { setTo(e.target.value); setPage(0); }} />
        <Button onClick={() => navigate("/finance/invoices/new")}>
          <Plus className="w-4 h-4 mr-1" /> New Invoice
        </Button>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white border rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Type / Stage</th>
              <th className="px-4 py-3">Date / Due</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Balance</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(data?.content ?? []).map((i) => (
              <tr key={i.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/finance/invoices/${i.id}`)}>
                <td className="px-4 py-3 font-bold text-slate-800">{i.invoiceNumber}</td>
                <td className="px-4 py-3">{i.customer?.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{i.project?.projectName ?? "—"}</td>
                <td className="px-4 py-3">
                  <div>{i.invoiceType}</div>
                  {i.paymentStage && <div className="text-xs text-muted-foreground">{stageLabel(i.paymentStage)}</div>}
                </td>
                <td className="px-4 py-3">
                  <div>{i.date}</div>
                  {i.dueDate && <div className="text-xs text-muted-foreground">due {i.dueDate}</div>}
                </td>
                <td className="px-4 py-3 text-right font-semibold">{currency(i.totalAmount)}</td>
                <td className="px-4 py-3 text-right font-semibold text-amber-700">{currency(i.balanceDue)}</td>
                <td className="px-4 py-3"><Badge className={INVOICE_STATUS_TONE[i.status]}>{INVOICE_STATUS_LABEL[i.status]}</Badge></td>
              </tr>
            ))}
            {data && data.content.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">No invoices match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile compact cards */}
      <div className="md:hidden space-y-3">
        {(data?.content ?? []).map((i) => (
          <Link key={i.id} to={`/finance/invoices/${i.id}`} className="block bg-white border rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-slate-800">{i.invoiceNumber}</span>
              <Badge className={INVOICE_STATUS_TONE[i.status]}>{INVOICE_STATUS_LABEL[i.status]}</Badge>
            </div>
            <div className="text-sm text-muted-foreground">{i.customer?.name}</div>
            <div className="flex items-center justify-between mt-2 text-sm">
              <span>{i.date}{i.dueDate ? ` · due ${i.dueDate}` : ""}</span>
              <span className="font-bold">{currency(i.totalAmount)}</span>
            </div>
            {i.balanceDue > 0 && (
              <div className="text-xs font-semibold text-amber-700 mt-1">Pending {currency(i.balanceDue)}</div>
            )}
          </Link>
        ))}
        {data && data.content.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground bg-white border rounded-2xl">No invoices match these filters.</div>
        )}
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{data.totalElements} invoices</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= data.totalPages - 1} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, FileText, ArrowRight, CheckCircle, Clock, Split, GitBranch, IndianRupee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import ResponsiveList, { type Column } from "@/components/ui/responsive-list";
import { quotationApi } from "@/api/quotationApi";
import { boqApi } from "@/api/boqApi";
import {
  QUOTATION_STATUS_LABELS, QUOTATION_STATUS_STYLES, type Quotation,
} from "@/types/quotation";
import { QUOTATION_MODE_LABELS, type BoqDashboard } from "@/types/boq";

type StatCard = { label: string; value: string | number | undefined; icon: React.ElementType; className: string };

function formatCurrency(value?: number) {
  if (value === undefined || value === null) return "—";
  return `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function StatusPill({ status }: { status?: string }) {
  return (
    <span className={`px-2 py-1 text-xs rounded-full font-medium whitespace-nowrap ${QUOTATION_STATUS_STYLES[status || ""] || "bg-muted text-muted-foreground"}`}>
      {QUOTATION_STATUS_LABELS[status || ""] || status || "Draft"}
    </span>
  );
}

export default function QuotationList() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<BoqDashboard | null>(null);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchDashboard = useCallback(() => {
    boqApi.dashboard().then(setDashboard).catch(console.error);
  }, []);

  const fetchList = useCallback(() => {
    setLoading(true);
    quotationApi.list({ search: debouncedSearch, page, size: 15 })
      .then((res) => {
        setQuotations(res.content);
        setTotalPages(res.totalPages);
        setTotalElements(res.totalElements);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [debouncedSearch, page]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);
  useEffect(() => { fetchList(); }, [fetchList]);
  useEffect(() => { setPage(0); }, [debouncedSearch]);

  const stats: StatCard[] = useMemo(() => [
    { label: "Approved Quotations", value: dashboard?.approvedQuotations, icon: CheckCircle, className: "bg-green-100 text-green-600" },
    { label: "Pending Quotations", value: dashboard?.pendingQuotations, icon: Clock, className: "bg-amber-100 text-amber-600" },
    { label: "Partial Quotations", value: dashboard?.partialQuotations, icon: Split, className: "bg-emerald-100 text-emerald-600" },
    { label: "Revisions", value: dashboard?.revisionCount, icon: GitBranch, className: "bg-violet-100 text-violet-600" },
    { label: "Approved Value", value: formatCurrency(dashboard?.approvedValue), icon: IndianRupee, className: "bg-emerald-100 text-emerald-600" },
    { label: "Pending Value", value: formatCurrency(dashboard?.pendingValue), icon: IndianRupee, className: "bg-slate-100 text-slate-600" },
  ], [dashboard]);

  const columns: Column<Quotation>[] = [
    { key: "number", header: "Number", cell: (q) => <span className="font-medium text-primary">{q.quotationNumber}</span> },
    { key: "customer", header: "Customer", cell: (q) => <span className="text-sm">{q.customer?.name || "—"}</span> },
    { key: "boq", header: "BOQ", cell: (q) => <span className="text-sm">{q.boq?.boqNumber || "—"}</span> },
    { key: "mode", header: "Mode", cell: (q) => <span className="text-sm">{QUOTATION_MODE_LABELS[q.quotationMode || "FULL_HOUSE"] || "Complete House"}</span> },
    { key: "version", header: "Version", cell: (q) => <span className="text-sm">v{q.revisionNumber ?? 0}</span> },
    { key: "status", header: "Status", cell: (q) => <StatusPill status={q.status} /> },
    { key: "total", header: "Grand Total", headClassName: "text-right", cellClassName: "text-right text-sm font-medium whitespace-nowrap", cell: (q) => formatCurrency(q.grandTotal) },
    {
      key: "actions", header: "", headClassName: "text-right",
      cellClassName: "text-right",
      cell: (q) => (
        <Link to={`/quotations/${q.id}`} onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm"><ArrowRight className="h-4 w-4" /></Button>
        </Link>
      ),
    },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-6 flex flex-col h-full animate-in fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quotations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every quotation is generated from an approved BOQ — full house, partial, or budget-fit.
          </p>
        </div>
        <Link to="/boq">
          <Button><FileText className="mr-2 h-4 w-4" /> Generate from a BOQ</Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="p-3 bg-card rounded-xl border shadow-sm flex items-center gap-3">
            <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${stat.className}`}>
              <stat.icon size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-muted-foreground truncate">{stat.label}</p>
              {dashboard ? (
                <p className="text-xl font-bold leading-tight">{stat.value ?? 0}</p>
              ) : (
                <Skeleton className="h-6 w-10 mt-0.5" />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center space-x-2 bg-card p-1.5 rounded-lg border">
          <Search className="h-5 w-5 text-muted-foreground ml-2" />
          <Input
            placeholder="Search by quotation number, customer, status..."
            className="border-0 shadow-none focus-visible:ring-0 text-base"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <ResponsiveList
        items={quotations}
        loading={loading}
        getRowKey={(q) => q.id!}
        onRowClick={(q) => navigate(`/quotations/${q.id}`)}
        emptyIcon={FileText}
        emptyTitle="No quotations found"
        emptyDescription="Generate one from an approved BOQ."
        columns={columns}
        renderCard={(q) => (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-primary">{q.quotationNumber}</span>
              <StatusPill status={q.status} />
            </div>
            <div className="text-sm">{q.customer?.name || "—"}</div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{q.boq?.boqNumber || "—"} · v{q.revisionNumber ?? 0}</span>
              <span className="text-sm font-semibold text-foreground">{formatCurrency(q.grandTotal)}</span>
            </div>
          </div>
        )}
      />
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {totalElements} quotations · Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}

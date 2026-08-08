import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, FileText, ArrowRight, CheckCircle, Clock, Split, GitBranch, IndianRupee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { quotationApi } from "@/api/quotationApi";
import { boqApi } from "@/api/boqApi";
import {
  QUOTATION_STATUS_LABELS, QUOTATION_STATUS_STYLES, type Quotation,
} from "@/types/quotation";
import type { BoqDashboard } from "@/types/boq";
import EmptyState from "../customer360/components/EmptyState";

type StatCard = { label: string; value: string | number | undefined; icon: React.ElementType; className: string };

function formatCurrency(value?: number) {
  if (value === undefined || value === null) return "—";
  return `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
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
    { label: "Partial Quotations", value: dashboard?.partialQuotations, icon: Split, className: "bg-blue-100 text-blue-600" },
    { label: "Revisions", value: dashboard?.revisionCount, icon: GitBranch, className: "bg-violet-100 text-violet-600" },
    { label: "Approved Value", value: formatCurrency(dashboard?.approvedValue), icon: IndianRupee, className: "bg-emerald-100 text-emerald-600" },
    { label: "Pending Value", value: formatCurrency(dashboard?.pendingValue), icon: IndianRupee, className: "bg-slate-100 text-slate-600" },
  ], [dashboard]);

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

      <div className="border rounded-xl bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>BOQ</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Grand Total</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : quotations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="p-0">
                    <EmptyState icon={FileText} title="No quotations found"
                      description="Generate one from an approved BOQ." />
                  </TableCell>
                </TableRow>
              ) : (
                quotations.map((q) => (
                  <TableRow key={q.id} className="cursor-pointer" onClick={() => navigate(`/quotations/${q.id}`)}>
                    <TableCell className="font-medium text-primary">{q.quotationNumber}</TableCell>
                    <TableCell className="text-sm">{q.customer?.name || "—"}</TableCell>
                    <TableCell className="text-sm">{q.boq?.boqNumber || "—"}</TableCell>
                    <TableCell className="text-sm">{q.quotationMode || "FULL_HOUSE"}</TableCell>
                    <TableCell className="text-sm">v{q.revisionNumber ?? 0}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 text-xs rounded-full font-medium whitespace-nowrap ${QUOTATION_STATUS_STYLES[q.status || ""] || "bg-muted text-muted-foreground"}`}>
                        {QUOTATION_STATUS_LABELS[q.status || ""] || q.status || "Draft"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium whitespace-nowrap">{formatCurrency(q.grandTotal)}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Link to={`/quotations/${q.id}`}>
                        <Button variant="ghost" size="sm"><ArrowRight className="h-4 w-4" /></Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t">
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
    </div>
  );
}

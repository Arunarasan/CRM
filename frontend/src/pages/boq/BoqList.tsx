import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Search, Plus, Filter, ArrowRight, FileSpreadsheet, FileClock, CheckCircle, ClipboardCheck, XCircle, IndianRupee,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { boqApi } from "@/api/boqApi";
import {
  BOQ_STATUSES, BOQ_STATUS_LABELS, BOQ_STATUS_STYLES,
  type Boq, type BoqDashboard, type BoqFilters,
} from "@/types/boq";
import { selectClass } from "../leads/fields";
import EmptyState from "../customer360/components/EmptyState";

const EMPTY_FILTERS: BoqFilters = { status: "", customerId: undefined, projectId: undefined };

type StatCard = { label: string; value: string | number | undefined; icon: React.ElementType; className: string };

function formatCurrency(value?: number) {
  if (value === undefined || value === null) return "—";
  return `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export default function BoqList() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<BoqDashboard | null>(null);
  const [boqs, setBoqs] = useState<Boq[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<BoqFilters>({ ...EMPTY_FILTERS });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchDashboard = useCallback(() => {
    boqApi.dashboard().then(setDashboard).catch(console.error);
  }, []);

  const fetchList = useCallback(() => {
    setLoading(true);
    boqApi.list({ search: debouncedSearch, page, size: 15, filters })
      .then((res) => {
        setBoqs(res.content);
        setTotalPages(res.totalPages);
        setTotalElements(res.totalElements);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [debouncedSearch, page, filters]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);
  useEffect(() => { fetchList(); }, [fetchList]);
  useEffect(() => { setPage(0); }, [debouncedSearch, filters]);

  const stats: StatCard[] = useMemo(() => [
    { label: "Total BOQs", value: dashboard?.totalBoqs, icon: FileSpreadsheet, className: "bg-blue-100 text-blue-600" },
    { label: "Draft", value: dashboard?.draft, icon: FileClock, className: "bg-slate-100 text-slate-600" },
    { label: "Pending Review", value: dashboard?.pendingReview, icon: ClipboardCheck, className: "bg-violet-100 text-violet-600" },
    { label: "Approved", value: dashboard?.approved, icon: CheckCircle, className: "bg-green-100 text-green-600" },
    { label: "Rejected", value: dashboard?.rejected, icon: XCircle, className: "bg-red-100 text-red-600" },
    { label: "BOQ Value", value: formatCurrency(dashboard?.totalBoqValue), icon: IndianRupee, className: "bg-emerald-100 text-emerald-600" },
  ], [dashboard]);

  const setFilter = (key: keyof BoqFilters) => (value: string) =>
    setFilters((f) => ({ ...f, [key]: value }));

  const activeFilterCount = Object.values(filters).filter((v) => v !== "" && v !== undefined).length;

  return (
    <div className="p-6 lg:p-8 space-y-6 flex flex-col h-full animate-in fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bill of Quantities</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Categorized cost estimates from measurements — the foundation for every quotation
          </p>
        </div>
        <Button onClick={() => navigate("/measurements")}>
          <Plus className="mr-2 h-4 w-4" /> Generate from Measurement
        </Button>
      </div>

      {/* KPI Cards */}
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

      {/* Search + filter toggle */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center space-x-2 bg-card p-1.5 rounded-lg border">
          <Search className="h-5 w-5 text-muted-foreground ml-2" />
          <Input
            placeholder="Search by BOQ number, customer, project..."
            className="border-0 shadow-none focus-visible:ring-0 text-base"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant={showFilters ? "secondary" : "outline"} onClick={() => setShowFilters(!showFilters)}>
          <Filter className="mr-2 h-4 w-4" /> Filters
          {activeFilterCount > 0 && (
            <span className="ml-2 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        <div className="flex-1 min-w-0 space-y-4">
          <div className="border rounded-xl bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Customer / Project</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Grand Total</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 7 }).map((_, j) => (
                          <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : boqs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="p-0">
                        <EmptyState icon={FileSpreadsheet} title="No BOQs found"
                          description="Generate a BOQ from a completed measurement, or start a fresh one here." />
                      </TableCell>
                    </TableRow>
                  ) : (
                    boqs.map((b) => (
                      <TableRow key={b.id} className="cursor-pointer" onClick={() => navigate(`/boq/${b.id}`)}>
                        <TableCell className="font-medium">
                          <span className="text-primary">{b.boqNumber}</span>
                          {b.revisionNumber && b.revisionNumber > 1 && (
                            <span className="ml-1 text-xs text-muted-foreground">v{b.revisionNumber}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{b.customer?.name || "—"}</div>
                          <div className="text-xs text-muted-foreground">{b.project?.projectName || ""}</div>
                        </TableCell>
                        <TableCell className="text-sm">v{b.revisionNumber ?? 1}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 text-xs rounded-full font-medium whitespace-nowrap ${BOQ_STATUS_STYLES[b.status || ""] || "bg-muted text-muted-foreground"}`}>
                            {BOQ_STATUS_LABELS[b.status || ""] || b.status || "Draft"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium whitespace-nowrap">
                          {formatCurrency(b.grandTotal)}
                        </TableCell>
                        <TableCell className="text-sm">{b.createdByUser?.name || "—"}</TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <Link to={`/boq/${b.id}`}>
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
                  {totalElements} BOQs · Page {page + 1} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next</Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="w-72 shrink-0 space-y-3 border rounded-xl p-4 bg-card animate-in slide-in-from-right-8 overflow-y-auto max-h-[calc(100vh-380px)]">
            <h3 className="font-semibold border-b pb-2">Advanced Filters</h3>
            <div className="space-y-1">
              <label className="text-sm font-medium">Status</label>
              <select className={selectClass} value={filters.status ?? ""} onChange={(e) => setFilter("status")(e.target.value)}>
                <option value="">All</option>
                {BOQ_STATUSES.map((s) => <option key={s} value={s}>{BOQ_STATUS_LABELS[s] || s}</option>)}
              </select>
            </div>
            <Button className="w-full" variant="outline" onClick={() => setFilters({ ...EMPTY_FILTERS })}>
              Clear Filters
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Search, Plus, Filter, ArrowRight, Ruler, Clock, CheckCircle, ClipboardCheck,
  RotateCcw, CalendarDays, Timer, Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { measurementApi } from "@/api/measurementApi";
import {
  MEASUREMENT_STATUSES, MEASUREMENT_TYPES, MEASUREMENT_PRIORITIES, PRIORITY_STYLES, STATUS_STYLES,
  type Measurement, type MeasurementDashboard, type MeasurementFilters, type UserSummary,
} from "@/types/measurement";
import { selectClass } from "../leads/fields";
import { formatDate } from "./helpers";
import EmptyState from "../customer360/components/EmptyState";

const EMPTY_FILTERS: MeasurementFilters = {
  status: "", measurementType: "", priority: "", engineerId: undefined, dateFrom: "", dateTo: "",
};

type StatCard = { label: string; value: string | number | undefined; icon: React.ElementType; className: string };

export default function MeasurementList() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<MeasurementDashboard | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [engineers, setEngineers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<MeasurementFilters>({ ...EMPTY_FILTERS });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchDashboard = useCallback(() => {
    measurementApi.dashboard().then(setDashboard).catch(console.error);
  }, []);

  const fetchList = useCallback(() => {
    setLoading(true);
    measurementApi.list({ search: debouncedSearch, page, size: 15, filters })
      .then((res) => {
        setMeasurements(res.content);
        setTotalPages(res.totalPages);
        setTotalElements(res.totalElements);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [debouncedSearch, page, filters]);

  useEffect(() => {
    fetchDashboard();
    measurementApi.assignableEmployees().then(setEngineers).catch(console.error);
  }, [fetchDashboard]);

  useEffect(() => { fetchList(); }, [fetchList]);
  useEffect(() => { setPage(0); }, [debouncedSearch, filters]);

  const stats: StatCard[] = useMemo(() => [
    { label: "Today's Measurements", value: dashboard?.todaysMeasurements, icon: CalendarDays, className: "bg-blue-100 text-blue-600" },
    { label: "Pending", value: dashboard?.pending, icon: Clock, className: "bg-amber-100 text-amber-600" },
    { label: "Under Review", value: dashboard?.underReview, icon: ClipboardCheck, className: "bg-violet-100 text-violet-600" },
    { label: "Completed", value: dashboard?.completed, icon: CheckCircle, className: "bg-emerald-100 text-emerald-600" },
    { label: "Approved", value: dashboard?.approved, icon: Award, className: "bg-green-100 text-green-600" },
    { label: "Revision Requests", value: dashboard?.revisionRequests, icon: RotateCcw, className: "bg-red-100 text-red-600" },
    { label: "This Month", value: dashboard?.measurementsThisMonth, icon: Ruler, className: "bg-indigo-100 text-indigo-600" },
    {
      label: "Avg. Completion",
      value: dashboard?.averageCompletionHours != null ? `${dashboard.averageCompletionHours}h` : "—",
      icon: Timer, className: "bg-teal-100 text-teal-600",
    },
  ], [dashboard]);

  const setFilter = (key: keyof MeasurementFilters) => (value: string) =>
    setFilters((f) => ({ ...f, [key]: value }));

  const activeFilterCount = Object.values(filters).filter((v) => v !== "" && v !== undefined).length;

  return (
    <div className="p-6 lg:p-8 space-y-6 flex flex-col h-full animate-in fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Measurement Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Site measurements, rooms and approvals — the foundation for every BOQ and quotation
            {dashboard?.mostActiveEngineer && (
              <> · top engineer this month <span className="font-semibold text-foreground">{dashboard.mostActiveEngineer}</span></>
            )}
          </p>
        </div>
        <Button onClick={() => navigate("/site-visits")}>
          <Plus className="mr-2 h-4 w-4" /> New from Site Visit
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-8 gap-3">
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
            placeholder="Search by measurement number, customer, project, engineer..."
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
                    <TableHead>Type</TableHead>
                    <TableHead>Engineer</TableHead>
                    <TableHead>Rooms</TableHead>
                    <TableHead className="text-right">Total Area</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 10 }).map((_, j) => (
                          <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : measurements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="p-0">
                        <EmptyState icon={Ruler} title="No measurements found"
                          description="Measurements start from a site visit — open one and use Create Measurement." />
                      </TableCell>
                    </TableRow>
                  ) : (
                    measurements.map((m) => (
                      <TableRow key={m.id} className="cursor-pointer" onClick={() => navigate(`/measurements/${m.id}`)}>
                        <TableCell className="font-medium">
                          <span className="text-primary">{m.measurementNumber}</span>
                          {m.revisionNumber && m.revisionNumber > 1 && (
                            <span className="ml-1 text-xs text-muted-foreground">v{m.revisionNumber}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{m.customer?.name || "—"}</div>
                          <div className="text-xs text-muted-foreground">{m.project?.projectName || ""}</div>
                        </TableCell>
                        <TableCell className="text-sm">{m.measurementType || "—"}</TableCell>
                        <TableCell className="text-sm">{m.assignedEngineer?.name || "Unassigned"}</TableCell>
                        <TableCell className="text-sm">{m.roomCount ?? "—"}</TableCell>
                        <TableCell className="text-right text-sm font-medium whitespace-nowrap">
                          {m.totalArea ? `${m.totalArea} sq.ft` : "—"}
                        </TableCell>
                        <TableCell>
                          {m.priority && (
                            <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full font-bold ${PRIORITY_STYLES[m.priority] || ""}`}>
                              {m.priority}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 text-xs rounded-full font-medium whitespace-nowrap ${STATUS_STYLES[m.status || ""] || "bg-muted text-muted-foreground"}`}>
                            {m.status || "Draft"}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">{formatDate(m.measurementDate)}</TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <Link to={`/measurements/${m.id}`}>
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
                  {totalElements} measurements · Page {page + 1} of {totalPages}
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
            {[
              { label: "Status", key: "status" as const, options: MEASUREMENT_STATUSES },
              { label: "Type", key: "measurementType" as const, options: MEASUREMENT_TYPES },
              { label: "Priority", key: "priority" as const, options: MEASUREMENT_PRIORITIES },
            ].map(({ label, key, options }) => (
              <div key={key} className="space-y-1">
                <label className="text-sm font-medium">{label}</label>
                <select className={selectClass} value={(filters[key] as string) ?? ""} onChange={(e) => setFilter(key)(e.target.value)}>
                  <option value="">All</option>
                  {options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
            <div className="space-y-1">
              <label className="text-sm font-medium">Engineer</label>
              <select className={selectClass} value={filters.engineerId ?? ""} onChange={(e) => setFilter("engineerId")(e.target.value)}>
                <option value="">All</option>
                {engineers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">From</label>
                <Input type="date" value={filters.dateFrom ?? ""} onChange={(e) => setFilter("dateFrom")(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">To</label>
                <Input type="date" value={filters.dateTo ?? ""} onChange={(e) => setFilter("dateTo")(e.target.value)} />
              </div>
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

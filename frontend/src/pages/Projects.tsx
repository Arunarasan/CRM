import { useState, useEffect, useMemo } from "react";
import api from "@/lib/api";
import { projectApi } from "@/api/projectApi";
import { ProjectModuleDashboard } from "@/types/project";
import {
  Search, Activity, AlertTriangle, ListChecks, CheckCircle2, LayoutGrid, List,
  Filter, Plus, MoreHorizontal, ChevronRight, ChevronLeft, FolderKanban, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import ResponsiveList, { type Column } from "@/components/ui/responsive-list";
import FilterSheet from "@/components/ui/filter-sheet";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";

type SegmentKey = "all" | "new" | "inProgress" | "completed" | "onHold" | "unassigned";

interface SegmentCounts {
  all: number;
  new: number;
  inProgress: number;
  completed: number;
  onHold: number;
  unassigned: number;
}

interface ProjectRow {
  id: number;
  projectCode?: string;
  projectName: string;
  projectType?: string;
  customer?: { id: number; name?: string };
  projectManager?: { id: number; name?: string };
  status: string;
  progress: number;
  startDate?: string;
  endDate?: string;
  taskTotal?: number;
  taskDone?: number;
}

// Tab key -> backend `category` param (empty for "all").
const SEGMENT_CATEGORY: Record<SegmentKey, string> = {
  all: "",
  new: "NEW",
  inProgress: "IN_PROGRESS",
  completed: "COMPLETED",
  onHold: "ON_HOLD",
  unassigned: "UNASSIGNED",
};

const SEGMENTS: { key: SegmentKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "inProgress", label: "In Progress" },
  { key: "completed", label: "Completed" },
  { key: "onHold", label: "On Hold" },
  { key: "unassigned", label: "Team Not Assigned" },
];

// Status pill styling — soft tints that read the same in light and dark.
const statusStyle = (status: string): string => {
  switch (status?.toUpperCase()) {
    case "PLANNING":
    case "PENDING":
    case "APPROVED":
      return "bg-violet-500/10 text-violet-600 dark:text-violet-400";
    case "RUNNING":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    case "PAUSED":
    case "ON_HOLD":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
    case "COMPLETED":
    case "CLOSED":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    case "CANCELLED":
      return "bg-rose-500/10 text-rose-600 dark:text-rose-400";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const humanize = (s?: string) =>
  (s || "").split("_").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");

const initials = (name?: string) =>
  (name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";

const formatDate = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const isOverdue = (endDate?: string, status?: string) => {
  if (!endDate) return false;
  const done = ["COMPLETED", "CLOSED", "CANCELLED"].includes((status || "").toUpperCase());
  if (done) return false;
  const d = new Date(endDate);
  return !isNaN(d.getTime()) && d.getTime() < Date.now();
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={`${statusStyle(status)} border-transparent`}>{humanize(status)}</Badge>
  );
}

function ProgressBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{v}%</span>
      </div>
      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-1.5 rounded-full transition-all ${v >= 100 ? "bg-emerald-500" : "bg-emerald-500"}`}
          style={{ width: `${v}%` }}
        />
      </div>
    </div>
  );
}

function Owner({ pm }: { pm?: { name?: string } }) {
  if (!pm?.name) return <span className="text-xs text-muted-foreground">Unassigned</span>;
  return (
    <div className="flex items-center gap-2">
      <span className="h-7 w-7 shrink-0 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">
        {initials(pm.name)}
      </span>
      <span className="text-sm truncate">{pm.name}</span>
    </div>
  );
}

/** Small styled native select that matches the toolbar pill look in both themes. */
function FilterSelect({
  value, onChange, options, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-card border rounded-lg pl-3 pr-8 h-9 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="h-4 w-4 text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [dashboard, setDashboard] = useState<ProjectModuleDashboard | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "board">("list");
  const [segment, setSegment] = useState<SegmentKey>("all");
  const [counts, setCounts] = useState<SegmentCounts | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Client-side refinements over the current page.
  const [customerFilter, setCustomerFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(0); }, [debouncedSearch, segment, size]);

  useEffect(() => {
    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, page, size, segment]);

  useEffect(() => {
    projectApi.dashboard().then(setDashboard).catch((err) => console.error("Failed to fetch project dashboard", err));
    api.get(`/projects/segment-counts`).then((res) => setCounts(res.data)).catch((err) => console.error("Failed to fetch segment counts", err));
  }, []);

  const fetchProjects = () => {
    setLoading(true);
    const category = SEGMENT_CATEGORY[segment];
    const params = new URLSearchParams({ search: debouncedSearch, page: String(page), size: String(size) });
    if (category) params.set("category", category);
    api.get(`/projects?${params.toString()}`)
      .then((res) => {
        setProjects(res.data.content);
        setTotalPages(res.data.totalPages);
        setTotalElements(res.data.totalElements ?? res.data.content.length);
      })
      .catch((err) => console.error("Failed to fetch projects", err))
      .finally(() => setLoading(false));
  };

  const selectSegment = (key: SegmentKey) => {
    if (key === segment) return;
    setSegment(key);
    setPage(0);
    setCustomerFilter("");
    setOwnerFilter("");
  };

  // Distinct customers/owners in the loaded page, for the toolbar dropdowns.
  const customerOptions = useMemo(() => {
    const set = new Map<string, string>();
    projects.forEach((p) => { if (p.customer?.name) set.set(p.customer.name, p.customer.name); });
    return Array.from(set.values()).sort().map((v) => ({ value: v, label: v }));
  }, [projects]);

  const ownerOptions = useMemo(() => {
    const set = new Map<string, string>();
    projects.forEach((p) => { if (p.projectManager?.name) set.set(p.projectManager.name, p.projectManager.name); });
    return Array.from(set.values()).sort().map((v) => ({ value: v, label: v }));
  }, [projects]);

  const visible = useMemo(() => projects.filter((p) =>
    (!customerFilter || p.customer?.name === customerFilter) &&
    (!ownerFilter || p.projectManager?.name === ownerFilter)
  ), [projects, customerFilter, ownerFilter]);

  const activeFilterCount = (customerFilter ? 1 : 0) + (ownerFilter ? 1 : 0);

  const kpis = [
    { label: "Running", value: dashboard?.runningProjects ?? 0, icon: Activity, tint: "bg-emerald-500/10 text-emerald-500" },
    { label: "Completed", value: dashboard?.completedProjects ?? 0, icon: CheckCircle2, tint: "bg-emerald-500/10 text-emerald-500" },
    { label: "Delayed", value: dashboard?.delayedProjects ?? 0, icon: AlertTriangle, tint: "bg-rose-500/10 text-rose-500" },
    { label: "Pending Tasks", value: dashboard?.pendingTasks ?? 0, icon: ListChecks, tint: "bg-amber-500/10 text-amber-500" },
  ];

  const columns: Column<ProjectRow>[] = [
    {
      key: "project", header: "Project",
      cell: (p) => (
        <div className="min-w-0">
          {p.projectCode && <div className="text-[11px] font-mono text-muted-foreground">{p.projectCode}</div>}
          <div className="font-medium text-primary truncate">{p.projectName}</div>
          {p.customer?.name && <div className="text-xs text-muted-foreground truncate">{p.customer.name}</div>}
        </div>
      ),
    },
    { key: "type", header: "Type", cell: (p) => <span className="text-sm text-muted-foreground">{p.projectType || "—"}</span> },
    { key: "status", header: "Status", cell: (p) => <StatusBadge status={p.status} /> },
    { key: "progress", header: "Progress", headClassName: "w-40", cellClassName: "w-40", cell: (p) => <ProgressBar value={p.progress} /> },
    { key: "owner", header: "Owner", cell: (p) => <Owner pm={p.projectManager} /> },
    { key: "start", header: "Start Date", cellClassName: "whitespace-nowrap", cell: (p) => <span className="text-sm text-muted-foreground">{formatDate(p.startDate)}</span> },
    {
      key: "end", header: "End Date", cellClassName: "whitespace-nowrap",
      cell: (p) => (
        <span className={`text-sm ${isOverdue(p.endDate, p.status) ? "text-rose-600 dark:text-rose-400 font-medium" : "text-muted-foreground"}`}>
          {formatDate(p.endDate)}
        </span>
      ),
    },
    {
      key: "tasks", header: "Tasks", cellClassName: "whitespace-nowrap",
      cell: (p) => (
        <span className="text-sm tabular-nums">
          <span className="font-medium text-foreground">{p.taskDone ?? 0}</span>
          <span className="text-muted-foreground"> / {p.taskTotal ?? 0}</span>
        </span>
      ),
    },
    {
      key: "actions", header: "", headClassName: "text-right", cellClassName: "text-right",
      cell: (p) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onSelect={() => navigate(`/projects/${p.id}`)}>Open project</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate(`/tasks?projectId=${p.id}`)}>View tasks</DropdownMenuItem>
            {p.customer?.id && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate(`/customers/${p.customer!.id}`)}>View customer</DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const from = totalElements === 0 ? 0 : page * size + 1;
  const to = page * size + projects.length;

  // Board columns group the loaded page by status category.
  const boardColumns: { key: SegmentKey; label: string; match: (s: string) => boolean }[] = [
    { key: "new", label: "New", match: (s) => ["PLANNING", "PENDING", "APPROVED"].includes(s) },
    { key: "inProgress", label: "In Progress", match: (s) => ["RUNNING"].includes(s) },
    { key: "onHold", label: "On Hold", match: (s) => ["PAUSED", "ON_HOLD"].includes(s) },
    { key: "completed", label: "Completed", match: (s) => ["COMPLETED", "CLOSED"].includes(s) },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Project Portfolio</h1>
          <p className="text-sm text-muted-foreground mt-0.5">An overview of your active work</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-card p-1 rounded-lg border">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
            >
              <List className="h-4 w-4" /> <span className="hidden sm:inline">List</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("board")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === "board" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
            >
              <LayoutGrid className="h-4 w-4" /> <span className="hidden sm:inline">Board</span>
            </button>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button><Plus className="mr-1.5 h-4 w-4" /> New Project <ChevronDown className="ml-1 h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => navigate("/quotations")}>Convert from Quotation</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate("/leads")}>Start from Lead</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {kpis.map(({ label, value, icon: Icon, tint }) => (
          <div key={label} className="bg-card p-4 sm:p-5 rounded-xl border flex items-center gap-3 sm:gap-4">
            <div className={`p-2.5 sm:p-3 rounded-lg ${tint}`}><Icon className="h-5 w-5" /></div>
            <div>
              <div className="text-xl sm:text-2xl font-bold">{value}</div>
              <div className="text-xs font-medium text-muted-foreground">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar: search + dropdowns + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-card px-3 h-9 rounded-lg border">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            placeholder="Search projects or customers..."
            className="border-0 shadow-none focus-visible:ring-0 text-sm bg-transparent h-8 px-0"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <FilterSelect value={SEGMENT_CATEGORY[segment]} onChange={(v) => {
          const key = (Object.keys(SEGMENT_CATEGORY) as SegmentKey[]).find((k) => SEGMENT_CATEGORY[k] === v) ?? "all";
          selectSegment(key);
        }} options={SEGMENTS.filter((s) => s.key !== "all").map((s) => ({ value: SEGMENT_CATEGORY[s.key], label: s.label }))} placeholder="All Status" />
        <FilterSelect value={customerFilter} onChange={setCustomerFilter} options={customerOptions} placeholder="All Customers" />
        <FilterSelect value={ownerFilter} onChange={setOwnerFilter} options={ownerOptions} placeholder="All Owners" />
        <Button variant={activeFilterCount > 0 ? "secondary" : "outline"} className="h-9" onClick={() => setShowFilters(true)}>
          <Filter className="mr-2 h-4 w-4" /> Filters
          {activeFilterCount > 0 && (
            <span className="ml-2 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">{activeFilterCount}</span>
          )}
        </Button>
      </div>

      {/* Quick status tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {SEGMENTS.map(({ key, label }) => {
          const active = segment === key;
          const count = counts ? counts[key] : undefined;
          return (
            <button
              key={key}
              type="button"
              onClick={() => selectSegment(key)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:bg-accent"}`}
            >
              {label}
              {count !== undefined && (
                <span className={`text-[11px] px-1.5 rounded-full font-semibold ${active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {viewMode === "list" ? (
        <ResponsiveList
          items={visible}
          loading={loading}
          getRowKey={(p) => p.id}
          onRowClick={(p) => navigate(`/projects/${p.id}`)}
          emptyIcon={FolderKanban}
          emptyTitle="No projects found"
          emptyDescription="No projects match your search or filters."
          columns={columns}
          renderCard={(p) => (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1.5 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {p.projectCode && <span className="text-[11px] font-mono text-muted-foreground">{p.projectCode}</span>}
                  <StatusBadge status={p.status} />
                </div>
                <div className="font-semibold text-primary truncate">{p.projectName}</div>
                {p.customer?.name && <div className="text-sm text-muted-foreground truncate">{p.customer.name}</div>}
                <ProgressBar value={p.progress} />
                <div className="flex items-center justify-between gap-2 pt-1">
                  <Owner pm={p.projectManager} />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    Tasks {p.taskDone ?? 0}/{p.taskTotal ?? 0}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground pt-0.5">
                  <span>Start {formatDate(p.startDate)}</span>
                  <span className={isOverdue(p.endDate, p.status) ? "text-rose-600 dark:text-rose-400 font-medium" : ""}>End {formatDate(p.endDate)}</span>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            </div>
          )}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {boardColumns.map((col) => {
            const items = visible.filter((p) => col.match((p.status || "").toUpperCase()));
            return (
              <div key={col.key} className="bg-muted/40 rounded-xl border p-3 flex flex-col">
                <div className="flex items-center justify-between px-1 pb-2 mb-1 border-b">
                  <span className="text-sm font-semibold">{col.label}</span>
                  <span className="text-xs font-medium text-muted-foreground bg-card rounded-full px-2 py-0.5 border">{items.length}</span>
                </div>
                <div className="space-y-2.5 min-h-[80px]">
                  {items.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => navigate(`/projects/${p.id}`)}
                      className="w-full text-left bg-card rounded-lg border p-3 hover:shadow-sm hover:-translate-y-0.5 transition-all"
                    >
                      {p.projectCode && <div className="text-[11px] font-mono text-muted-foreground">{p.projectCode}</div>}
                      <div className="font-medium text-sm truncate">{p.projectName}</div>
                      {p.customer?.name && <div className="text-xs text-muted-foreground truncate mb-2">{p.customer.name}</div>}
                      <ProgressBar value={p.progress} />
                      <div className="flex items-center justify-between mt-2">
                        <Owner pm={p.projectManager} />
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap">{p.taskDone ?? 0}/{p.taskTotal ?? 0}</span>
                      </div>
                    </button>
                  ))}
                  {items.length === 0 && <div className="text-xs text-muted-foreground text-center py-6">No projects</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {viewMode === "list" && totalElements > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="text-muted-foreground">
            Showing <span className="font-medium text-foreground">{from}</span> to <span className="font-medium text-foreground">{to}</span> of <span className="font-medium text-foreground">{totalElements}</span> projects
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Rows</span>
              <FilterSelect
                value={String(size)}
                onChange={(v) => setSize(Number(v) || 10)}
                options={[{ value: "10", label: "10" }, { value: "25", label: "25" }, { value: "50", label: "50" }]}
                placeholder="10"
              />
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-2 text-muted-foreground">Page {page + 1} of {totalPages}</span>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Filters sheet (mobile-friendly mirror of the dropdowns) */}
      <FilterSheet
        open={showFilters}
        onClose={() => setShowFilters(false)}
        activeCount={activeFilterCount}
        onClear={() => { setCustomerFilter(""); setOwnerFilter(""); }}
      >
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Customer</label>
          <FilterSelect value={customerFilter} onChange={setCustomerFilter} options={customerOptions} placeholder="All Customers" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Owner</label>
          <FilterSelect value={ownerFilter} onChange={setOwnerFilter} options={ownerOptions} placeholder="All Owners" />
        </div>
        <p className="text-xs text-muted-foreground">Customer & owner filters apply to the projects on this page.</p>
      </FilterSheet>
    </div>
  );
}

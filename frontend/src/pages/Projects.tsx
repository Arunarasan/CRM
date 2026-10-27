import { useState, useEffect, useMemo, useRef } from "react";
import api from "@/lib/api";
import { projectApi } from "@/api/projectApi";
import { ProjectModuleDashboard } from "@/types/project";
import {
  Search, Activity, AlertTriangle, IndianRupee, LayoutGrid, List,
  Filter, Plus, MoreHorizontal, ChevronRight, ChevronLeft, FolderKanban, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import ResponsiveList, { type Column } from "@/components/ui/responsive-list";
import FilterSheet from "@/components/ui/filter-sheet";
import SettleProjectDialog, { canSettleProjects } from "@/pages/projectCommandCenter/SettleProjectDialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useNavigate, useSearchParams } from "react-router-dom";

type SegmentKey = "all" | "new" | "inProgress" | "completed" | "fullyPaid" | "onHold" | "unassigned" | "delayed" | "pendingCollection";

interface SegmentCounts {
  pendingCollection?: number;
  all: number;
  new: number;
  inProgress: number;
  completed: number;
  fullyPaid: number;
  onHold: number;
  unassigned: number;
  delayed: number;
}

type PendingSummary = Record<string, { count: number; amount: number }>;

interface ProjectRow {
  id: number;
  projectCode?: string;
  projectName: string;
  projectType?: string;
  customer?: { id: number; name?: string; companyName?: string; city?: string };
  projectManager?: { id: number; name?: string };
  status: string;
  progress: number;
  startDate?: string;
  endDate?: string;
  workCategories?: string[];
  workProducts?: string[];
  workStage?: "EXECUTION" | "READY_TO_FIT" | "COMPLETED" | null;
  taskTotal?: number;
  taskDone?: number;
  outstandingAmount?: number;
  projectValue?: number;
}

// Tab key -> backend `category` param (empty for "all").
const SEGMENT_CATEGORY: Record<SegmentKey, string> = {
  all: "",
  new: "NEW",
  inProgress: "IN_PROGRESS",
  completed: "COMPLETED",
  fullyPaid: "FULLY_PAID",
  onHold: "ON_HOLD",
  unassigned: "UNASSIGNED",
  delayed: "DELAYED",
  pendingCollection: "PENDING_COLLECTION",
};

const SEGMENTS: { key: SegmentKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "inProgress", label: "In Progress" },
  { key: "completed", label: "Completed" },
  { key: "fullyPaid", label: "Fully Paid" },
  { key: "onHold", label: "On Hold" },
  { key: "unassigned", label: "Team Not Assigned" },
];

const initials = (name?: string) =>
  (name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";

const STAGES: Record<string, { label: string; cls: string }> = {
  EXECUTION: { label: "Execution", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  READY_TO_FIT: { label: "Ready to Fit", cls: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  COMPLETED: { label: "Completed", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
};

function StageBadge({ stage }: { stage?: string | null }) {
  const st = stage ? STAGES[stage] : undefined;
  if (!st) return <span className="text-sm text-muted-foreground">—</span>;
  return <Badge className={`${st.cls} border-transparent whitespace-nowrap`}>{st.label}</Badge>;
}

/** Comma list that stays on one line and shows the full text on hover. */
function NameList({ items }: { items?: string[] }) {
  if (!items?.length) return <span className="text-sm text-muted-foreground">—</span>;
  const text = items.join(", ");
  return <span className="text-sm block max-w-[220px] truncate" title={text}>{text}</span>;
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

// Filters/search/page survive opening a project and coming back (session-scoped).
const PROJECTS_VIEW_KEY = "crm.projects.view";
function loadProjectsView(): Record<string, any> {
  try { return JSON.parse(sessionStorage.getItem(PROJECTS_VIEW_KEY) || "{}") || {}; } catch { return {}; }
}

export default function Projects() {
  const navigate = useNavigate();
  const [saved] = useState(loadProjectsView);
  const lastQuery = useRef<string | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState<string>(saved.search || "");
  const [debouncedSearch, setDebouncedSearch] = useState<string>(saved.search || "");
  const [page, setPage] = useState<number>(saved.page || 0);
  const [size, setSize] = useState<number>(saved.size || 10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [dashboard, setDashboard] = useState<ProjectModuleDashboard | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "board">(saved.viewMode === "board" ? "board" : "list");
  const [searchParams] = useSearchParams();
  const [segment, setSegment] = useState<SegmentKey>(() => {
    const s = searchParams.get("segment") as SegmentKey | null;
    if (s && s !== "pendingCollection" && s in SEGMENT_CATEGORY) return s;
    return saved.segment && saved.segment !== "pendingCollection" && saved.segment in SEGMENT_CATEGORY ? saved.segment : "all";
  });
  const [counts, setCounts] = useState<SegmentCounts | null>(null);
  // "Pending to Collect" is a filter that combines with the status tabs (e.g. Completed + pending).
  const [pendingOnly, setPendingOnly] = useState<boolean>(() => !!saved.pendingOnly || searchParams.get("segment") === "pendingCollection");
  const [pendingSummary, setPendingSummary] = useState<PendingSummary | null>(null);
  const loadPendingSummary = () => {
    api.get(`/projects/pending-summary`).then((res) => setPendingSummary(res.data)).catch(() => {});
  };
  const [showFilters, setShowFilters] = useState<boolean>(!!saved.showFilters);
  const [settleId, setSettleId] = useState<number | null>(null);

  // Client-side refinements over the current page.
  const [customerFilter, setCustomerFilter] = useState<string>(saved.customerFilter || "");
  const [ownerFilter, setOwnerFilter] = useState<string>(saved.ownerFilter || "");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const key = `${debouncedSearch}|${segment}|${size}|${pendingOnly}`;
    const prev = lastQuery.current;
    lastQuery.current = key;
    if (prev !== null && prev !== key) setPage(0); // only a real filter change resets the page, not a restore
  }, [debouncedSearch, segment, size, pendingOnly]);

  useEffect(() => {
    try {
      sessionStorage.setItem(PROJECTS_VIEW_KEY, JSON.stringify({ viewMode, search, page, size, segment, pendingOnly, showFilters, customerFilter, ownerFilter }));
    } catch { /* storage unavailable */ }
  }, [viewMode, search, page, size, segment, pendingOnly, showFilters, customerFilter, ownerFilter]);

  useEffect(() => {
    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, page, size, segment, pendingOnly]);

  useEffect(() => {
    projectApi.dashboard().then(setDashboard).catch((err) => console.error("Failed to fetch project dashboard", err));
    api.get(`/projects/segment-counts`).then((res) => setCounts(res.data)).catch((err) => console.error("Failed to fetch segment counts", err));
    loadPendingSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchProjects = () => {
    setLoading(true);
    const category = SEGMENT_CATEGORY[segment];
    const params = new URLSearchParams({ search: debouncedSearch, page: String(page), size: String(size) });
    if (category) params.set("category", category);
    if (pendingOnly) params.set("pendingOnly", "true");
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

  // KPI tiles double as quick filters — clicking one drives the list segment (or navigates).
  const kpis: {
    label: string; value: number; money?: boolean; icon: typeof Activity; tint: string; ring: string;
    segment?: SegmentKey; pending?: boolean; onClick?: () => void;
  }[] = [
    { label: "Active Projects", value: dashboard?.activeProjects ?? 0, icon: Activity, tint: "bg-emerald-500/10 text-emerald-500", ring: "ring-emerald-500", segment: "all" },
    { label: "Delayed", value: dashboard?.delayedProjects ?? 0, icon: AlertTriangle, tint: "bg-rose-500/10 text-rose-500", ring: "ring-rose-500", segment: "delayed" },
    { label: "Pending to Collect", value: pendingSummary?.[segment]?.amount ?? dashboard?.pendingToCollect ?? 0, money: true, icon: IndianRupee, tint: "bg-amber-500/10 text-amber-500", ring: "ring-amber-500", pending: true },
  ];

  const onKpiClick = (kpi: (typeof kpis)[number]) => {
    if (kpi.onClick) { kpi.onClick(); return; }
    if (kpi.pending) { setPendingOnly((v) => !v); setViewMode("list"); return; }
    if (!kpi.segment) return;
    selectSegment(segment === kpi.segment ? "all" : kpi.segment);
    setViewMode("list");
  };

  const columns: Column<ProjectRow>[] = [
    { key: "customer", header: "Customer", cell: (p) => <span className="text-sm">{p.customer?.name || "—"}</span> },
    { key: "city", header: "City", cell: (p) => <span className="text-sm text-muted-foreground">{p.customer?.city || "—"}</span> },
    { key: "category", header: "Category", cell: (p) => <NameList items={p.workCategories} /> },
    { key: "product", header: "Product", cell: (p) => <NameList items={p.workProducts} /> },
    { key: "stage", header: "Stage", cell: (p) => <StageBadge stage={p.workStage} /> },
    {
      key: "value", header: "Project Value", headClassName: "text-right", cellClassName: "whitespace-nowrap text-right",
      cell: (p: ProjectRow) => (
        <span className="text-sm font-semibold tabular-nums">
          {p.projectValue != null ? `₹${Math.round(p.projectValue).toLocaleString("en-IN")}` : "—"}
        </span>
      ),
    },
    {
      key: "outstanding", header: "Pending", headClassName: "text-right", cellClassName: "whitespace-nowrap text-right",
      cell: (p: ProjectRow) => {
        const owed = Math.round(p.outstandingAmount ?? 0);
        return (
          <span className={`text-sm font-semibold tabular-nums ${owed > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
            ₹{owed.toLocaleString("en-IN")}
          </span>
        );
      },
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
            {canSettleProjects() && String(p.status).toUpperCase() !== "CANCELLED" && (
              <DropdownMenuItem onSelect={() => setSettleId(p.id)}>Settle &amp; complete</DropdownMenuItem>
            )}
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

  // Board columns group the loaded page by the 3-stage work state.
  const boardColumns: { key: string; label: string; match: (stage?: string | null) => boolean }[] = [
    { key: "none", label: "Not Started", match: (st) => !st },
    { key: "execution", label: "Execution", match: (st) => st === "EXECUTION" },
    { key: "fit", label: "Ready to Fit", match: (st) => st === "READY_TO_FIT" },
    { key: "done", label: "Completed", match: (st) => st === "COMPLETED" },
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

      {/* KPI row — tiles double as quick filters */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {kpis.map((kpi) => {
          const { label, value, money, icon: Icon, tint, ring, segment: seg, pending: isPending } = kpi;
          const active = isPending ? pendingOnly : seg ? segment === seg : false;
          return (
            <button
              key={label}
              type="button"
              onClick={() => onKpiClick(kpi)}
              title={isPending ? (pendingOnly ? "Show all projects" : "Show only projects with pending payment") : seg ? `Show ${label} projects` : `Go to ${label}`}
              aria-pressed={active}
              className={`bg-card p-4 sm:p-5 rounded-xl border flex items-center gap-3 sm:gap-4 text-left transition-all hover:border-foreground/20 hover:shadow-sm ${active ? `ring-2 ${ring}` : ""}`}
            >
              <div className={`p-2.5 sm:p-3 rounded-lg ${tint}`}><Icon className="h-5 w-5" /></div>
              <div>
                <div className="text-xl sm:text-2xl font-bold">{money ? `₹${Math.round(value).toLocaleString("en-IN")}` : value}</div>
                <div className="text-xs font-medium text-muted-foreground">
                  {label}{isPending && pendingSummary?.[segment] ? ` · ${pendingSummary[segment].count} project${pendingSummary[segment].count === 1 ? "" : "s"}` : ""}
                </div>
              </div>
            </button>
          );
        })}
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
          const count = pendingOnly ? pendingSummary?.[key]?.count : counts ? counts[key] : undefined;
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
                  <StageBadge stage={p.workStage} />
                </div>
                {p.customer?.name && <div className="font-semibold text-foreground truncate">{p.customer.name}</div>}
                {p.customer?.city && <div className="text-xs text-muted-foreground truncate">{p.customer.city}</div>}
                {!!p.workCategories?.length && (
                  <div className="text-xs text-muted-foreground truncate">Category: {p.workCategories.join(", ")}</div>
                )}
                {!!p.workProducts?.length && (
                  <div className="text-xs text-muted-foreground truncate">Product: {p.workProducts.join(", ")}</div>
                )}
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            </div>
          )}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {boardColumns.map((col) => {
            const items = visible.filter((p) => col.match(p.workStage));
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
                      className="w-full text-left bg-card rounded-lg border p-3"
                    >
                      {p.projectCode && <div className="text-[11px] font-mono text-muted-foreground">{p.projectCode}</div>}
                      <div className="font-medium text-sm truncate">{p.projectName}</div>
                      {p.customer?.name && <div className="text-xs text-muted-foreground truncate mb-2">{p.customer.name}</div>}
                      {!!p.workCategories?.length && <div className="text-[11px] text-muted-foreground truncate">{p.workCategories.join(", ")}</div>}
                      {!!p.workProducts?.length && <div className="text-[11px] text-muted-foreground truncate mb-2">{p.workProducts.join(", ")}</div>}
                      <Owner pm={p.projectManager} />
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
      <SettleProjectDialog projectId={settleId} open={settleId !== null} onClose={() => setSettleId(null)}
        onDone={() => {
          fetchProjects();
          projectApi.dashboard().then(setDashboard).catch(() => {});
          api.get(`/projects/segment-counts`).then((res) => setCounts(res.data)).catch(() => {});
          loadPendingSummary();
        }} />
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import {
  Search, Plus, Filter, LayoutGrid, List, Clock, Users, Sparkles,
  ThermometerSun, CheckCircle, XCircle, PhoneCall, MapPin, CalendarDays,
  Target, Mail, Phone, CalendarPlus, MoreVertical, ChevronLeft, ChevronRight,
  RotateCcw, TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import ResponsiveList, { type Column } from "@/components/ui/responsive-list";
import FilterSheet from "@/components/ui/filter-sheet";
import { useHoverInfo, InfoRow } from "@/components/ui/hover-info";
import api from "@/lib/api";
import { leadApi } from "./leads/leadApi";
import LeadFormDialog from "./leads/LeadFormDialog";
import { selectClass } from "./leads/fields";
import { CATEGORY_GROUPS, EnquiryTag, categoryGroupOf, enquiryDetails, enquiryTypeOf } from "./leads/enquiry";
import {
  BOARD_DROP_STATUS, EMPTY_FILTERS, ENQUIRY_TYPES, formatFollowUp, LEAD_SOURCES, LEAD_STAGES, LEAD_STATUSES, LEAD_TYPES,
  PRIORITIES, TEMPERATURES, TEMPERATURE_STYLES, avatarColor, followUpTone,
  formatINR, initials, relativeTime, statusStyle, type BoardColumn,
  type DashboardMetrics, type Lead, type LeadFilters, type LeadPeriodStats, type UserSummary,
} from "./leads/constants";

// Website catalog rows used by the enquiry filters (same source as the lead form's pickers).
type CatalogCategory = { id: number; name: string; slug: string };
type CatalogProduct = { id: number; name: string; categorySlug?: string };
type CatalogService = { id: number; title: string };

// Time-frame partitions for the lead-entry / conversion stats. Each resolves to an ISO from/to range.
type PeriodKey = "TODAY" | "WEEK" | "MONTH" | "YEAR" | "ALL";
const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "TODAY", label: "Today" },
  { key: "WEEK", label: "This Week" },
  { key: "MONTH", label: "This Month" },
  { key: "YEAR", label: "This Year" },
  { key: "ALL", label: "All Time" },
];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function periodRange(key: PeriodKey): { from?: string; to?: string } {
  const now = new Date();
  const to = iso(now);
  if (key === "ALL") return {};
  if (key === "TODAY") return { from: to, to };
  if (key === "WEEK") {
    const day = now.getDay(); // 0=Sun..6=Sat → start on Monday
    const monday = new Date(now); monday.setDate(now.getDate() - ((day + 6) % 7));
    return { from: iso(monday), to };
  }
  if (key === "MONTH") return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to };
  return { from: iso(new Date(now.getFullYear(), 0, 1)), to }; // YEAR
}

// Requirement categories a lead can tick, mapped to their boolean flag on the Lead.
const REQUIREMENT_CATEGORIES: { key: keyof Lead; label: string }[] = [
  { key: "reqKitchen", label: "Kitchen" },
  { key: "reqWardrobe", label: "Wardrobe" },
  { key: "reqTvUnit", label: "TV Unit" },
  { key: "reqFalseCeiling", label: "False Ceiling" },
  { key: "reqPainting", label: "Painting" },
  { key: "reqFlooring", label: "Flooring" },
  { key: "reqElectrical", label: "Electrical" },
  { key: "reqPlumbing", label: "Plumbing" },
  { key: "reqWoodFinish", label: "Wood Finish" },
];

type StatCard = {
  label: string;
  value: number | string | undefined;
  icon: React.ElementType;
  className: string; // icon chip colour
  ring: string;      // active-state ring/border colour
  patch: Partial<LeadFilters>; // filter applied when this card is clicked
};

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

// The KPI cards act as quick-filter tabs; clicking one drives exactly these filter keys
// (and clears the others among them), so the cards stay mutually exclusive.
const SEGMENT_KEYS: (keyof LeadFilters)[] = ["status", "stage", "isConverted", "followUpDue"];

/** Rich card shown when hovering a lead row. */
function LeadInfo({ l }: { l: Lead }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-bold text-slate-800 truncate">{l.name}</div>
          <div className="font-mono text-[11px] text-slate-400">{l.leadNumber}</div>
        </div>
        {l.leadTemperature && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${TEMPERATURE_STYLES[l.leadTemperature] || "bg-muted text-muted-foreground"}`}>
            {l.leadTemperature}
          </span>
        )}
      </div>
      <div className="divide-y divide-slate-100">
        <div className="pb-1.5">
          <InfoRow label="Stage" value={l.stage || l.status} />
          <InfoRow label="Source" value={l.leadSource} />
          {l.leadOwner?.name && <InfoRow label="Added by" value={l.leadOwner.name} />}
          <InfoRow label="Type" value={l.leadType} />
          <InfoRow label="Company" value={l.companyName} />
        </div>
        <div className="py-1.5">
          <InfoRow label="Mobile" value={l.mobileNumber} />
          <InfoRow label="Email" value={l.email} />
          <InfoRow label="Location" value={[l.city, l.state].filter(Boolean).join(", ")} />
        </div>
        <div className="pt-1.5">
          <InfoRow label="Owner" value={l.assignedSalesExecutive?.name || "Unassigned"} />
          <InfoRow label="Est. budget" value={l.estimatedBudget ? formatINR(l.estimatedBudget) : undefined} accent="text-slate-900 font-bold" />
          <InfoRow label="Next follow-up" value={l.nextFollowUpDate ? formatFollowUp(l.nextFollowUpDate, l.nextFollowUpTime) : undefined} />
          <InfoRow label="Last contact" value={l.lastContactAt ? relativeTime(l.lastContactAt) : undefined} />
        </div>
      </div>
    </div>
  );
}

export default function Leads() {
  const navigate = useNavigate();
  const info = useHoverInfo();
  const [viewMode, setViewMode] = useState<"kanban" | "table">("table");
  const [dashboard, setDashboard] = useState<DashboardMetrics | null>(null);
  const [board, setBoard] = useState<BoardColumn[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<LeadFilters>({ ...EMPTY_FILTERS });
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [period, setPeriod] = useState<PeriodKey>("MONTH");
  const [periodStats, setPeriodStats] = useState<LeadPeriodStats | null>(null);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [services, setServices] = useState<CatalogService[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<{ category: string | null; count: number }[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchDashboard = useCallback(() => {
    leadApi.dashboard().then((res) => setDashboard(res.data)).catch(console.error);
    leadApi.categoryCounts().then((res) => setCategoryCounts(res.data || [])).catch(() => {});
  }, []);

  const fetchBoard = useCallback(() => {
    setLoading(true);
    leadApi.board(filters.assignedEmployeeId || undefined)
      .then((res) => setBoard(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filters.assignedEmployeeId]);

  const fetchList = useCallback(() => {
    setLoading(true);
    // A category card is sent as the concrete category names that fall in it (Others = none of
    // the main groups' names, or no category at all).
    const { categoryGroup, ...rest } = filters;
    const apiFilters: Record<string, string> = { ...rest };
    // Lost leads only appear when the Lost card / status filter is picked.
    if (rest.status !== "Lost") apiFilters.hideLost = "true";
    if (categoryGroup) {
      const names = Array.from(new Set([
        ...categoryCounts.map((c) => c.category).filter((c): c is string => !!c),
        ...categories.map((c) => c.name),
      ]));
      if (categoryGroup === "OTHERS") {
        apiFilters.categoryNotIn = names.filter((n) => categoryGroupOf(n) !== "OTHERS").join(",");
      } else {
        apiFilters.categoryIn = names.filter((n) => categoryGroupOf(n) === categoryGroup).join(",") || "__none__";
      }
    }
    leadApi.list({ search: debouncedSearch, page, size: rowsPerPage, filters: apiFilters as Partial<LeadFilters> })
      .then((res) => {
        setLeads(res.data.content);
        setTotalPages(res.data.totalPages);
        setTotalElements(res.data.totalElements);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [debouncedSearch, page, rowsPerPage, filters, categoryCounts, categories]);

  useEffect(() => {
    fetchDashboard();
    leadApi.assignableUsers().then((res) => setUsers(res.data)).catch(console.error);
    api.get("/public/categories").then((res) => setCategories(res.data || [])).catch(() => {});
    api.get("/public/products").then((res) => setProducts(res.data || [])).catch(() => {});
    api.get("/public/services").then((res) => setServices(res.data || [])).catch(() => {});
  }, [fetchDashboard]);

  // Time-boxed entry / conversion stats for the selected partition.
  useEffect(() => {
    const { from, to } = periodRange(period);
    setPeriodStats(null);
    leadApi.stats(from, to).then((res) => setPeriodStats(res.data)).catch(console.error);
  }, [period]);

  useEffect(() => {
    if (viewMode === "kanban") fetchBoard();
    else fetchList();
  }, [viewMode, fetchBoard, fetchList]);

  useEffect(() => { setPage(0); }, [debouncedSearch, filters, rowsPerPage]);

  const refresh = () => {
    fetchDashboard();
    if (viewMode === "kanban") fetchBoard();
    else fetchList();
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;
    if (source.droppableId === destination.droppableId) return;

    const leadId = parseInt(draggableId, 10);
    const newStatus = BOARD_DROP_STATUS[destination.droppableId];
    if (!newStatus) return;

    // optimistic move
    setBoard((prev) => {
      const next = prev.map((col) => ({ ...col, leads: [...col.leads] }));
      const from = next.find((c) => c.key === source.droppableId);
      const to = next.find((c) => c.key === destination.droppableId);
      if (!from || !to) return prev;
      const idx = from.leads.findIndex((l) => l.id === leadId);
      if (idx === -1) return prev;
      const [card] = from.leads.splice(idx, 1);
      card.status = newStatus;
      to.leads.splice(destination.index, 0, card);
      from.count--; to.count++;
      return next;
    });

    leadApi.updateStatus(leadId, newStatus)
      .then(() => fetchDashboard())
      .catch(() => fetchBoard());
  };

  const stats: StatCard[] = useMemo(() => [
    { label: "Total Leads", value: dashboard?.totalLeads, icon: Users, className: "bg-emerald-100 text-emerald-600", ring: "ring-emerald-500 border-emerald-500", patch: {} },
    { label: "New", value: dashboard?.newLeads, icon: Sparkles, className: "bg-emerald-100 text-emerald-600", ring: "ring-emerald-500 border-emerald-500", patch: { status: "New" } },
    { label: "Contacted", value: dashboard?.contactedLeads, icon: PhoneCall, className: "bg-violet-100 text-violet-600", ring: "ring-violet-500 border-violet-500", patch: { status: "Contacted" } },
    { label: "Interested", value: dashboard?.interestedLeads, icon: ThermometerSun, className: "bg-purple-100 text-purple-600", ring: "ring-purple-500 border-purple-500", patch: { status: "Interested" } },
    { label: "Site Visit", value: dashboard?.todaySiteVisits, icon: MapPin, className: "bg-cyan-100 text-cyan-600", ring: "ring-cyan-500 border-cyan-500", patch: { stage: "Site Visit" } },
    { label: "Converted", value: dashboard?.convertedLeads, icon: CheckCircle, className: "bg-green-100 text-green-600", ring: "ring-green-500 border-green-500", patch: { isConverted: "true" } },
    { label: "Lost", value: dashboard?.lostLeads, icon: XCircle, className: "bg-rose-100 text-rose-600", ring: "ring-rose-500 border-rose-500", patch: { status: "Lost" } },
    { label: "Follow-ups", value: dashboard?.pendingFollowups, icon: CalendarDays, className: "bg-orange-100 text-orange-600", ring: "ring-orange-500 border-orange-500", patch: { followUpDue: "true" } },
  ], [dashboard]);

  const groupCounts = useMemo(() => {
    const out: Record<string, number> = {};
    categoryCounts.forEach((c) => { const g = categoryGroupOf(c.category); out[g] = (out[g] || 0) + Number(c.count); });
    return out;
  }, [categoryCounts]);

  const setFilter = (key: keyof LeadFilters) => (value: string) =>
    setFilters((f) => ({ ...f, [key]: value }));

  // Switching category drops a product that isn't in it, so the two filters never contradict.
  const selectedCategory = categories.find((c) => c.name === filters.category);
  const categoryProducts = products.filter((p) => !selectedCategory || p.categorySlug === selectedCategory.slug);
  const setCategory = (value: string) => setFilters((f) => {
    const cat = categories.find((c) => c.name === value);
    const keep = !cat || products.some((p) => p.name === f.product && p.categorySlug === cat.slug);
    return { ...f, category: value, product: keep ? f.product : "" };
  });

  // A card is active when the filters match its patch across all segment keys.
  const isStatActive = (patch: Partial<LeadFilters>) =>
    SEGMENT_KEYS.every((k) => (filters[k] || "") === ((patch[k] as string) || ""));

  const onStatClick = (patch: Partial<LeadFilters>) => {
    // Clicking the active card (other than "Total") toggles back to all leads.
    const target = isStatActive(patch) ? {} : patch;
    setFilters((f) => {
      const next = { ...f };
      SEGMENT_KEYS.forEach((k) => { next[k] = ""; });
      return { ...next, ...target };
    });
    setViewMode("table");
  };

  const activeFilterCount = Object.values(filters).filter((v) => v !== "").length;

  const tempPill = (t?: string) =>
    t ? <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${TEMPERATURE_STYLES[t] || "bg-muted text-muted-foreground"}`}>{t}</span> : <span className="text-xs text-muted-foreground">—</span>;

  // Requirement shown as compact pills: the catalog category (+ products) picked on the
  // lead form, plus any legacy scope checkboxes the lead ticked.
  const requirementPills = (l: Lead) => {
    const products = (l.requirementProduct || "").split(",").map((s) => s.trim()).filter(Boolean);
    const reqs = [
      ...(l.requirementCategory ? [{ key: "requirementCategory", label: l.requirementCategory }] : []),
      ...products.map((p) => ({ key: `product-${p}`, label: p })),
      ...enquiryDetails(l).map((d) => ({ key: `service-${d}`, label: d })),
      ...REQUIREMENT_CATEGORIES.filter(({ key }) => l[key]),
    ];
    const tag = enquiryTypeOf(l);
    if (reqs.length === 0 && !tag) return <span className="text-xs text-muted-foreground">—</span>;
    // With more than 2 requirements, lay them out in a 2-column grid so they wrap onto 2 lines.
    const layout = reqs.length > 2 ? "grid grid-cols-2 max-w-[14rem]" : "flex flex-wrap";
    return (
      <div className={`gap-1 ${layout}`}>
        {tag && <EnquiryTag type={tag} className="text-center" />}
        {reqs.map(({ key, label }) => (
          <span key={key} className="px-2 py-0.5 text-xs rounded-full font-medium whitespace-nowrap bg-emerald-100 text-emerald-700 text-center">
            {label}
          </span>
        ))}
      </div>
    );
  };

  const columns: Column<Lead>[] = [
    {
      key: "lead", header: "Lead Details", cell: (l) => (
        <div className="min-w-[9rem]">
          <div className="font-semibold text-foreground truncate">{l.name}</div>
          {(l.city || l.state) && (
            <div className="text-xs text-muted-foreground truncate">{[l.city, l.state].filter(Boolean).join(", ")}</div>
          )}
        </div>
      ),
    },
    {
      key: "contact", header: "Contact", cell: (l) => (
        <div className="space-y-0.5 min-w-[9rem]">
          <a href={`tel:${l.mobileNumber}`} onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 text-sm hover:text-primary">
            <Phone className="h-3 w-3 text-muted-foreground shrink-0" /> {l.mobileNumber}
          </a>
          {l.email && (
            <a href={`mailto:${l.email}`} onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary truncate">
              <Mail className="h-3 w-3 shrink-0" /> <span className="truncate">{l.email}</span>
            </a>
          )}
        </div>
      ),
    },
    { key: "requirements", header: "Requirements", cell: (l) => requirementPills(l) },
    {
      key: "source", header: "Source", cellClassName: "whitespace-nowrap", cell: (l) => (
        <div className="text-xs">
          <div className="text-foreground">{l.leadSource || "—"}</div>
          {l.leadOwner?.name && (
            <div className="text-muted-foreground">by {l.leadOwner.name}</div>
          )}
        </div>
      ),
    },
    {
      key: "status", header: "Status", cellClassName: "whitespace-nowrap", cell: (l) => (
        <span className={`px-2 py-0.5 text-[11px] rounded-full font-semibold ${statusStyle(l.status)}`}>
          {l.status || "—"}
        </span>
      ),
    },
    {
      key: "next", header: "Next Follow-up", cellClassName: "whitespace-nowrap text-sm", cell: (l) => {
        const t = followUpTone(l.nextFollowUpDate, l.nextFollowUpTime);
        return <span className={t.className}>{t.label}</span>;
      },
    },
    {
      key: "actions", header: "", headClassName: "text-right", cellClassName: "text-right", cell: (l) => (
        <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          <a href={`tel:${l.mobileNumber}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Call">
              <PhoneCall className="h-4 w-4" />
            </Button>
          </a>
          <Link to={`/leads/${l.id}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Schedule follow-up">
              <CalendarPlus className="h-4 w-4" />
            </Button>
          </Link>
          <Link to={`/leads/${l.id}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="More">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      ),
    },
  ];

  const showingFrom = totalElements === 0 ? 0 : page * rowsPerPage + 1;
  const showingTo = Math.min((page + 1) * rowsPerPage, totalElements);

  return (
    <div className={`p-4 lg:p-6 space-y-3 flex flex-col animate-in fade-in ${viewMode === "kanban" ? "h-full" : ""}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lead Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage and track leads across all stages
            {dashboard && <> · conversion rate <span className="font-semibold text-foreground">{dashboard.conversionRate}</span></>}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex bg-muted p-1 rounded-lg border">
            <Button variant={viewMode === "kanban" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("kanban")}>
              <LayoutGrid className="h-4 w-4 mr-2" /> Pipeline
            </Button>
            <Button variant={viewMode === "table" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("table")}>
              <List className="h-4 w-4 mr-2" /> List
            </Button>
          </div>
          <Button variant={activeFilterCount > 0 ? "secondary" : "outline"} onClick={() => setShowFilters(true)}>
            <Filter className="mr-2 h-4 w-4" /> Filter
            {activeFilterCount > 0 && (
              <span className="ml-2 bg-primary text-primary-foreground text-xs rounded-full h-5 min-w-5 px-1 flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </Button>
          <Button onClick={() => setIsAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Lead
          </Button>
        </div>
      </div>

      {/* Time-frame partition — leads entered & conversion rate for the selected period */}
      <div className="rounded-xl border bg-card p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriod(p.key)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  period === p.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {[
              { icon: Sparkles, label: "Leads entered", value: periodStats?.entered, tone: "text-blue-600 bg-blue-100" },
              { icon: CheckCircle, label: "Converted", value: periodStats?.converted, tone: "text-green-600 bg-green-100" },
              { icon: XCircle, label: "Lost", value: periodStats?.lost, tone: "text-rose-600 bg-rose-100" },
              { icon: TrendingUp, label: "Conversion rate", value: periodStats?.conversionRate, tone: "text-primary bg-primary/10" },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-2">
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${s.tone}`}>
                  <s.icon size={15} />
                </span>
                <div className="leading-tight">
                  {periodStats ? (
                    <p className="text-lg font-bold">{s.value ?? 0}</p>
                  ) : (
                    <Skeleton className="h-6 w-10" />
                  )}
                  <p className="text-[11px] font-medium text-muted-foreground">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* KPI cards — double as quick-filter tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2">
        {stats.map((stat) => {
          const active = isStatActive(stat.patch);
          return (
            <button
              key={stat.label}
              type="button"
              onClick={() => onStatClick(stat.patch)}
              title={`Show ${stat.label} leads`}
              aria-pressed={active}
              className={`p-2 bg-card rounded-lg border text-left flex items-center gap-2 shadow-sm transition-all hover:border-foreground/20 hover:shadow ${active ? `ring-2 ${stat.ring}` : ""}`}
            >
              <div className={`h-7 w-7 rounded-md flex items-center justify-center shrink-0 ${stat.className}`}>
                <stat.icon size={14} />
              </div>
              <div className="min-w-0">
                {dashboard ? (
                  <p className="text-lg font-bold leading-none">{stat.value ?? 0}</p>
                ) : (
                  <Skeleton className="h-5 w-6" />
                )}
                <p className="text-[11px] font-medium text-muted-foreground truncate leading-tight mt-0.5">{stat.label}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main product category cards — click to filter, click again to clear */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {CATEGORY_GROUPS.map((g) => {
          const active = filters.categoryGroup === g.key;
          return (
            <button
              key={g.key}
              type="button"
              onClick={() => setFilter("categoryGroup")(active ? "" : g.key)}
              title={`Show ${g.label} leads`}
              aria-pressed={active}
              className={`p-2 bg-card rounded-lg border text-left flex items-center gap-2 shadow-sm transition-all hover:border-foreground/20 hover:shadow ${active ? "ring-2 ring-primary" : ""}`}
            >
              <div className={`h-7 w-7 rounded-md flex items-center justify-center shrink-0 ${g.tone}`}>
                <g.icon size={14} />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold leading-none">{groupCounts[g.key] ?? 0}</p>
                <p className="text-[11px] font-medium text-muted-foreground truncate leading-tight mt-0.5">{g.label}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Toolbar: search + inline filters (single row on desktop) */}
      <div className="flex flex-wrap md:flex-nowrap items-center gap-2">
        <div className="flex-1 min-w-[180px] flex items-center gap-2 bg-card px-3 rounded-lg border h-10">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            placeholder="Search leads..."
            className="border-0 shadow-none focus-visible:ring-0 h-9 px-0 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {viewMode === "table" && (
          <div className="flex items-center gap-2 shrink-0 overflow-x-auto">
            <select className={`${selectClass} w-auto min-w-[6.5rem] shrink-0`} value={filters.enquiryType} onChange={(e) => setFilter("enquiryType")(e.target.value)}>
              <option value="">All Types</option>
              {ENQUIRY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select className={`${selectClass} w-auto min-w-[6.5rem] max-w-[11rem] shrink-0`} value={filters.category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All Categories</option>
              {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <select className={`${selectClass} w-auto min-w-[6.5rem] shrink-0`} value={filters.stage} onChange={(e) => setFilter("stage")(e.target.value)}>
              <option value="">All Stages</option>
              {LEAD_STAGES.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <select className={`${selectClass} w-auto min-w-[6.5rem] shrink-0`} value={filters.source} onChange={(e) => setFilter("source")(e.target.value)}>
              <option value="">All Sources</option>
              {LEAD_SOURCES.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <select className={`${selectClass} w-auto min-w-[6.5rem] shrink-0`} value={filters.assignedEmployeeId} onChange={(e) => setFilter("assignedEmployeeId")(e.target.value)}>
              <option value="">All Owners</option>
              {users.map((u) => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
            </select>
          </div>
        )}
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" className="shrink-0" onClick={() => { setFilters({ ...EMPTY_FILTERS }); setSearch(""); }}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset
          </Button>
        )}
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        <div className="flex-1 min-w-0 flex flex-col min-h-0 gap-4">
          {viewMode === "kanban" ? (
            loading && board.length === 0 ? (
              <div className="flex gap-4 overflow-x-auto pb-4 flex-1 min-h-[420px]">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="w-80 h-full min-h-[420px] flex-shrink-0 rounded-xl" />
                ))}
              </div>
            ) : (
              <DragDropContext onDragEnd={onDragEnd}>
                <div className="flex gap-4 overflow-x-auto pb-4 flex-1 min-h-[420px]">
                  {board.map((column) => (
                    <div key={column.key} className="w-80 flex-shrink-0 bg-muted/50 rounded-xl p-3 flex flex-col h-full border">
                      <div className="mb-3 px-1">
                        <h3 className="font-semibold text-sm flex items-center justify-between">
                          {column.key}
                          <span className="bg-background px-2 py-0.5 rounded-full text-xs text-muted-foreground border">
                            {column.count}
                          </span>
                        </h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{formatINR(column.totalValue)}</p>
                      </div>
                      <Droppable droppableId={column.key}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`flex-1 space-y-2.5 overflow-y-auto pr-1 transition-colors rounded-lg ${snapshot.isDraggingOver ? "bg-muted/80" : ""}`}
                          >
                            {column.leads.length === 0 && !snapshot.isDraggingOver && (
                              <div className="text-center text-xs text-muted-foreground py-8 border border-dashed rounded-lg">
                                No leads
                              </div>
                            )}
                            {column.leads.map((card, index) => (
                              <Draggable key={card.id} draggableId={String(card.id)} index={index}>
                                {(dragProvided, dragSnapshot) => (
                                  <div
                                    ref={dragProvided.innerRef}
                                    {...dragProvided.draggableProps}
                                    {...dragProvided.dragHandleProps}
                                    className={`bg-card p-3 rounded-lg border shadow-sm ${dragSnapshot.isDragging ? "shadow-lg ring-1 ring-primary" : ""}`}
                                  >
                                    <div className="flex justify-between items-start gap-2 mb-1">
                                      <Link to={`/leads/${card.id}`} className="font-medium text-sm hover:underline hover:text-primary truncate">
                                        {card.name}
                                      </Link>
                                      {card.leadTemperature && (
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${TEMPERATURE_STYLES[card.leadTemperature] || ""}`}>
                                          {card.leadTemperature}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-muted-foreground">{card.leadNumber}</div>
                                    <div className="text-xs text-muted-foreground truncate">
                                      {card.companyName || card.mobileNumber}{card.city ? ` · ${card.city}` : ""}
                                    </div>
                                    {card.leadType && (
                                      <span className="inline-block mt-1.5 text-[10px] px-1.5 py-0.5 bg-muted rounded-full">{card.leadType}</span>
                                    )}
                                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                                      <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> {card.nextFollowUpDate ? formatFollowUp(card.nextFollowUpDate, card.nextFollowUpTime) : "No follow-up"}
                                      </span>
                                      <span className="font-semibold text-foreground">{formatINR(card.estimatedBudget)}</span>
                                    </div>
                                    {card.assignedToName && (
                                      <div className="mt-1.5 text-[11px] text-muted-foreground truncate">👤 {card.assignedToName}</div>
                                    )}
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  ))}
                </div>
              </DragDropContext>
            )
          ) : (
            <>
              <ResponsiveList
                items={leads}
                loading={loading}
                getRowKey={(l) => l.id}
                onRowClick={(l) => navigate(`/leads/${l.id}`)}
                getRowProps={(l) => info.bind(<LeadInfo l={l} />)}
                emptyIcon={Target}
                emptyTitle="No leads found"
                emptyDescription="No leads match your search or filters."
                columns={columns}
                renderCard={(l) => (
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[11px] font-mono text-muted-foreground">{l.leadNumber}</div>
                        <div className="font-semibold text-foreground truncate">{l.name}</div>
                        {(l.city || l.state) && (
                          <div className="text-xs text-muted-foreground truncate">{[l.city, l.state].filter(Boolean).join(", ")}</div>
                        )}
                      </div>
                      {tempPill(l.leadTemperature)}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {requirementPills(l)}
                      {l.leadSource && <span className="text-xs text-muted-foreground">{l.leadSource}</span>}
                      {l.leadOwner?.name && <span className="text-xs text-muted-foreground">· by {l.leadOwner.name}</span>}
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-semibold ${avatarColor(l.assignedSalesExecutive?.name)}`}>
                          {initials(l.assignedSalesExecutive?.name)}
                        </span>
                        {l.assignedSalesExecutive?.name || "Unassigned"}
                      </span>
                      <span className={followUpTone(l.nextFollowUpDate).className}>
                        {followUpTone(l.nextFollowUpDate, l.nextFollowUpTime).label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 pt-1 border-t text-sm" onClick={(e) => e.stopPropagation()}>
                      <a href={`tel:${l.mobileNumber}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-primary">
                        <Phone className="h-3.5 w-3.5" /> {l.mobileNumber}
                      </a>
                      <span className={`ml-auto px-2 py-0.5 text-[11px] rounded-full font-semibold ${statusStyle(l.status)}`}>
                        {l.status || "—"}
                      </span>
                    </div>
                  </div>
                )}
              />
              {/* Pagination footer */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                <span>
                  Showing <span className="font-medium text-foreground">{showingFrom}</span> to{" "}
                  <span className="font-medium text-foreground">{showingTo}</span> of{" "}
                  <span className="font-medium text-foreground">{totalElements}</span> leads
                </span>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span>Rows per page</span>
                    <select
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                      value={rowsPerPage}
                      onChange={(e) => setRowsPerPage(Number(e.target.value))}
                    >
                      {ROWS_PER_PAGE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-9 w-9" disabled={page === 0} onClick={() => setPage(page - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="px-2 min-w-[3rem] text-center text-foreground font-medium">
                      {page + 1} / {Math.max(totalPages, 1)}
                    </span>
                    <Button variant="outline" size="icon" className="h-9 w-9" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <FilterSheet
        open={showFilters}
        onClose={() => setShowFilters(false)}
        activeCount={activeFilterCount}
        onClear={() => setFilters({ ...EMPTY_FILTERS })}
      >
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Enquiry Type</label>
          <div className="flex flex-wrap gap-1.5">
            {[{ value: "", label: "All" }, ...ENQUIRY_TYPES].map((t) => (
              <button key={t.value} type="button" onClick={() => setFilter("enquiryType")(t.value)}
                className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                  filters.enquiryType === t.value ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Product Category</label>
          <select className={selectClass} value={filters.category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All</option>
            {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Product</label>
          <select className={selectClass} value={filters.product} onChange={(e) => setFilter("product")(e.target.value)}>
            <option value="">All</option>
            {categoryProducts.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Service</label>
          <select className={selectClass} value={filters.service} onChange={(e) => setFilter("service")(e.target.value)}>
            <option value="">All</option>
            {services.map((sv) => <option key={sv.id} value={sv.title}>{sv.title}</option>)}
          </select>
        </div>
        {[
          { label: "Lead Source", key: "source" as const, options: LEAD_SOURCES },
          { label: "Lead Type", key: "leadType" as const, options: LEAD_TYPES },
          { label: "Status", key: "status" as const, options: LEAD_STATUSES },
          { label: "Stage", key: "stage" as const, options: LEAD_STAGES },
          { label: "Priority", key: "priority" as const, options: PRIORITIES },
          { label: "Temperature", key: "temperature" as const, options: TEMPERATURES },
        ].map(({ label, key, options }) => (
          <div key={key} className="space-y-1.5">
            <label className="text-sm font-medium">{label}</label>
            <select className={selectClass} value={filters[key]} onChange={(e) => setFilter(key)(e.target.value)}>
              <option value="">All</option>
              {options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        ))}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Assigned Employee</label>
          <select className={selectClass} value={filters.assignedEmployeeId} onChange={(e) => setFilter("assignedEmployeeId")(e.target.value)}>
            <option value="">All</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Conversion</label>
          <select className={selectClass} value={filters.isConverted} onChange={(e) => setFilter("isConverted")(e.target.value)}>
            <option value="">Any</option>
            <option value="false">Open Leads</option>
            <option value="true">Converted</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Budget Min</label>
            <Input type="number" inputMode="numeric" value={filters.budgetMin} onChange={(e) => setFilter("budgetMin")(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Budget Max</label>
            <Input type="number" inputMode="numeric" value={filters.budgetMax} onChange={(e) => setFilter("budgetMax")(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">From</label>
            <Input type="date" value={filters.dateFrom} onChange={(e) => setFilter("dateFrom")(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">To</label>
            <Input type="date" value={filters.dateTo} onChange={(e) => setFilter("dateTo")(e.target.value)} />
          </div>
        </div>
      </FilterSheet>

      <LeadFormDialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        users={users}
        onSaved={() => refresh()}
      />
      {info.portal}
    </div>
  );
}

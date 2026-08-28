import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import {
  Search, Plus, Filter, LayoutGrid, List, Clock, Users, Sparkles,
  ThermometerSun, CheckCircle, XCircle, PhoneCall, MapPin, CalendarDays,
  Target, Mail, Phone, CalendarPlus, MoreVertical, ChevronLeft, ChevronRight,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import ResponsiveList, { type Column } from "@/components/ui/responsive-list";
import FilterSheet from "@/components/ui/filter-sheet";
import { leadApi } from "./leads/leadApi";
import LeadFormDialog from "./leads/LeadFormDialog";
import { selectClass } from "./leads/fields";
import {
  BOARD_DROP_STATUS, EMPTY_FILTERS, LEAD_SOURCES, LEAD_STAGES, LEAD_STATUSES, LEAD_TYPES,
  PRIORITIES, TEMPERATURES, TEMPERATURE_STYLES, avatarColor, followUpTone, formatDate,
  formatINR, initials, relativeTime, stageStyle, statusStyle, type BoardColumn,
  type DashboardMetrics, type Lead, type LeadFilters, type UserSummary,
} from "./leads/constants";

type StatCard = {
  label: string;
  value: number | string | undefined;
  icon: React.ElementType;
  className: string;
};

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

export default function Leads() {
  const navigate = useNavigate();
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
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchDashboard = useCallback(() => {
    leadApi.dashboard().then((res) => setDashboard(res.data)).catch(console.error);
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
    leadApi.list({ search: debouncedSearch, page, size: rowsPerPage, filters })
      .then((res) => {
        setLeads(res.data.content);
        setTotalPages(res.data.totalPages);
        setTotalElements(res.data.totalElements);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [debouncedSearch, page, rowsPerPage, filters]);

  useEffect(() => {
    fetchDashboard();
    leadApi.assignableUsers().then((res) => setUsers(res.data)).catch(console.error);
  }, [fetchDashboard]);

  useEffect(() => {
    if (viewMode === "kanban") fetchBoard();
    else fetchList();
  }, [viewMode, fetchBoard, fetchList]);

  useEffect(() => { setPage(0); }, [debouncedSearch, filters, rowsPerPage]);
  useEffect(() => { setSelected(new Set()); }, [leads]);

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
    { label: "Total Leads", value: dashboard?.totalLeads, icon: Users, className: "bg-emerald-100 text-emerald-600" },
    { label: "New", value: dashboard?.newLeads, icon: Sparkles, className: "bg-emerald-100 text-emerald-600" },
    { label: "Contacted", value: dashboard?.contactedLeads, icon: PhoneCall, className: "bg-violet-100 text-violet-600" },
    { label: "Interested", value: dashboard?.interestedLeads, icon: ThermometerSun, className: "bg-purple-100 text-purple-600" },
    { label: "Site Visit", value: dashboard?.todaySiteVisits, icon: MapPin, className: "bg-cyan-100 text-cyan-600" },
    { label: "Converted", value: dashboard?.convertedLeads, icon: CheckCircle, className: "bg-green-100 text-green-600" },
    { label: "Lost", value: dashboard?.lostLeads, icon: XCircle, className: "bg-rose-100 text-rose-600" },
    { label: "Follow-ups", value: dashboard?.pendingFollowups, icon: CalendarDays, className: "bg-orange-100 text-orange-600" },
  ], [dashboard]);

  const setFilter = (key: keyof LeadFilters) => (value: string) =>
    setFilters((f) => ({ ...f, [key]: value }));

  const activeFilterCount = Object.values(filters).filter((v) => v !== "").length;

  const tempPill = (t?: string) =>
    t ? <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${TEMPERATURE_STYLES[t] || "bg-muted text-muted-foreground"}`}>{t}</span> : <span className="text-xs text-muted-foreground">—</span>;

  const stagePill = (l: Lead) => {
    const label = l.stage || l.status;
    return <span className={`px-2 py-0.5 text-xs rounded-full font-medium whitespace-nowrap ${stageStyle(l.stage) === "bg-muted text-muted-foreground" ? statusStyle(l.status) : stageStyle(l.stage)}`}>{label}</span>;
  };

  const toggleRow = (id: number) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const allSelected = leads.length > 0 && leads.every((l) => selected.has(l.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(leads.map((l) => l.id)));

  const columns: Column<Lead>[] = [
    {
      key: "select",
      header: (
        <input type="checkbox" className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
          checked={allSelected} onChange={toggleAll} onClick={(e) => e.stopPropagation()} aria-label="Select all" />
      ),
      headClassName: "w-8",
      cellClassName: "w-8",
      cell: (l) => (
        <input type="checkbox" className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
          checked={selected.has(l.id)} onChange={() => toggleRow(l.id)} onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${l.name}`} />
      ),
    },
    {
      key: "lead", header: "Lead Details", cell: (l) => (
        <div className="min-w-[9rem]">
          <div className="text-[11px] font-mono text-muted-foreground">{l.leadNumber}</div>
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
    { key: "stage", header: "Stage", cell: (l) => stagePill(l) },
    { key: "source", header: "Source", cellClassName: "text-sm text-muted-foreground whitespace-nowrap", cell: (l) => l.leadSource || "—" },
    {
      key: "owner", header: "Owner", cell: (l) => {
        const name = l.assignedSalesExecutive?.name;
        return (
          <div className="flex items-center gap-2 min-w-[7rem]">
            <span className={`h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 ${avatarColor(name)}`}>
              {initials(name)}
            </span>
            <span className="text-sm truncate">{name || <span className="text-muted-foreground">Unassigned</span>}</span>
          </div>
        );
      },
    },
    {
      key: "activity", header: "Last Activity", cellClassName: "whitespace-nowrap", cell: (l) => (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
          {relativeTime(l.lastContactAt || l.lastFollowUp || l.updatedAt || l.createdAt)}
        </span>
      ),
    },
    {
      key: "next", header: "Next Follow-up", cellClassName: "whitespace-nowrap text-sm", cell: (l) => {
        const t = followUpTone(l.nextFollowUpDate);
        return <span className={t.className}>{t.label}</span>;
      },
    },
    { key: "status", header: "Status", cell: (l) => tempPill(l.leadTemperature) },
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
    <div className={`p-6 lg:p-8 space-y-5 flex flex-col animate-in fade-in ${viewMode === "kanban" ? "h-full" : ""}`}>
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="p-3 bg-card rounded-xl border shadow-sm flex items-center gap-2.5">
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${stat.className}`}>
              <stat.icon size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-muted-foreground truncate">{stat.label}</p>
              {dashboard ? (
                <p className="text-xl font-bold leading-tight">{stat.value ?? 0}</p>
              ) : (
                <Skeleton className="h-6 w-8 mt-0.5" />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar: search + inline filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[240px] flex items-center gap-2 bg-card px-3 rounded-lg border h-10">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            placeholder="Search by lead number, customer, phone, email, company, city..."
            className="border-0 shadow-none focus-visible:ring-0 h-9 px-0 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {viewMode === "table" && (
          <>
            <select className={`${selectClass} w-auto min-w-[7.5rem]`} value={filters.stage} onChange={(e) => setFilter("stage")(e.target.value)}>
              <option value="">All Stages</option>
              {LEAD_STAGES.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <select className={`${selectClass} w-auto min-w-[7.5rem]`} value={filters.source} onChange={(e) => setFilter("source")(e.target.value)}>
              <option value="">All Sources</option>
              {LEAD_SOURCES.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <select className={`${selectClass} w-auto min-w-[7.5rem]`} value={filters.assignedEmployeeId} onChange={(e) => setFilter("assignedEmployeeId")(e.target.value)}>
              <option value="">All Owners</option>
              {users.map((u) => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
            </select>
          </>
        )}
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={() => { setFilters({ ...EMPTY_FILTERS }); setSearch(""); }}>
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
                                        <Clock className="w-3 h-3" /> {card.nextFollowUpDate ? formatDate(card.nextFollowUpDate) : "No follow-up"}
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
              {selected.size > 0 && (
                <div className="flex items-center justify-between px-4 py-2 bg-primary/10 border border-primary/20 rounded-lg text-sm">
                  <span className="font-medium">{selected.size} selected</span>
                  <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
                </div>
              )}
              <ResponsiveList
                items={leads}
                loading={loading}
                getRowKey={(l) => l.id}
                onRowClick={(l) => navigate(`/leads/${l.id}`)}
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
                      {stagePill(l)}
                      {l.leadSource && <span className="text-xs text-muted-foreground">{l.leadSource}</span>}
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-semibold ${avatarColor(l.assignedSalesExecutive?.name)}`}>
                          {initials(l.assignedSalesExecutive?.name)}
                        </span>
                        {l.assignedSalesExecutive?.name || "Unassigned"}
                      </span>
                      <span className={followUpTone(l.nextFollowUpDate).className}>
                        {followUpTone(l.nextFollowUpDate).label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 pt-1 border-t text-sm" onClick={(e) => e.stopPropagation()}>
                      <a href={`tel:${l.mobileNumber}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-primary">
                        <Phone className="h-3.5 w-3.5" /> {l.mobileNumber}
                      </a>
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
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import {
  Search, Plus, Filter, LayoutGrid, List, Clock, ArrowRight, Users, Flame, Snowflake,
  ThermometerSun, CheckCircle, XCircle, PhoneCall, MapPin, Ruler, FileText, CalendarDays,
  TrendingUp, Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { leadApi } from "./leads/leadApi";
import LeadFormDialog from "./leads/LeadFormDialog";
import { selectClass } from "./leads/fields";
import {
  BOARD_DROP_STATUS, EMPTY_FILTERS, LEAD_SOURCES, LEAD_STAGES, LEAD_STATUSES, LEAD_TYPES,
  PRIORITIES, PRIORITY_STYLES, TEMPERATURES, TEMPERATURE_STYLES, formatDate, formatINR,
  statusStyle, type BoardColumn, type DashboardMetrics, type Lead, type LeadFilters,
  type UserSummary,
} from "./leads/constants";

type StatCard = {
  label: string;
  value: number | string | undefined;
  icon: React.ElementType;
  className: string;
};

export default function Leads() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [dashboard, setDashboard] = useState<DashboardMetrics | null>(null);
  const [board, setBoard] = useState<BoardColumn[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<LeadFilters>({ ...EMPTY_FILTERS });
  const [isAddOpen, setIsAddOpen] = useState(false);

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
    leadApi.list({ search: debouncedSearch, page, size: 15, filters })
      .then((res) => {
        setLeads(res.data.content);
        setTotalPages(res.data.totalPages);
        setTotalElements(res.data.totalElements);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [debouncedSearch, page, filters]);

  useEffect(() => {
    fetchDashboard();
    leadApi.assignableUsers().then((res) => setUsers(res.data)).catch(console.error);
  }, [fetchDashboard]);

  useEffect(() => {
    if (viewMode === "kanban") fetchBoard();
    else fetchList();
  }, [viewMode, fetchBoard, fetchList]);

  useEffect(() => { setPage(0); }, [debouncedSearch, filters]);

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
    { label: "Total Leads", value: dashboard?.totalLeads, icon: Users, className: "bg-blue-100 text-blue-600" },
    { label: "Today", value: dashboard?.todayLeads, icon: CalendarDays, className: "bg-indigo-100 text-indigo-600" },
    { label: "This Week", value: dashboard?.weekLeads, icon: TrendingUp, className: "bg-violet-100 text-violet-600" },
    { label: "This Month", value: dashboard?.monthLeads, icon: Target, className: "bg-purple-100 text-purple-600" },
    { label: "Hot", value: dashboard?.hotLeads, icon: Flame, className: "bg-red-100 text-red-600" },
    { label: "Warm", value: dashboard?.warmLeads, icon: ThermometerSun, className: "bg-amber-100 text-amber-600" },
    { label: "Cold", value: dashboard?.coldLeads, icon: Snowflake, className: "bg-sky-100 text-sky-600" },
    { label: "Converted", value: dashboard?.convertedLeads, icon: CheckCircle, className: "bg-green-100 text-green-600" },
    { label: "Lost", value: dashboard?.lostLeads, icon: XCircle, className: "bg-rose-100 text-rose-600" },
    { label: "Pending Follow-ups", value: dashboard?.pendingFollowups, icon: PhoneCall, className: "bg-orange-100 text-orange-600" },
    { label: "Today's Site Visits", value: dashboard?.todaySiteVisits, icon: MapPin, className: "bg-cyan-100 text-cyan-600" },
    { label: "Today's Measurements", value: dashboard?.todayMeasurements, icon: Ruler, className: "bg-teal-100 text-teal-600" },
    { label: "Quotation Pending", value: dashboard?.quotationPending, icon: FileText, className: "bg-yellow-100 text-yellow-700" },
  ], [dashboard]);

  const setFilter = (key: keyof LeadFilters) => (value: string) =>
    setFilters((f) => ({ ...f, [key]: value }));

  const activeFilterCount = Object.values(filters).filter((v) => v !== "").length;

  return (
    <div className="p-6 lg:p-8 space-y-6 flex flex-col h-full animate-in fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lead Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track every enquiry from first contact to project conversion
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
          <Button onClick={() => setIsAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Lead
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-3">
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
            placeholder="Search by lead number, customer, phone, WhatsApp, email, company, city, project address..."
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
          {viewMode === "kanban" ? (
            loading && board.length === 0 ? (
              <div className="flex gap-4 overflow-x-auto pb-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="w-80 h-[420px] flex-shrink-0 rounded-xl" />
                ))}
              </div>
            ) : (
              <DragDropContext onDragEnd={onDragEnd}>
                <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-390px)] min-h-[420px]">
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
            <div className="border rounded-xl bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lead</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Mobile</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Requirement</TableHead>
                      <TableHead>Assigned</TableHead>
                      <TableHead className="text-right">Budget</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Next Follow-up</TableHead>
                      <TableHead>Last Contact</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 13 }).map((_, j) => (
                            <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : leads.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={13} className="text-center py-12 text-muted-foreground">
                          <Target className="w-8 h-8 mx-auto mb-2 opacity-40" />
                          No leads match your search or filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      leads.map((lead) => (
                        <TableRow key={lead.id} className="cursor-pointer" onClick={() => navigate(`/leads/${lead.id}`)}>
                          <TableCell className="font-medium">
                            <div className="text-xs text-muted-foreground">{lead.leadNumber}</div>
                            <span className="text-primary">{lead.name}</span>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{lead.companyName || lead.contactPerson || "—"}</div>
                            <div className="text-xs text-muted-foreground">{lead.city || ""}</div>
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{lead.mobileNumber}</TableCell>
                          <TableCell className="text-sm">{lead.leadSource || "—"}</TableCell>
                          <TableCell className="text-sm">{lead.leadType || "—"}</TableCell>
                          <TableCell className="text-sm">{lead.assignedSalesExecutive?.name || "Unassigned"}</TableCell>
                          <TableCell className="text-right text-sm font-medium whitespace-nowrap">{formatINR(lead.estimatedBudget)}</TableCell>
                          <TableCell>
                            {lead.priority && (
                              <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full font-bold ${PRIORITY_STYLES[lead.priority] || ""}`}>
                                {lead.priority}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{lead.stage || "—"}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 text-xs rounded-full font-medium whitespace-nowrap ${statusStyle(lead.status)}`}>
                              {lead.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{formatDate(lead.nextFollowUpDate)}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{formatDate(lead.lastContactAt || lead.lastFollowUp)}</TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <Link to={`/leads/${lead.id}`}>
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
                    {totalElements} leads · Page {page + 1} of {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="w-72 shrink-0 space-y-3 border rounded-xl p-4 bg-card animate-in slide-in-from-right-8 overflow-y-auto max-h-[calc(100vh-380px)]">
            <h3 className="font-semibold border-b pb-2">Advanced Filters</h3>
            {[
              { label: "Lead Source", key: "source" as const, options: LEAD_SOURCES },
              { label: "Lead Type", key: "leadType" as const, options: LEAD_TYPES },
              { label: "Status", key: "status" as const, options: LEAD_STATUSES },
              { label: "Stage", key: "stage" as const, options: LEAD_STAGES },
              { label: "Priority", key: "priority" as const, options: PRIORITIES },
              { label: "Temperature", key: "temperature" as const, options: TEMPERATURES },
            ].map(({ label, key, options }) => (
              <div key={key} className="space-y-1">
                <label className="text-sm font-medium">{label}</label>
                <select className={selectClass} value={filters[key]} onChange={(e) => setFilter(key)(e.target.value)}>
                  <option value="">All</option>
                  {options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
            <div className="space-y-1">
              <label className="text-sm font-medium">Assigned Employee</label>
              <select className={selectClass} value={filters.assignedEmployeeId} onChange={(e) => setFilter("assignedEmployeeId")(e.target.value)}>
                <option value="">All</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Conversion</label>
              <select className={selectClass} value={filters.isConverted} onChange={(e) => setFilter("isConverted")(e.target.value)}>
                <option value="">Any</option>
                <option value="false">Open Leads</option>
                <option value="true">Converted</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Budget Min</label>
                <Input type="number" value={filters.budgetMin} onChange={(e) => setFilter("budgetMin")(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Budget Max</label>
                <Input type="number" value={filters.budgetMax} onChange={(e) => setFilter("budgetMax")(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">From</label>
                <Input type="date" value={filters.dateFrom} onChange={(e) => setFilter("dateFrom")(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">To</label>
                <Input type="date" value={filters.dateTo} onChange={(e) => setFilter("dateTo")(e.target.value)} />
              </div>
            </div>
            <Button className="w-full" variant="outline" onClick={() => setFilters({ ...EMPTY_FILTERS })}>
              Clear Filters
            </Button>
          </div>
        )}
      </div>

      <LeadFormDialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        users={users}
        onSaved={() => refresh()}
      />
    </div>
  );
}

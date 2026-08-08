import { useState, useEffect, useCallback } from "react";
import { format, startOfWeek, addDays, startOfMonth, endOfMonth, endOfWeek, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight, Search, Plus, MapPin, Calendar as CalendarIcon, List, Activity, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Link } from "react-router-dom";
import { siteVisitApi } from "@/lib/siteVisitApi";
import { SelectField, TextField, TextAreaField, selectClass } from "@/pages/leads/fields";

const NEW_VISIT_DEFAULTS = {
  visitType: "Initial Visit",
  priority: "Medium",
  scheduledDate: new Date().toISOString().slice(0, 10),
  locationAddress: "",
  visitNotes: "",
};

export default function SiteVisits() {
  const [visits, setVisits] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [currentDate, setCurrentDate] = useState(new Date());

  const [dashboard, setDashboard] = useState({
    todaysVisits: 0,
    upcomingVisits: 0,
    completedVisits: 0,
    cancelledVisits: 0,
    overdueVisits: 0,
    visitsThisMonth: 0,
  });
  const [meta, setMeta] = useState<{ visitTypes: string[]; statuses: string[]; priorities: string[] }>({
    visitTypes: [], statuses: [], priorities: [],
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [filters, setFilters] = useState({ status: "", visitType: "", priority: "" });

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<any>({ ...NEW_VISIT_DEFAULTS });
  const [saving, setSaving] = useState(false);

  const fetchVisits = useCallback(() => {
    const startDate = format(startOfMonth(currentDate), "yyyy-MM-dd'T'00:00:00");
    const endDate = format(endOfMonth(currentDate), "yyyy-MM-dd'T'23:59:59");

    siteVisitApi.listAll({ startDate, endDate })
      .then((data) => setVisits(data))
      .catch((err) => console.error("Failed to fetch visits", err));
  }, [currentDate]);

  const fetchDashboard = useCallback(() => {
    siteVisitApi.dashboard().then(setDashboard).catch((err) => console.error("Failed to fetch dashboard", err));
  }, []);

  useEffect(() => { fetchVisits(); }, [fetchVisits]);
  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);
  useEffect(() => {
    siteVisitApi.meta().then(setMeta).catch(() => {});
  }, []);

  const runSearch = (q: string) => {
    setSearchTerm(q);
    if (!q.trim()) { setSearchResults(null); return; }
    siteVisitApi.search(q, 0, 20).then((res) => setSearchResults(res.content || [])).catch(() => setSearchResults([]));
  };

  const filteredVisits = (searchResults ?? visits).filter((v) => {
    if (filters.status && v.status !== filters.status) return false;
    if (filters.visitType && v.visitType !== filters.visitType) return false;
    if (filters.priority && v.priority !== filters.priority) return false;
    return true;
  });

  const submitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    siteVisitApi.create(form)
      .then(() => { setCreateOpen(false); setForm({ ...NEW_VISIT_DEFAULTS }); fetchVisits(); fetchDashboard(); })
      .catch((err) => alert(err?.response?.data?.message || "Failed to schedule visit"))
      .finally(() => setSaving(false));
  };

  const renderCalendar = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const dateFormat = "d";
    const rows = [];
    let days = [];
    let day = startDate;
    let formattedDate = "";

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, dateFormat);
        const cloneDay = day;

        const dayVisits = filteredVisits.filter(v => v.scheduledTime && isSameDay(new Date(v.scheduledTime), cloneDay));

        days.push(
          <div
            className={`min-h-[120px] p-2 border-r border-b relative ${
              !isSameMonth(day, monthStart)
                ? "bg-muted/30 text-muted-foreground"
                : isSameDay(day, new Date())
                ? "bg-accent/10"
                : "bg-card"
            }`}
            key={day.toString()}
          >
            <div className="flex justify-between items-center mb-1">
              <span className={`text-sm font-medium ${isSameDay(day, new Date()) ? 'bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center' : ''}`}>
                {formattedDate}
              </span>
            </div>

            <div className="space-y-1 mt-2">
              {dayVisits.map(visit => (
                <Link key={visit.id} to={`/site-visits/${visit.id}`}>
                  <div className={`text-xs p-1.5 rounded border truncate cursor-pointer transition-colors ${
                    visit.status === 'Completed' ? 'bg-green-100 border-green-200 text-green-800 hover:bg-green-200' :
                    visit.status === 'Cancelled' ? 'bg-red-100 border-red-200 text-red-800 hover:bg-red-200' :
                    visit.status === 'In Progress' ? 'bg-blue-100 border-blue-200 text-blue-800 hover:bg-blue-200' :
                    visit.priority === 'High' || visit.priority === 'Urgent' ? 'bg-orange-100 border-orange-200 text-orange-800 hover:bg-orange-200' :
                    'bg-white hover:bg-muted'
                  }`}>
                    <div className="font-semibold truncate">{format(new Date(visit.scheduledTime), "h:mm a")}</div>
                    <div className="truncate">{visit.visitNumber || visit.customer?.name}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div className="grid grid-cols-7" key={day.toString()}>
          {days}
        </div>
      );
      days = [];
    }

    return (
      <div className="border rounded-xl overflow-hidden bg-card">
        <div className="grid grid-cols-7 border-b bg-muted/50 text-center text-sm font-medium text-muted-foreground py-2">
          <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
        </div>
        {rows}
      </div>
    );
  };

  const renderList = () => {
    return (
      <div className="border rounded-xl bg-card overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
            <tr>
              <th className="px-4 py-3">Visit No & Time</th>
              <th className="px-4 py-3">Type & Priority</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Outcome</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredVisits.map(visit => (
              <tr key={visit.id} className="border-b hover:bg-muted/50">
                <td className="px-4 py-3 font-medium">
                  <div className="text-xs text-muted-foreground">{visit.visitNumber}</div>
                  {visit.scheduledTime ? format(new Date(visit.scheduledTime), "MMM d, yyyy h:mm a") : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{visit.visitType}</div>
                  <div className="text-xs text-muted-foreground uppercase">{visit.priority} Priority</div>
                </td>
                <td className="px-4 py-3 text-muted-foreground flex items-center gap-1">
                  {visit.googleMapsLink ? (
                    <a href={visit.googleMapsLink} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:underline">
                      <MapPin className="h-3 w-3" /> {visit.locationAddress || "View on map"}
                    </a>
                  ) : (
                    <><MapPin className="h-3 w-3" /> {visit.locationAddress || visit.propertyType || 'Not specified'}</>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 bg-accent/20 text-xs rounded-full">{visit.status}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{visit.outcome || "—"}</td>
                <td className="px-4 py-3 text-right">
                  <Link to={`/site-visits/${visit.id}`}>
                    <Button variant="ghost" size="sm">View</Button>
                  </Link>
                </td>
              </tr>
            ))}
            {filteredVisits.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No visits found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="p-8 space-y-6 flex flex-col h-full animate-in fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Site Visits Dashboard</h1>
        <div className="flex gap-2">
          <div className="flex bg-muted p-1 rounded-lg border">
            <Button variant={viewMode === "calendar" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("calendar")}>
              <CalendarIcon className="h-4 w-4 mr-2" /> Calendar
            </Button>
            <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("list")}>
              <List className="h-4 w-4 mr-2" /> List
            </Button>
          </div>
          <Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" /> Schedule Visit</Button>
        </div>
      </div>

      {/* KPI Dashboard */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
        <div className="p-4 bg-card rounded-xl border shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Today's Visits</p>
            <h3 className="text-2xl font-bold">{dashboard.todaysVisits}</h3>
          </div>
          <div className="h-10 w-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center"><Activity size={20}/></div>
        </div>
        <div className="p-4 bg-card rounded-xl border shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Upcoming</p>
            <h3 className="text-2xl font-bold">{dashboard.upcomingVisits}</h3>
          </div>
          <div className="h-10 w-10 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center"><CalendarIcon size={20}/></div>
        </div>
        <div className="p-4 bg-card rounded-xl border shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Completed</p>
            <h3 className="text-2xl font-bold">{dashboard.completedVisits}</h3>
          </div>
          <div className="h-10 w-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center"><CheckCircle size={20}/></div>
        </div>
        <div className="p-4 bg-card rounded-xl border shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Cancelled</p>
            <h3 className="text-2xl font-bold">{dashboard.cancelledVisits}</h3>
          </div>
          <div className="h-10 w-10 bg-red-100 text-red-600 rounded-full flex items-center justify-center"><Clock size={20}/></div>
        </div>
        <div className="p-4 bg-card rounded-xl border shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Overdue</p>
            <h3 className="text-2xl font-bold">{dashboard.overdueVisits}</h3>
          </div>
          <div className="h-10 w-10 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center"><AlertTriangle size={20}/></div>
        </div>
        <div className="p-4 bg-card rounded-xl border shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">This Month</p>
            <h3 className="text-2xl font-bold">{dashboard.visitsThisMonth}</h3>
          </div>
          <div className="h-10 w-10 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center"><CalendarIcon size={20}/></div>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-xl font-semibold w-48 text-center">{format(currentDate, "MMMM yyyy")}</h2>
          <Button variant="outline" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => setCurrentDate(new Date())}>Today</Button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select className={`${selectClass} w-36`} value={filters.status} onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}>
            <option value="">All Statuses</option>
            {meta.statuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className={`${selectClass} w-40`} value={filters.visitType} onChange={(e) => setFilters(f => ({ ...f, visitType: e.target.value }))}>
            <option value="">All Types</option>
            {meta.visitTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className={`${selectClass} w-32`} value={filters.priority} onChange={(e) => setFilters(f => ({ ...f, priority: e.target.value }))}>
            <option value="">All Priorities</option>
            {meta.priorities.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <div className="flex items-center space-x-2 bg-card p-2 rounded-lg border">
            <Search className="h-5 w-5 text-muted-foreground ml-2" />
            <Input
              placeholder="Search visit no, customer, mobile..."
              className="border-0 shadow-none focus-visible:ring-0 w-64"
              value={searchTerm}
              onChange={(e) => runSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex-1">
        {viewMode === "calendar" ? renderCalendar() : renderList()}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Schedule Site Visit</DialogTitle></DialogHeader>
          <form onSubmit={submitCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <SelectField label="Visit Type" value={form.visitType} onChange={(v) => setForm((f: any) => ({ ...f, visitType: v }))}
                options={meta.visitTypes.length ? meta.visitTypes : ["Initial Visit", "Measurement", "Site Inspection"]} allowEmpty={false} />
              <TextField label="Visit Date" type="date" required value={form.scheduledDate} onChange={(v) => setForm((f: any) => ({ ...f, scheduledDate: v }))} />
              <SelectField label="Priority" value={form.priority} onChange={(v) => setForm((f: any) => ({ ...f, priority: v }))}
                options={meta.priorities.length ? meta.priorities : ["Low", "Medium", "High", "Urgent"]} allowEmpty={false} />
              <TextField label="Customer Mobile" value={form.customerMobile} onChange={(v) => setForm((f: any) => ({ ...f, customerMobile: v }))} />
            </div>
            <TextAreaField label="Location Address" rows={2} value={form.locationAddress} onChange={(v) => setForm((f: any) => ({ ...f, locationAddress: v }))} />
            <TextAreaField label="Remarks" value={form.visitNotes} onChange={(v) => setForm((f: any) => ({ ...f, visitNotes: v }))} />
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Scheduling..." : "Schedule"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { workforceApi } from "@/api/workforceApi";
import type { WorkforceListRow, WorkforceMeta } from "@/types/workforce";
import {
  RESOURCE_TYPE_LABELS, RESOURCE_TYPE_STYLES, WORKFORCE_STATUSES, WORKFORCE_STATUS_TONE,
} from "@/types/workforce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ResponsiveList, { type Column } from "@/components/ui/responsive-list";
import FilterSheet from "@/components/ui/filter-sheet";
import { Plus, RefreshCw, SlidersHorizontal, Users, Phone, Mail, Briefcase } from "lucide-react";
import AddWorkforceDialog from "./AddWorkforceDialog";
import api from "@/lib/api";
import { toast } from "@/components/ui/toast";
import { FilterChips, PersonChip, SearchField } from "./hrUi";

const humanize = (s?: string) => (s ? s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ") : "");

export default function WorkforceDirectoryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [rows, setRows] = useState<WorkforceListRow[]>([]);
  const [meta, setMeta] = useState<WorkforceMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState(""); // debounced search sent to the server
  const [type, setType] = useState("ALL"); // filtered client-side so the chips can show counts
  const [skill, setSkill] = useState("");
  const [status, setStatus] = useState("");
  // A department card's "View people" link opens the directory pre-filtered.
  const [department, setDepartment] = useState<string>(() => (location.state as { department?: string } | null)?.department ?? "");
  const [company, setCompany] = useState("");

  useEffect(() => { workforceApi.meta().then(setMeta).catch(console.error); }, []);
  useEffect(() => { const t = setTimeout(() => setQuery(search.trim()), 300); return () => clearTimeout(t); }, [search]);

  const load = useCallback(() => {
    setLoading(true);
    workforceApi.list({
      search: query || undefined, skill: skill || undefined,
      status: status || undefined, department: department || undefined, company: company || undefined,
    })
      .then(setRows)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [query, skill, status, department, company]);

  useEffect(() => { load(); }, [load]);

  // Reconciles login Users with Employee records (the old /hr "Sync Users" utility). The
  // unified directory is the source of truth now, so this stays a manual admin action here.
  const syncUsers = () => {
    setSyncing(true);
    api.post("/hr/sync-employees")
      .then(() => { toast.success("Users synced with employee records."); load(); })
      .catch(() => toast.error("Failed to sync users."))
      .finally(() => setSyncing(false));
  };

  const typeOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    rows.forEach((r) => { counts[r.workforceType] = (counts[r.workforceType] ?? 0) + 1; });
    return [
      { key: "ALL", label: "Everyone", count: rows.length },
      ...Object.keys(counts).sort().map((k) => ({ key: k, label: `${RESOURCE_TYPE_LABELS[k] ?? humanize(k)}s`, count: counts[k] })),
    ];
  }, [rows]);
  const visible = useMemo(() => (type === "ALL" ? rows : rows.filter((r) => r.workforceType === type)), [rows, type]);

  const activeFilters = [skill, status, department, company].filter(Boolean).length;
  const clearFilters = () => { setSkill(""); setStatus(""); setDepartment(""); setCompany(""); };

  const columns: Column<WorkforceListRow>[] = [
    {
      key: "name", header: "Name",
      cell: (w) => <PersonChip name={w.fullName} sub={w.companyName || w.department || undefined}
        tone={w.workforceType === "EMPLOYEE" ? "employee" : "contractor"} to={`/workforce/${w.id}`} />,
    },
    { key: "type", header: "Type", cell: (w) => <TypePill type={w.workforceType} /> },
    { key: "skill", header: "Skill", cell: (w) => <span className="text-slate-700">{w.primarySkill || "—"}</span> },
    { key: "status", header: "Status", cell: (w) => <AvailabilityPill status={w.status} /> },
    {
      key: "projects", header: "Active projects", headClassName: "text-right", cellClassName: "text-right tabular-nums",
      cell: (w) => w.activeProjects > 0 ? <span className="font-semibold text-slate-900">{w.activeProjects}</span> : <span className="text-slate-400">0</span>,
    },
    {
      key: "contact", header: "Contact",
      cell: (w) => (
        <div className="text-xs">
          <div className="text-slate-700">{w.mobile || "—"}</div>
          {w.email && <div className="max-w-[14rem] truncate text-slate-500">{w.email}</div>}
        </div>
      ),
    },
  ];

  const select = "h-10 w-full rounded-md border border-input bg-card px-3 text-sm";

  return (
    <div className="space-y-4">
      {/* Toolbar: search + filters + actions. Actions collapse to icons on phones. */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchField value={search} onChange={setSearch} placeholder="Search name, mobile, email or skill…" className="lg:max-w-md lg:flex-1" />
        <div className="flex items-center gap-2 lg:ml-auto">
          <Button variant="outline" onClick={() => setFiltersOpen(true)} className="flex-1 sm:flex-none">
            <SlidersHorizontal className="mr-1.5 h-4 w-4" /> Filters
            {activeFilters > 0 && <span className="ml-1.5 rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">{activeFilters}</span>}
          </Button>
          <Button variant="outline" onClick={syncUsers} disabled={syncing} title="Match login users to employee records" aria-label="Sync users" className="shrink-0 px-3">
            <RefreshCw className={`h-4 w-4 sm:mr-1.5 ${syncing ? "animate-spin" : ""}`} /> <span className="hidden sm:inline">Sync users</span>
          </Button>
          <Button onClick={() => setOpen(true)} className="flex-1 sm:flex-none">
            <Plus className="mr-1.5 h-4 w-4" /> Add person
          </Button>
        </div>
      </div>

      <FilterChips options={typeOptions} value={type} onChange={setType} />

      <ResponsiveList
        items={visible}
        columns={columns}
        getRowKey={(w) => w.id}
        loading={loading}
        onRowClick={(w) => navigate(`/workforce/${w.id}`)}
        emptyIcon={Users}
        emptyTitle={search || activeFilters ? "Nobody matches these filters" : "No one in the directory yet"}
        emptyDescription={search || activeFilters ? "Try a different search or clear the filters." : "Add your first employee or contractor to get started."}
        emptyAction={search || activeFilters
          ? <Button variant="outline" size="sm" onClick={() => { setSearch(""); clearFilters(); }}>Clear search & filters</Button>
          : <Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" /> Add person</Button>}
        renderCard={(w) => (
          <div className="space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <PersonChip name={w.fullName} sub={w.companyName || w.department || undefined}
                tone={w.workforceType === "EMPLOYEE" ? "employee" : "contractor"} />
              <AvailabilityPill status={w.status} />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pl-[2.875rem] text-xs text-slate-600">
              <TypePill type={w.workforceType} />
              {w.primarySkill && <span className="inline-flex items-center gap-1"><Briefcase className="h-3.5 w-3.5 text-slate-400" />{w.primarySkill}</span>}
              {w.activeProjects > 0 && <span><b className="text-slate-900">{w.activeProjects}</b> active project{w.activeProjects === 1 ? "" : "s"}</span>}
            </div>
            {(w.mobile || w.email) && (
              <div className="flex gap-2 pl-[2.875rem]">
                {w.mobile && (
                  <a href={`tel:${w.mobile}`} onClick={(e) => e.stopPropagation()}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">
                    <Phone className="h-3.5 w-3.5" /> {w.mobile}
                  </a>
                )}
                {w.email && (
                  <a href={`mailto:${w.email}`} onClick={(e) => e.stopPropagation()} aria-label={`Email ${w.fullName}`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border text-slate-700 hover:bg-slate-50">
                    <Mail className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      />

      {!loading && visible.length > 0 && (
        <p className="text-xs text-slate-500">Showing {visible.length} of {rows.length}</p>
      )}

      <FilterSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} activeCount={activeFilters} onClear={clearFilters}>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <select className={select} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Any status</option>
            {WORKFORCE_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Skill</Label>
          <select className={select} value={skill} onChange={(e) => setSkill(e.target.value)}>
            <option value="">Any skill</option>
            {(meta?.skills ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Department</Label>
          <select className={select} value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="">Any department</option>
            {(meta?.departments ?? []).map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Company</Label>
          <Input placeholder="Contractor's company…" value={company} onChange={(e) => setCompany(e.target.value)} />
        </div>
      </FilterSheet>

      <AddWorkforceDialog open={open} onOpenChange={setOpen} meta={meta} onSaved={load} />
    </div>
  );
}

function TypePill({ type }: { type: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${RESOURCE_TYPE_STYLES[type] ?? "bg-slate-100 text-slate-700"}`}>
      {RESOURCE_TYPE_LABELS[type] ?? humanize(type)}
    </span>
  );
}

function AvailabilityPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${WORKFORCE_STATUS_TONE[status] ?? "bg-slate-100 text-slate-700"}`}>
      {humanize(status)}
    </span>
  );
}

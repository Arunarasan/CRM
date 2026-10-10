import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { differenceInCalendarDays, format } from "date-fns";
import { Check, Palmtree, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import ResponsiveList, { type Column } from "@/components/ui/responsive-list";
import { FilterChips, PersonChip, SearchField, StatusPill } from "@/pages/workforce/hrUi";

/**
 * Leave requests with approve / reject. Extracted from the old Human Resources "Leaves"
 * tab when HR + Workforce merged into one module. Pending requests are shown first.
 */
type StatusKey = "PENDING" | "UPCOMING" | "APPROVED" | "REJECTED" | "ALL";
const todayIso = () => format(new Date(), "yyyy-MM-dd");
/** Approved leave that hasn't finished yet — who's away now or soon. */
const isUpcoming = (l: any) => l.status === "APPROVED" && String(l.endDate || "") >= todayIso();

const fmt = (v?: string) => { if (!v) return "—"; const d = new Date(v); return isNaN(d.getTime()) ? "—" : format(d, "d MMM yyyy"); };
const days = (a?: string, b?: string) => {
  if (!a || !b) return null;
  const n = differenceInCalendarDays(new Date(b), new Date(a)) + 1;
  return isNaN(n) || n < 1 ? null : n;
};
const humanize = (s?: string) => (s ? s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ") : "—");
const nameOf = (e: any) => [e?.firstName, e?.lastName].filter(Boolean).join(" ");

export default function HrLeavePage() {
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusKey>("PENDING");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<number | null>(null);

  const fetchData = () => {
    // The endpoint pages at 10 by default — ask for enough to see the whole queue.
    api.get(`/hr/leaves`, { params: { page: 0, size: 300 } })
      .then(res => setLeaves(res.data.content || []))
      .catch(() => setLeaves([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const act = (id: number, approve: boolean) => {
    setBusy(id);
    const call = approve ? api.post(`/hr/leaves/${id}/approve?approvedBy=Admin`) : api.post(`/hr/leaves/${id}/reject`);
    call
      .then(() => { toast.success(approve ? "Leave approved." : "Leave rejected."); fetchData(); })
      .catch(() => toast.error(approve ? "Failed to approve leave." : "Failed to reject leave."))
      .finally(() => setBusy(null));
  };

  const counts = useMemo(() => {
    const c: Record<StatusKey, number> = { PENDING: 0, UPCOMING: 0, APPROVED: 0, REJECTED: 0, ALL: leaves.length };
    leaves.forEach((l) => { if (l.status in c) c[l.status as StatusKey]++; if (isUpcoming(l)) c.UPCOMING++; });
    return c;
  }, [leaves]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leaves
      .filter((l) => status === "ALL" || (status === "UPCOMING" ? isUpcoming(l) : l.status === status))
      .filter((l) => !q || nameOf(l.employee).toLowerCase().includes(q) || (l.type || "").toLowerCase().includes(q))
      .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)) * (status === "PENDING" || status === "UPCOMING" ? 1 : -1));
  }, [leaves, status, search]);

  const actions = (l: any) => l.status === "PENDING" ? (
    <div className="inline-flex gap-1.5">
      <Button size="sm" variant="forest" disabled={busy === l.id} onClick={() => act(l.id, true)}>
        {busy === l.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />} Approve
      </Button>
      <Button size="sm" variant="outline" disabled={busy === l.id} onClick={() => act(l.id, false)}>
        <X className="mr-1 h-3.5 w-3.5" /> Reject
      </Button>
    </div>
  ) : null;

  const person = (l: any) => (
    <PersonChip name={nameOf(l.employee) || "Employee"} sub={l.employee?.department?.name}
      to={l.employee?.id ? `/hr/employees/${l.employee.id}` : undefined} />
  );

  const columns: Column<any>[] = [
    { key: "who", header: "Employee", cell: person },
    { key: "type", header: "Leave type", cellClassName: "font-medium text-slate-700", cell: (l) => humanize(l.type) },
    {
      key: "dates", header: "Dates",
      cell: (l) => (
        <div className="whitespace-nowrap">
          <div className="text-slate-900">{fmt(l.startDate)} – {fmt(l.endDate)}</div>
          {days(l.startDate, l.endDate) != null && <div className="text-xs text-slate-500">{days(l.startDate, l.endDate)} day{days(l.startDate, l.endDate) === 1 ? "" : "s"}</div>}
        </div>
      ),
    },
    { key: "reason", header: "Reason", cell: (l) => <span className="block max-w-[16rem] truncate text-slate-600">{l.reason || "—"}</span> },
    { key: "status", header: "Status", cell: (l) => <StatusPill status={l.status} labels={{ PENDING: "Pending" }} /> },
    { key: "act", header: <span className="sr-only">Actions</span>, headClassName: "text-right", cellClassName: "text-right whitespace-nowrap", cell: actions },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <FilterChips<StatusKey>
          value={status} onChange={setStatus}
          options={[
            { key: "PENDING", label: "Pending", count: counts.PENDING },
            { key: "UPCOMING", label: "Away now / upcoming", count: counts.UPCOMING },
            { key: "APPROVED", label: "Approved", count: counts.APPROVED },
            { key: "REJECTED", label: "Rejected", count: counts.REJECTED },
            { key: "ALL", label: "All", count: counts.ALL },
          ]}
        />
        <SearchField value={search} onChange={setSearch} placeholder="Search employee or leave type…" className="md:w-72" />
      </div>

      <ResponsiveList
        items={visible}
        columns={columns}
        getRowKey={(l) => l.id}
        loading={loading}
        emptyIcon={Palmtree}
        emptyTitle={status === "PENDING" ? "No leave waiting for approval" : "No leave requests here"}
        emptyDescription={status === "PENDING" ? "New requests from the employee app will appear here." : undefined}
        renderCard={(l) => (
          <div className="space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              {person(l)}
              <StatusPill status={l.status} labels={{ PENDING: "Pending" }} />
            </div>
            <div className="rounded-lg bg-slate-50 p-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-slate-900">{humanize(l.type)}</span>
                {days(l.startDate, l.endDate) != null && <span className="text-xs text-slate-500">{days(l.startDate, l.endDate)} day{days(l.startDate, l.endDate) === 1 ? "" : "s"}</span>}
              </div>
              <div className="text-slate-600">{fmt(l.startDate)} – {fmt(l.endDate)}</div>
              {l.reason && <p className="mt-1 text-xs text-slate-500">{l.reason}</p>}
            </div>
            {l.status === "PENDING" && <div className="flex justify-end">{actions(l)}</div>}
          </div>
        )}
      />
    </div>
  );
}

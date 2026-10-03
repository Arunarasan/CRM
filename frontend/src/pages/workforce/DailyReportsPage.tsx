import { BaseInput } from '@/components/ui/input';
import { useCallback, useEffect, useMemo, useState } from "react";
import { Users, CalendarClock, AlertCircle } from "lucide-react";
import { SectionHeader } from "./hrUi";
import { dailyReportApi, type AdminDailyReport, type DailyReportFilters } from "@/api/dailyReportApi";
import DailyReportCard from "@/components/hr/DailyReportCard";
import api from "@/lib/api";

interface EmployeeOption { id: number; name: string }

/**
 * HR & Payroll → Daily Reports. Every employee's end-of-day field report in one place, filterable
 * by employee / date, with a review action. Reports tagged to a project or lead also surface on
 * those pages; this is the cross-employee home for them.
 */
export default function DailyReportsPage() {
  const [reports, setReports] = useState<AdminDailyReport[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<DailyReportFilters>({});

  const load = useCallback(() => {
    setLoading(true);
    dailyReportApi.list(filters).then(setReports).catch(() => setReports([])).finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  // Employee picker options — reuse the HR employee directory (paged; pull a large page).
  useEffect(() => {
    api.get(`/hr/employees`, { params: { page: 0, size: 500 } }).then((r) => {
      const list = (r.data?.content ?? r.data ?? []) as any[];
      setEmployees(
        list
          .map((e) => ({ id: e.id, name: [e.firstName, e.lastName].filter(Boolean).join(" ") || e.employeeCode }))
          .filter((e) => e.name),
      );
    }).catch(() => {});
  }, []);

  const set = (patch: Partial<DailyReportFilters>) => setFilters((f) => ({ ...f, ...patch }));

  const pendingCount = useMemo(() => reports.filter((r) => r.status === "SUBMITTED").length, [reports]);

  const onReviewed = (updated: AdminDailyReport) =>
    setReports((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Daily reports"
        description="End-of-day field reports employees submit from their app."
        actions={<>
          <Stat icon={CalendarClock} label="showing" value={reports.length} />
          <Stat icon={AlertCircle} label="new" value={pendingCount} tone="amber" />
        </>}
      />

      {/* Filters */}
      <div className="grid grid-cols-2 items-end gap-3 rounded-xl border bg-card p-3 shadow-sm md:flex md:flex-wrap">
        <label className="col-span-2 flex flex-col gap-1 text-xs font-medium text-slate-600 md:col-span-1">
          <span className="flex items-center gap-1"><Users className="w-3 h-3" /> Employee</span>
          <select
            value={filters.employeeId ?? ""}
            onChange={(e) => set({ employeeId: e.target.value ? Number(e.target.value) : undefined })}
            className="h-10 w-full rounded-md border bg-card px-2 text-sm md:min-w-[12rem]"
          >
            <option value="">All employees</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          <span>From</span>
          <BaseInput type="date" value={filters.from ?? ""} onChange={(e) => set({ from: e.target.value || undefined })}
                 className="h-10 w-full rounded-md border bg-card px-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          <span>To</span>
          <BaseInput type="date" value={filters.to ?? ""} onChange={(e) => set({ to: e.target.value || undefined })}
                 className="h-10 w-full rounded-md border bg-card px-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          <span>Status</span>
          <select value={filters.status ?? ""} onChange={(e) => set({ status: e.target.value || undefined })}
                  className="h-10 w-full rounded-md border bg-card px-2 text-sm">
            <option value="">All</option>
            <option value="SUBMITTED">New (unreviewed)</option>
            <option value="REVIEWED">Reviewed</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </label>
        {(filters.employeeId || filters.from || filters.to || filters.status) && (
          <button onClick={() => setFilters({})} className="h-10 rounded-md border px-3 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground">Loading reports…</div>
      ) : reports.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground rounded-xl border bg-card">
          No daily reports match these filters.
        </div>
      ) : (
        <div className="space-y-2.5">
          {reports.map((r) => (
            <DailyReportCard key={r.id} report={r} onReviewed={onReviewed} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof Users; label: string; value: number; tone?: "amber" }) {
  return (
    <div className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 ${tone === "amber" ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-card text-slate-600"}`}>
      <Icon className="w-4 h-4" />
      <span className="font-bold">{value}</span>
      <span className="text-xs">{label}</span>
    </div>
  );
}

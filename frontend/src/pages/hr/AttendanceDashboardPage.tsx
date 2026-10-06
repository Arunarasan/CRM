import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Download, Fingerprint, Loader2, RefreshCw, Router, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  attendanceDeviceApi, fmtClock, fmtMinutes, statusMeta, downloadCsv,
  type Dashboard, type AttendanceFilters, type Branch, type Shift, type AttendanceDevice,
} from '@/api/attendanceDeviceApi';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { Panel, PersonChip, SearchField, SectionHeader, StatTile } from '@/pages/workforce/hrUi';

/**
 * HR → Attendance → Dashboard. One day, every employee who must mark attendance: the headline
 * counts, then the day's sheet. Clicking a count filters the sheet; filters cover date, employee
 * (search), department, branch, status, shift and device. Auto-refreshes every minute for today.
 */
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const SELECT = 'h-10 rounded-md border border-input bg-card px-2 text-sm text-slate-700 min-w-0';

export default function AttendanceDashboardPage() {
  const today = iso(new Date());
  const [filters, setFilters] = useState<AttendanceFilters>({ date: today });
  const [search, setSearch] = useState('');
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [lookups, setLookups] = useState<{ branches: Branch[]; shifts: Shift[]; devices: AttendanceDevice[]; departments: { id: number; name: string }[] }>(
    { branches: [], shifts: [], devices: [], departments: [] });

  useEffect(() => {
    Promise.allSettled([attendanceDeviceApi.branches(), attendanceDeviceApi.shifts(), attendanceDeviceApi.list(), attendanceDeviceApi.departments()])
      .then(([b, s, d, dep]) => setLookups({
        branches: b.status === 'fulfilled' ? b.value : [],
        shifts: s.status === 'fulfilled' ? s.value : [],
        devices: d.status === 'fulfilled' ? d.value : [],
        departments: dep.status === 'fulfilled' ? dep.value : [],
      }));
  }, []);

  const load = useCallback((quiet = false) => {
    if (!quiet) setLoading(true);
    attendanceDeviceApi.dashboard(filters)
      .then(setData)
      .catch((e) => toast.error(e?.response?.data?.message || 'Could not load attendance'))
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (filters.date !== today) return;
    const t = setInterval(() => load(true), 60_000);
    return () => clearInterval(t);
  }, [filters.date, today, load]);

  const set = (patch: Partial<AttendanceFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const stepDay = (delta: number) => {
    const d = new Date(`${filters.date ?? today}T00:00:00`);
    d.setDate(d.getDate() + delta);
    set({ date: iso(d) });
  };

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!data) return [];
    return q ? data.rows.filter((r) => `${r.employeeName} ${r.employeeCode} ${r.department ?? ''}`.toLowerCase().includes(q)) : data.rows;
  }, [data, search]);

  const exportCsv = () => {
    if (!data) return;
    downloadCsv(`attendance-${data.date}.csv`,
      ['Employee ID', 'Employee', 'Department', 'Branch', 'Shift', 'Status', 'Check in', 'Check out', 'Hours', 'Late (min)', 'Early (min)', 'Overtime (min)', 'Method', 'Device'],
      rows.map((r) => [r.employeeCode, r.employeeName, r.department, r.branch, r.shift, statusMeta(r.status).label,
        fmtClock(r.checkIn), fmtClock(r.checkOut), fmtMinutes(r.workingMinutes), r.lateMinutes, r.earlyDepartureMinutes,
        r.overtimeMinutes, r.checkInMethod, r.device]));
  };

  const c = data?.cards;
  const card = (label: string, value: number | undefined, status: string, tone: 'success' | 'danger' | 'warning' | 'info' | 'neutral', hint?: string) => (
    <StatTile label={label} value={value ?? '—'} tone={tone} hint={hint}
      active={filters.status === status} onClick={() => set({ status: filters.status === status ? undefined : status })} />
  );

  return (
    <div className="space-y-5">
      <SectionHeader icon={CalendarDays} title="Attendance dashboard"
        description={filters.date === today ? 'Today, live from the attendance devices.' : `Attendance for ${new Date(`${filters.date}T00:00:00`).toDateString()}.`}
        actions={<>
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Previous day" onClick={() => stepDay(-1)} className="grid h-10 w-10 place-items-center rounded-md border border-input bg-card text-slate-600 hover:bg-slate-50"><ChevronLeft className="h-4 w-4" /></button>
            <input type="date" aria-label="Date" className={`${SELECT} w-[9.5rem]`} value={filters.date ?? today} max={today}
              onChange={(e) => set({ date: e.target.value || today })} />
            <button type="button" aria-label="Next day" disabled={(filters.date ?? today) >= today} onClick={() => stepDay(1)} className="grid h-10 w-10 place-items-center rounded-md border border-input bg-card text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <Button variant="outline" size="sm" className="h-10" onClick={() => load()} aria-label="Refresh"><RefreshCw className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" className="h-10" onClick={exportCsv} disabled={!rows.length}><Download className="h-4 w-4" /> Export</Button>
        </>} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {card('Present', c?.present, 'PRESENT', 'success', c ? `${c.checkedInNow} in now` : undefined)}
        {card('Absent', c?.absent, 'ABSENT', 'danger', c ? (c.notMarked ? `${c.notMarked} not marked yet` : 'no punch today') : undefined)}
        {card('Late', c?.late, 'LATE', 'warning', c ? 'after grace period' : undefined)}
        {card('On leave', c?.onLeave, 'LEAVE', 'info', c ? 'approved leave' : undefined)}
        {card('Half day', c?.halfDay, 'HALF_DAY', 'neutral', c ? `${c.weekOff} on week off` : undefined)}
      </div>

      {data && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5"><Router className="h-3.5 w-3.5" />
            {data.devices.online}/{data.devices.active} devices online</span>
          {data.devices.pendingSync > 0 && <span className="text-amber-700">{data.devices.pendingSync} punches waiting to sync</span>}
          <span className="inline-flex items-center gap-1.5"><Fingerprint className="h-3.5 w-3.5" />{c?.biometric ?? 0} biometric today</span>
          <Link to="/workforce/attendance-devices" className="text-primary hover:underline">Manage devices</Link>
        </div>
      )}

      <Panel>
        <div className="grid gap-2 border-b p-3 sm:grid-cols-2 lg:grid-cols-6 sm:p-4">
          <SearchField value={search} onChange={setSearch} placeholder="Search employee" className="sm:col-span-2" />
          <select className={SELECT} aria-label="Department" value={filters.departmentId ?? ''} onChange={(e) => set({ departmentId: e.target.value ? Number(e.target.value) : undefined })}>
            <option value="">All departments</option>
            {lookups.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select className={SELECT} aria-label="Branch" value={filters.branchId ?? ''} onChange={(e) => set({ branchId: e.target.value ? Number(e.target.value) : undefined })}>
            <option value="">All branches</option>
            {lookups.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select className={SELECT} aria-label="Shift" value={filters.shiftId ?? ''} onChange={(e) => set({ shiftId: e.target.value ? Number(e.target.value) : undefined })}>
            <option value="">All shifts</option>
            {lookups.shifts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className={SELECT} aria-label="Device" value={filters.deviceId ?? ''} onChange={(e) => set({ deviceId: e.target.value ? Number(e.target.value) : undefined })}>
            <option value="">All devices</option>
            {lookups.devices.map((d) => <option key={d.id} value={d.id}>{d.deviceName}</option>)}
          </select>
        </div>
        {filters.status && (
          <div className="flex items-center gap-2 border-b bg-slate-50 px-4 py-2 text-xs text-slate-600">
            Showing <b>{statusMeta(filters.status).label}</b>
            <button type="button" className="text-primary hover:underline" onClick={() => set({ status: undefined })}>Show everyone</button>
          </div>
        )}

        {loading && !data ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">No employees match these filters.</div>
        ) : (
          <>
            {/* Desktop / tablet table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">Employee</th>
                    <th className="px-3 py-2.5">Check in</th>
                    <th className="px-3 py-2.5">Check out</th>
                    <th className="px-3 py-2.5">Hours</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Shift</th>
                    <th className="px-3 py-2.5">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r) => {
                    const m = statusMeta(r.status);
                    return (
                      <tr key={r.employeeId} className="hover:bg-slate-50/60">
                        <td className="px-4 py-2.5">
                          <PersonChip name={r.employeeName} size="sm" to={`/hr/employees/${r.employeeId}?tab=attendance`}
                            sub={[r.employeeCode, r.department].filter(Boolean).join(' · ')} />
                        </td>
                        <td className="px-3 py-2.5 tabular-nums">
                          {fmtClock(r.checkIn)}
                          {!!r.lateMinutes && <span className="ml-1.5 text-[11px] text-amber-700">+{r.lateMinutes}m</span>}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums">
                          {r.checkedInNow ? <span className="text-emerald-700">In office</span> : fmtClock(r.checkOut)}
                          {!!r.earlyDepartureMinutes && !r.checkedInNow && <span className="ml-1.5 text-[11px] text-slate-500">−{r.earlyDepartureMinutes}m</span>}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums">
                          {r.workingMinutes != null ? fmtMinutes(r.workingMinutes) : '—'}
                          {!!r.overtimeMinutes && <span className="ml-1.5 text-[11px] text-sky-700">OT {fmtMinutes(r.overtimeMinutes)}</span>}
                        </td>
                        <td className="px-3 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${m.pill}`}>{m.label}</span></td>
                        <td className="px-3 py-2.5 text-slate-600">{r.shift ?? '—'}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-500">
                          {r.biometricVerified
                            ? <span className="inline-flex items-center gap-1"><Fingerprint className="h-3.5 w-3.5 text-emerald-600" />{r.device ?? 'Biometric'}</span>
                            : r.checkInMethod ? r.checkInMethod.replace(/_/g, ' ').toLowerCase()
                            : !r.enrolled ? <span className="text-amber-700">Not enrolled</span> : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Phone cards */}
            <ul className="divide-y md:hidden">
              {rows.map((r) => {
                const m = statusMeta(r.status);
                return (
                  <li key={r.employeeId} className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <PersonChip name={r.employeeName} size="sm" to={`/hr/employees/${r.employeeId}?tab=attendance`} sub={r.employeeCode} />
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${m.pill}`}>{m.label}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs tabular-nums text-slate-600">
                      <span>In <b className="text-slate-900">{fmtClock(r.checkIn)}</b></span>
                      <span>Out <b className="text-slate-900">{r.checkedInNow ? '—' : fmtClock(r.checkOut)}</b></span>
                      <span>{fmtMinutes(r.workingMinutes)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Panel>
    </div>
  );
}

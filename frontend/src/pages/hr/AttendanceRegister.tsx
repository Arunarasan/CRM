import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, Pencil } from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FilterChips, PersonChip, SearchField } from "@/pages/workforce/hrUi";

type RowStatus = "IN" | "DONE" | "LEAVE" | "NOT_IN" | "UPCOMING";
interface DayRow {
  id: number; name: string; code?: string; designation?: string; status: RowStatus;
  checkIn?: string | null; checkOut?: string | null; workedHours?: number | null; overtimeHours?: number | null;
  punches?: number; pending?: number; leaveType?: string;
}
interface DayResponse {
  date: string; today: boolean;
  counts: { staff: number; in: number; done: number; leave: number; notIn: number; waiting: number };
  rows: DayRow[];
}
type Filter = "ALL" | "PRESENT" | "NOT_IN" | "LEAVE" | "WAITING";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const hm = (t?: string | null) => (t ? t.slice(0, 5) : "—");
const hrs = (v: any) => (v == null ? "—" : `${Number(v).toFixed(1).replace(/\.0$/, "")} h`);
const STATUS: Record<RowStatus, { label: string; cls: string }> = {
  IN: { label: "In now", cls: "bg-emerald-100 text-emerald-800" },
  DONE: { label: "Done", cls: "bg-slate-100 text-slate-700" },
  LEAVE: { label: "On leave", cls: "bg-sky-100 text-sky-800" },
  NOT_IN: { label: "Not in", cls: "bg-amber-100 text-amber-800" },
  UPCOMING: { label: "—", cls: "bg-slate-50 text-slate-400" },
};

/**
 * Who came in on a given day: status, first in, last out, hours and overtime for every staff
 * member, plus any punches still waiting for approval. "Fix time" opens the correction form
 * filled in for that person and day.
 */
export default function AttendanceRegister({ onFix }: {
  onFix: (p: { employeeId: string; date: string; checkIn?: string; checkOut?: string }) => void;
}) {
  const [date, setDate] = useState(() => iso(new Date()));
  const [data, setData] = useState<DayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [q, setQ] = useState("");

  const load = () => {
    setLoading(true);
    setError(false);
    api.get<DayResponse>("/hr/attendance/day", { params: { date } })
      .then((r) => setData(r.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };
  useEffect(load, [date]);

  const step = (days: number) => {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + days);
    setDate(iso(d));
  };
  const isToday = date === iso(new Date());

  const rows = data?.rows ?? [];
  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "PRESENT" && r.status !== "IN" && r.status !== "DONE") return false;
      if (filter === "NOT_IN" && r.status !== "NOT_IN") return false;
      if (filter === "LEAVE" && r.status !== "LEAVE") return false;
      if (filter === "WAITING" && !(r.pending && r.pending > 0)) return false;
      return !s || r.name.toLowerCase().includes(s) || (r.code || "").toLowerCase().includes(s);
    });
  }, [rows, filter, q]);

  const c = data?.counts;
  const label = new Date(date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const fix = (r: DayRow) => onFix({ employeeId: String(r.id), date, checkIn: r.checkIn?.slice(0, 5), checkOut: r.checkOut?.slice(0, 5) });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => step(-1)} aria-label="Previous day"
            className="grid h-10 w-10 place-items-center rounded-md border border-input bg-card text-slate-600 hover:bg-slate-50"><ChevronLeft className="h-4 w-4" /></button>
          <input type="date" value={date} max={iso(new Date())} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Day"
            className="h-10 rounded-md border border-input bg-card px-3 text-sm font-medium text-slate-900" />
          <button type="button" onClick={() => step(1)} aria-label="Next day" disabled={isToday}
            className="grid h-10 w-10 place-items-center rounded-md border border-input bg-card text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
          {!isToday && <Button variant="ghost" size="sm" onClick={() => setDate(iso(new Date()))}>Today</Button>}
        </div>
        <p className="text-sm text-slate-500">{label}</p>
      </div>

      {error ? (
        <div className="rounded-xl border bg-card p-8 text-center">
          <p className="font-medium text-slate-900">Couldn't load attendance for this day.</p>
          <Button className="mt-3" variant="outline" onClick={load}>Try again</Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Count label={isToday ? "Came in" : "Present"} value={c ? c.in + c.done : "—"} of={c?.staff} tone="text-emerald-700" />
            <Count label="On leave" value={c?.leave ?? "—"} tone="text-sky-700" />
            <Count label={isToday ? "Not in yet" : "Absent"} value={c?.notIn ?? "—"} tone={c && c.notIn > 0 ? "text-amber-700" : "text-slate-900"} />
            <Count label="Punches to approve" value={c?.waiting ?? "—"} tone={c && c.waiting > 0 ? "text-amber-700" : "text-slate-900"} />
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <FilterChips<Filter>
              value={filter} onChange={setFilter}
              options={[
                { key: "ALL", label: "Everyone", count: c?.staff },
                { key: "PRESENT", label: "Present", count: c ? c.in + c.done : undefined },
                { key: "NOT_IN", label: isToday ? "Not in" : "Absent", count: c?.notIn },
                { key: "LEAVE", label: "On leave", count: c?.leave },
                ...(c && c.waiting > 0 ? [{ key: "WAITING" as Filter, label: "Waiting approval", count: rows.filter((r) => (r.pending ?? 0) > 0).length }] : []),
              ]}
            />
            <SearchField value={q} onChange={setQ} placeholder="Search employee or code…" className="md:w-64" />
          </div>

          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            {loading && !data ? (
              <div className="space-y-3 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
            ) : visible.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="font-medium text-slate-900">No one here</p>
                <p className="mt-1 text-sm text-slate-500">Try another filter or day.</p>
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-slate-50/70 text-xs text-slate-500">
                      <tr>
                        <th className="px-3 py-2.5 text-left font-medium">Employee</th>
                        <th className="px-3 py-2.5 text-left font-medium">Status</th>
                        <th className="px-3 py-2.5 text-left font-medium">In</th>
                        <th className="px-3 py-2.5 text-left font-medium">Out</th>
                        <th className="px-3 py-2.5 text-right font-medium">Hours</th>
                        <th className="px-3 py-2.5"><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {visible.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50/60">
                          <td className="px-3 py-2.5"><PersonChip name={r.name} sub={[r.code, r.designation].filter(Boolean).join(" · ")} to={`/hr/employees/${r.id}`} size="sm" /></td>
                          <td className="px-3 py-2.5"><StatusCell r={r} /></td>
                          <td className="px-3 py-2.5 tabular-nums text-slate-700">{hm(r.checkIn)}</td>
                          <td className="px-3 py-2.5 tabular-nums text-slate-700"><OutCell r={r} /></td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            <span className="text-slate-900">{hrs(r.workedHours)}</span>
                            {Number(r.overtimeHours || 0) > 0 && <div className="text-[11px] text-slate-500">{hrs(r.overtimeHours)} OT</div>}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            {r.status !== "UPCOMING" && (
                              <Button size="sm" variant="ghost" onClick={() => fix(r)} aria-label={`Fix time for ${r.name}`}><Pencil className="mr-1 h-3.5 w-3.5" /> Fix time</Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ul className="divide-y md:hidden">
                  {visible.map((r) => (
                    <li key={r.id} className="space-y-2 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <PersonChip name={r.name} sub={[r.code, r.designation].filter(Boolean).join(" · ")} to={`/hr/employees/${r.id}`} size="sm" />
                        <StatusCell r={r} />
                      </div>
                      {(r.status === "IN" || r.status === "DONE") && (
                        <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-2.5 text-sm">
                          <Mini label="In" value={hm(r.checkIn)} />
                          <Mini label="Out" value={<OutCell r={r} />} />
                          <Mini label="Hours" value={hrs(r.workedHours)} />
                        </div>
                      )}
                      {r.status !== "UPCOMING" && (
                        <div className="flex justify-end">
                          <Button size="sm" variant="outline" onClick={() => fix(r)}><Pencil className="mr-1 h-3.5 w-3.5" /> Fix time</Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Last clock-out — "In now" while they're still clocked in today, "Missing" if a past day never closed. */
function OutCell({ r }: { r: DayRow }) {
  if (r.status === "IN") return <span className="text-emerald-700">In now</span>;
  if (r.status === "DONE" && !r.checkOut) return <span className="font-medium text-amber-700">Missing</span>;
  return <>{hm(r.checkOut)}</>;
}

function StatusCell({ r }: { r: DayRow }) {
  const s = STATUS[r.status];
  return (
    <div className="flex flex-col items-start gap-1">
      <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}>
        {r.status === "LEAVE" && r.leaveType ? `On leave · ${r.leaveType.charAt(0) + r.leaveType.slice(1).toLowerCase()}` : s.label}
      </span>
      {(r.pending ?? 0) > 0 && (
        <span className="inline-flex items-center gap-1 text-[11px] text-amber-700"><Clock className="h-3 w-3" /> {r.pending} to approve</span>
      )}
    </div>
  );
}

function Count({ label, value, of, tone }: { label: string; value: React.ReactNode; of?: number; tone: string }) {
  return (
    <div className="rounded-xl border bg-card px-3 py-2.5 shadow-sm">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-xl font-semibold tabular-nums ${tone}`}>{value}{of != null && <span className="text-sm font-normal text-slate-400"> / {of}</span>}</div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="font-medium tabular-nums text-slate-900">{value}</div>
    </div>
  );
}

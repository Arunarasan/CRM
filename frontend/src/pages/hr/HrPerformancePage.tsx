import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { gradeStyle } from "./PerformanceScoreCard";

/**
 * Auto-calculated performance scorecards for every employee. Extracted from the old
 * Human Resources "Performance" tab when HR + Workforce merged into one module.
 */
export default function HrPerformancePage() {
  const [scores, setScores] = useState<any[]>([]);

  useEffect(() => {
    api.get(`/hr/performance/scores`).then(res => setScores(res.data || [])).catch(() => setScores([]));
  }, []);

  const scored = scores.filter(s => s.score != null);
  const avg = scored.length ? Math.round(scored.reduce((a, s) => a + s.score, 0) / scored.length) : null;
  const top = scored[0];
  const dist = { A: 0, B: 0, C: 0, D: 0 } as Record<string, number>;
  scored.forEach(s => { if (dist[s.grade] != null) dist[s.grade]++; });

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-bold uppercase text-slate-400">Team Average</p>
          <p className="text-3xl font-black text-slate-900 mt-1">{avg != null ? avg : '—'}<span className="text-base text-slate-400 font-bold">/100</span></p>
        </div>
        <div className="bg-white border rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-bold uppercase text-slate-400">Scored Employees</p>
          <p className="text-3xl font-black text-slate-900 mt-1">{scored.length}<span className="text-base text-slate-400 font-bold">/{scores.length}</span></p>
        </div>
        <div className="bg-white border rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-bold uppercase text-slate-400">Top Performer</p>
          <p className="text-lg font-black text-slate-900 mt-1 truncate">{top ? top.employeeName : '—'}</p>
          <p className="text-xs font-bold text-emerald-600">{top ? `${top.score}/100 · Grade ${top.grade}` : ''}</p>
        </div>
        <div className="bg-white border rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-bold uppercase text-slate-400">Grade Spread</p>
          <div className="flex gap-2 mt-2 text-xs font-bold">
            <span className="text-emerald-600">A:{dist.A}</span>
            <span className="text-emerald-600">B:{dist.B}</span>
            <span className="text-amber-600">C:{dist.C}</span>
            <span className="text-red-600">D:{dist.D}</span>
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Employee</TableHead>
              <TableHead>Score</TableHead>
              <TableHead className="hidden md:table-cell">Attendance</TableHead>
              <TableHead className="hidden md:table-cell">Tasks</TableHead>
              <TableHead className="hidden md:table-cell">Reviews</TableHead>
              <TableHead className="text-right">Profile</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scores.map(s => {
              const gs = gradeStyle(s.grade);
              return (
                <TableRow key={s.employeeId}>
                  <TableCell>
                    <p className="font-bold text-slate-800">{s.employeeName}</p>
                    <p className="text-xs text-slate-500">{s.designation || 'Employee'}{s.department ? ` · ${s.department}` : ''}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-900 text-lg w-9">{s.score != null ? s.score : '—'}</span>
                      <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${gs.bg} ${gs.text}`}>{gs.label}</span>
                    </div>
                    <div className="h-1.5 w-28 rounded-full bg-slate-100 overflow-hidden mt-1">
                      <div className="h-full rounded-full bg-slate-800" style={{ width: `${s.score ?? 0}%` }} />
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm font-semibold text-slate-600">
                    {s.attendance?.score != null ? `${s.attendance.score}` : '—'}
                    <span className="text-xs text-slate-400 block">{s.attendance?.present ?? 0}P/{s.attendance?.absent ?? 0}A</span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm font-semibold text-slate-600">
                    {s.tasks?.score != null ? `${s.tasks.score}` : '—'}
                    <span className="text-xs text-slate-400 block">{s.tasks?.completed ?? 0}/{s.tasks?.total ?? 0} done</span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm font-semibold text-slate-600">
                    {s.reviews?.score != null ? `${s.reviews.score}` : '—'}
                    <span className="text-xs text-slate-400 block">{s.reviews?.avgRating ?? '—'}/5 ({s.reviews?.count ?? 0})</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link to={`/hr/employees/${s.employeeId}`}>
                      <Button variant="ghost" size="icon"><ArrowRight className="w-4 h-4" /></Button>
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
            {scores.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-12 text-slate-500">No employees found.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

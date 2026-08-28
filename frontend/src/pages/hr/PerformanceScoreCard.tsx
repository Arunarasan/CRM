import { CalendarClock, ListChecks, Star } from "lucide-react";

/** Colour + label for a 0–100 score / letter grade. */
export function gradeStyle(grade: string) {
  switch (grade) {
    case "A": return { label: "Excellent", text: "text-emerald-700", bg: "bg-emerald-100", ring: "text-emerald-500" };
    case "B": return { label: "Good",      text: "text-emerald-700",    bg: "bg-emerald-100",    ring: "text-emerald-500" };
    case "C": return { label: "Average",   text: "text-amber-700",   bg: "bg-amber-100",   ring: "text-amber-500" };
    case "D": return { label: "Needs Work", text: "text-red-700",     bg: "bg-red-100",     ring: "text-red-500" };
    default:  return { label: "No Data",   text: "text-slate-500",   bg: "bg-slate-100",   ring: "text-slate-300" };
  }
}

function ScoreDial({ score, grade }: { score: number | null; grade: string }) {
  const s = gradeStyle(grade);
  const pct = score ?? 0;
  const r = 44, c = 2 * Math.PI * r;
  return (
    <div className="relative w-32 h-32 shrink-0">
      <svg viewBox="0 0 100 100" className="w-32 h-32 -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="9" className="text-slate-100" stroke="currentColor" />
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="9" strokeLinecap="round"
                className={s.ring} stroke="currentColor"
                strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black text-slate-900">{score != null ? score : "—"}</span>
        <span className={`text-xs font-bold uppercase tracking-wider ${s.text}`}>Grade {grade}</span>
      </div>
    </div>
  );
}

function MetricBar({ icon, title, score, detail, weight }: {
  icon: React.ReactNode; title: string; score: number | null; detail: string; weight: number;
}) {
  return (
    <div className="flex-1 min-w-[180px]">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700">{icon} {title}</div>
        <span className="text-sm font-black text-slate-900">{score != null ? `${score}` : "—"}
          <span className="text-xs font-semibold text-slate-400"> /100</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full bg-slate-800 transition-all" style={{ width: `${score ?? 0}%` }} />
      </div>
      <p className="text-xs text-slate-500 mt-1">{detail} <span className="text-slate-300">• {Math.round(weight * 100)}% weight</span></p>
    </div>
  );
}

/** Full performance breakdown card — used on the employee profile. */
export default function PerformanceScoreCard({ card }: { card: any }) {
  const s = gradeStyle(card.grade);
  const att = card.attendance || {};
  const tsk = card.tasks || {};
  const rev = card.reviews || {};
  return (
    <div className="bg-white border rounded-2xl p-6 shadow-sm">
      <div className="flex flex-col md:flex-row gap-6 items-center md:items-stretch">
        <div className="flex items-center gap-5">
          <ScoreDial score={card.score} grade={card.grade} />
          <div>
            <h3 className="font-bold text-slate-800 text-lg">Performance Score</h3>
            <span className={`inline-block mt-1 px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full ${s.bg} ${s.text}`}>{s.label}</span>
            <p className="text-xs text-slate-400 mt-2 max-w-[200px]">Auto-calculated from attendance, task delivery and manual reviews.</p>
          </div>
        </div>
        <div className="flex-1 flex flex-wrap gap-6 md:border-l md:pl-6 border-slate-100">
          <MetricBar icon={<CalendarClock className="w-4 h-4 text-slate-400" />} title="Attendance" score={att.score} weight={att.weight ?? 0.4}
                     detail={`${att.present ?? 0} present · ${att.halfDay ?? 0} half · ${att.absent ?? 0} absent (${att.windowDays ?? 90}d)`} />
          <MetricBar icon={<ListChecks className="w-4 h-4 text-slate-400" />} title="Tasks" score={tsk.score} weight={tsk.weight ?? 0.35}
                     detail={`${tsk.completed ?? 0}/${tsk.total ?? 0} done · ${tsk.onTime ?? 0} on-time · ${tsk.overdue ?? 0} late`} />
          <MetricBar icon={<Star className="w-4 h-4 text-slate-400" />} title="Reviews" score={rev.score} weight={rev.weight ?? 0.25}
                     detail={`${rev.count ?? 0} review(s) · avg ${rev.avgRating ?? '—'}/5`} />
        </div>
      </div>
    </div>
  );
}

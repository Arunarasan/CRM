import { CheckCircle2, ChevronRight } from "lucide-react";

type Icon = React.ComponentType<{ className?: string }>;

/** ₹ in lakh/crore shorthand for headline tiles (full value goes in the title). */
export const inrCompact = (n?: number | null) => {
  const v = Number(n || 0);
  const a = Math.abs(v);
  const s = a >= 1e7 ? `${+(v / 1e7).toFixed(2)}Cr` : a >= 1e5 ? `${+(v / 1e5).toFixed(2)}L` : a >= 1e3 ? `${+(v / 1e3).toFixed(1)}K` : `${Math.round(v)}`;
  return `₹${s}`;
};
export type Tone = "danger" | "warning" | "info";

const TONE: Record<Tone, string> = {
  danger: "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100",
  warning: "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100",
  info: "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100",
};

export interface AttentionItem { key: string; tone: Tone; icon: Icon; label: string; detail?: string; onClick: () => void }

/** What needs a decision on this project right now — most severe first, each a jump to where it's fixed. */
export function AttentionBar({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-2.5 text-sm text-emerald-800">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span><span className="font-semibold">On track.</span> No overdue dates, delayed tasks, open issues or pending approvals.</span>
      </div>
    );
  }
  const order: Tone[] = ["danger", "warning", "info"];
  const sorted = [...items].sort((a, b) => order.indexOf(a.tone) - order.indexOf(b.tone));
  return (
    <section aria-label="Needs attention" className="rounded-2xl border border-slate-100 bg-white px-3 py-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex flex-col @3xl:flex-row @3xl:items-center gap-2">
        <div className="flex items-center gap-2 px-1 shrink-0">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Needs attention</span>
          <span className="rounded-full bg-slate-900 px-1.5 text-[11px] font-bold text-white tabular-nums">{items.length}</span>
        </div>
        <div className="grid grid-cols-1 @md:grid-cols-2 @3xl:flex @3xl:flex-wrap gap-2 min-w-0">
          {sorted.map((a) => (
            <button key={a.key} type="button" onClick={a.onClick}
              className={`group flex min-h-[40px] items-center gap-2 rounded-xl border px-3 py-1.5 text-left text-[13px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${TONE[a.tone]}`}>
              <a.icon className="h-4 w-4 shrink-0" />
              <span className="min-w-0 truncate"><span className="font-semibold">{a.label}</span>{a.detail && <span className="opacity-75"> · {a.detail}</span>}</span>
              <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 opacity-50 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Headline number + a progress bar + one line of context. The whole tile opens the detail. */
export function KpiTile({ icon: I, label, value, suffix, pct, marker, barTone = "bg-emerald-600", sub, subTone = "text-slate-500", onClick, title }: {
  icon: Icon; label: string; value: React.ReactNode; suffix?: string;
  /** 0–100 fill of the bar; omit to hide the bar. */
  pct?: number;
  /** Optional reference tick on the bar (e.g. % of the schedule elapsed). */
  marker?: { pct: number; label: string };
  barTone?: string; sub?: React.ReactNode; subTone?: string; onClick?: () => void; title?: string;
}) {
  return (
    <button type="button" onClick={onClick} title={title}
      className="group flex min-w-0 flex-col rounded-2xl border border-slate-100 bg-white p-3.5 @xl:p-4 text-left shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition hover:border-emerald-200 hover:shadow-[0_6px_20px_-8px_rgba(0,0,0,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-semibold text-slate-500">{label}</span>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500 transition group-hover:bg-emerald-50 group-hover:text-emerald-700"><I className="h-4 w-4" /></span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5 min-w-0">
        <span className="truncate text-xl @xl:text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{value}</span>
        {suffix && <span className="truncate text-xs font-medium text-slate-400">{suffix}</span>}
      </div>
      {pct !== undefined && (
        <div className="relative mt-2.5 h-1.5 w-full rounded-full bg-slate-100" role="progressbar" aria-label={label} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
          <div className={`h-1.5 rounded-full transition-all duration-500 ${barTone}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
          {marker && (
            <span title={marker.label} className="absolute -top-1 h-3.5 w-0.5 rounded-full bg-slate-700" style={{ left: `calc(${Math.max(0, Math.min(100, marker.pct))}% - 1px)` }} />
          )}
        </div>
      )}
      {sub && <div className={`mt-2 line-clamp-2 text-xs leading-snug ${subTone}`}>{sub}</div>}
    </button>
  );
}

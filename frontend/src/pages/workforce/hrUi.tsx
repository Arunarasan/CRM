import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";

/**
 * Shared building blocks for the HR & Payroll module, so every tab (directory, payroll,
 * attendance, leave, performance…) uses the same header, tiles, status pills, filters and
 * period picker. Presentation only — no data fetching lives here.
 */

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const initials = (name?: string | null) =>
  (name || "?").trim().split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();

/** Page/section heading: title + one-line description on the left, actions on the right (stacks on phones). */
export function SectionHeader({ icon: Icon, title, description, actions }: {
  icon?: LucideIcon; title: ReactNode; description?: ReactNode; actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900 md:text-lg">
          {Icon && <Icon className="h-5 w-5 shrink-0 text-primary" />}
          <span className="truncate">{title}</span>
        </h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
    </div>
  );
}

type Tone = "neutral" | "warning" | "danger" | "success" | "info";
const TONE_VALUE: Record<Tone, string> = {
  neutral: "text-slate-900",
  warning: "text-amber-700",
  danger: "text-rose-700",
  success: "text-emerald-700",
  info: "text-sky-700",
};
const TONE_DOT: Record<Tone, string> = {
  neutral: "bg-slate-300",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
  success: "bg-emerald-500",
  info: "bg-sky-500",
};

/** A single number with a label. Colour marks state (owed / overdue), never decoration. */
export function StatTile({ label, value, hint, tone = "neutral", onClick, active }: {
  label: string; value: ReactNode; hint?: ReactNode; tone?: Tone; onClick?: () => void; active?: boolean;
}) {
  const body = (
    <>
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[tone]}`} />
        <span className="truncate">{label}</span>
      </div>
      <div className={`mt-1 truncate text-lg font-semibold tabular-nums md:text-xl ${TONE_VALUE[tone]}`}>{value}</div>
      {hint && <div className="mt-0.5 truncate text-[11px] text-slate-400">{hint}</div>}
    </>
  );
  const cls = `min-w-0 rounded-xl border bg-card p-3 text-left shadow-sm md:p-4 ${active ? "ring-2 ring-primary/40" : ""}`;
  return onClick
    ? <button type="button" onClick={onClick} className={`${cls} transition-colors hover:border-slate-300`}>{body}</button>
    : <div className={cls}>{body}</div>;
}

const STATUS_TONE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  SUBMITTED: "bg-amber-100 text-amber-800",
  RECOMMENDED: "bg-violet-100 text-violet-700",
  APPROVED: "bg-sky-100 text-sky-800",
  REVIEWED: "bg-emerald-100 text-emerald-700",
  PAID: "bg-emerald-100 text-emerald-700",
  APPLIED: "bg-slate-100 text-slate-700",
  CONVERTED: "bg-emerald-100 text-emerald-700",
  ACTIVE: "bg-emerald-100 text-emerald-700",
  DUE: "bg-rose-100 text-rose-700",
  OVERDUE: "bg-rose-100 text-rose-700",
  REJECTED: "bg-rose-100 text-rose-700",
  CANCELLED: "bg-slate-100 text-slate-500",
};
const STATUS_LABEL: Record<string, string> = { PENDING: "To approve", APPROVED: "Approved", SUBMITTED: "New" };

/** Uniform status pill. `labels` lets a screen rename a status (e.g. APPROVED → "To pay"). */
export function StatusPill({ status, labels }: { status?: string | null; labels?: Record<string, string> }) {
  const s = status || "";
  const label = labels?.[s] ?? STATUS_LABEL[s] ?? (s ? s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ") : "—");
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[s] || "bg-slate-100 text-slate-600"}`}>
      {label}
    </span>
  );
}

/** Avatar + name + sub-line, linking to the person's record when `to` is set. */
export function PersonChip({ name, sub, to, tone = "employee", size = "md" }: {
  name?: string | null; sub?: ReactNode; to?: string; tone?: "employee" | "contractor"; size?: "sm" | "md";
}) {
  if (!name) return <span className="text-slate-400">—</span>;
  const avatar = tone === "contractor" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800";
  const dim = size === "sm" ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-xs";
  const body = (
    <>
      <span className={`grid shrink-0 place-items-center rounded-full font-semibold ${dim} ${avatar}`}>{initials(name)}</span>
      <span className="min-w-0">
        <span className="block truncate font-medium text-slate-900 group-hover:text-primary group-hover:underline">{name}</span>
        {sub && <span className="block truncate text-xs text-slate-500">{sub}</span>}
      </span>
    </>
  );
  return to
    ? <Link to={to} onClick={(e) => e.stopPropagation()} className="group flex min-w-0 items-center gap-2.5">{body}</Link>
    : <div className="flex min-w-0 items-center gap-2.5">{body}</div>;
}

/** Filter chips with counts — one row, scrolls sideways on narrow phones instead of wrapping into a wall. */
export function FilterChips<K extends string>({ options, value, onChange }: {
  options: { key: K; label: string; count?: number }[]; value: K; onChange: (k: K) => void;
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist">
      <div className="flex w-max gap-1.5">
        {options.map((o) => {
          const on = o.key === value;
          return (
            <button key={o.key} type="button" role="tab" aria-selected={on} onClick={() => onChange(o.key)}
              className={`inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-sm font-medium transition-colors ${
                on ? "border-primary bg-primary text-primary-foreground" : "border-slate-200 bg-card text-slate-600 hover:border-slate-300 hover:text-slate-900"}`}>
              {o.label}
              {o.count != null && (
                <span className={`rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${on ? "bg-white/20" : "bg-slate-100 text-slate-500"}`}>{o.count}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SearchField({ value, onChange, placeholder, className = "" }: {
  value: string; onChange: (v: string) => void; placeholder: string; className?: string;
}) {
  return (
    <label className={`relative flex h-10 items-center rounded-md border border-input bg-card focus-within:ring-2 focus-within:ring-ring/30 ${className}`}>
      <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}
        className="h-full w-full min-w-0 bg-transparent pl-9 pr-8 text-sm outline-none placeholder:text-slate-400" />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="Clear search"
          className="absolute right-2 rounded p-1 text-slate-400 hover:text-slate-700"><X className="h-3.5 w-3.5" /></button>
      )}
    </label>
  );
}

/** Month/year picker with previous/next steppers — the common case is "last month" or "next month". */
export function PeriodPicker({ month, year, onChange }: {
  month: number; year: number; onChange: (month: number, year: number) => void;
}) {
  const step = (d: number) => {
    const m = month + d;
    if (m < 1) onChange(12, year - 1);
    else if (m > 12) onChange(1, year + 1);
    else onChange(m, year);
  };
  const thisYear = new Date().getFullYear();
  const years = Array.from(new Set([thisYear - 3, thisYear - 2, thisYear - 1, thisYear, thisYear + 1, year])).sort();
  const btn = "grid h-10 w-10 shrink-0 place-items-center rounded-md border border-input bg-card text-slate-600 hover:bg-slate-50 hover:text-slate-900";
  const sel = "h-10 rounded-md border border-input bg-card px-2 text-sm font-semibold text-slate-900";
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" className={btn} onClick={() => step(-1)} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></button>
      <select className={`${sel} min-w-0 flex-1 sm:w-32 sm:flex-none`} value={month} aria-label="Month"
        onChange={(e) => onChange(Number(e.target.value), year)}>
        {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
      </select>
      <select className={`${sel} w-[5.5rem]`} value={year} aria-label="Year" onChange={(e) => onChange(month, Number(e.target.value))}>
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
      <button type="button" className={btn} onClick={() => step(1)} aria-label="Next month"><ChevronRight className="h-4 w-4" /></button>
    </div>
  );
}

/** Label/value pair for the phone-card layout of a list row. */
export function CardStat({ label, value, className = "" }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`truncate text-sm font-medium tabular-nums text-slate-900 ${className}`}>{value}</div>
    </div>
  );
}

/** Plain bordered panel used for every list/section in the module. */
export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border bg-card shadow-sm ${className}`}>{children}</section>;
}

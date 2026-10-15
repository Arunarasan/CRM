import { useEffect, type ReactNode } from "react";
import { X, type LucideIcon } from "lucide-react";

/** Shared building blocks for the Finance tabs so every screen reads the same way. */

export function Segmented<T extends string>({ value, onChange, options, label }: {
  value: T; onChange: (v: T) => void; label: string;
  options: { value: T; label: string; count?: number; icon?: LucideIcon }[];
}) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex max-w-full overflow-x-auto rounded-lg border bg-white p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button key={o.value} role="tab" aria-selected={active} onClick={() => onChange(o.value)}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
              active ? "bg-primary text-primary-foreground" : "text-slate-500 hover:text-slate-800"}`}>
            {o.icon && <o.icon className="h-4 w-4" />}
            {o.label}
            {o.count != null && o.count > 0 && (
              <span className={`rounded-full px-1.5 text-[11px] font-bold ${active ? "bg-white/25" : "bg-amber-100 text-amber-700"}`}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

const STAT_ACCENT = {
  in: "bg-emerald-500", out: "bg-rose-500", owed: "bg-amber-500", neutral: "bg-slate-400",
} as const;

/** One flat figure with a small colour key — replaces the heavy gradient summary cards. */
export function Stat({ label, value, sub, accent = "neutral", tone = "text-slate-900" }: {
  label: string; value: ReactNode; sub?: ReactNode; accent?: keyof typeof STAT_ACCENT; tone?: string;
}) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <span className={`h-2 w-2 rounded-full ${STAT_ACCENT[accent]}`} aria-hidden /> {label}
      </div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${tone}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

/** Filters live in one quiet bar above the data. */
export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-end gap-2 rounded-2xl border bg-white p-3 shadow-sm">{children}</div>;
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="px-4 py-12 text-center">
      <div className="text-sm font-semibold text-slate-700">{title}</div>
      {hint && <div className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{hint}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse divide-y" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4">
          <div className="h-3 w-20 rounded bg-slate-200" />
          <div className="h-3 flex-1 rounded bg-slate-200" />
          <div className="h-3 w-16 rounded bg-slate-200" />
        </div>
      ))}
    </div>
  );
}

/** Dialog shell: Escape and backdrop close it, becomes a bottom sheet on phones. */
export function Modal({ title, subtitle, onClose, children, width = "max-w-md", titleTone = "text-slate-900" }: {
  title: string; subtitle?: string; onClose: () => void; children: ReactNode; width?: string; titleTone?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title}
        className={`max-h-[92vh] w-full ${width} overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl sm:p-6`}
        onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className={`font-bold ${titleTone}`}>{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4">{children}</div>
      </div>
    </div>
  );
}

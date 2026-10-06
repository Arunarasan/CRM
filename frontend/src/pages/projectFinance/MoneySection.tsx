import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Shared shell for the blocks on a project's Commercial screen (schedule, invoices, payments) so they
 * read as one ledger: same surface, same header, actions on the right.
 */
export function MoneySection({ icon: Icon, title, subtitle, count, actions, children, id, className = "" }: {
  icon: LucideIcon;
  title: string;
  subtitle?: ReactNode;
  count?: number;
  actions?: ReactNode;
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <section id={id} className={`@container overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(17,24,23,0.04)] ${className}`}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Icon className="h-4 w-4 text-emerald-700" />
            {title}
            {count != null && (
              <span className="rounded-full bg-slate-100 px-1.5 py-px text-[11px] font-semibold tabular-nums text-slate-500">{count}</span>
            )}
          </h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      {children}
    </section>
  );
}

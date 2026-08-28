import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

/** Rupee formatter shared across the employee portal screens. */
export const inr = (v: number | undefined | null) =>
  v == null ? '₹0' : `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/** Sticky sub-page header with a back button — used by every portal detail screen. */
export function PortalHeader({ title, action }: { title: string; action?: ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-card px-2 py-2.5">
      <button
        onClick={() => navigate(-1)}
        className="flex h-9 w-9 items-center justify-center rounded-full active:bg-accent"
        aria-label="Back"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <h1 className="flex-1 text-base font-semibold">{title}</h1>
      {action}
    </div>
  );
}

/** Empty-state placeholder consistent with the mobile task module. */
export function EmptyState({ message }: { message: string }) {
  return <p className="p-8 text-center text-sm text-muted-foreground">{message}</p>;
}

/** Small colored status pill. */
export function StatusPill({ status }: { status: string }) {
  const tone: Record<string, string> = {
    PRESENT: 'bg-emerald-100 text-emerald-700',
    PAID: 'bg-emerald-100 text-emerald-700',
    APPROVED: 'bg-emerald-100 text-emerald-700',
    PENDING: 'bg-amber-100 text-amber-700',
    HALF_DAY: 'bg-amber-100 text-amber-700',
    NOT_MARKED: 'bg-slate-100 text-slate-600',
    NONE: 'bg-slate-100 text-slate-600',
    LEAVE: 'bg-emerald-100 text-emerald-700',
    ABSENT: 'bg-red-100 text-red-700',
    REJECTED: 'bg-red-100 text-red-700',
    APPLIED: 'bg-slate-200 text-slate-700',
    CONVERTED: 'bg-teal-100 text-teal-700',
    ACTIVE: 'bg-emerald-100 text-emerald-700',
    RECOVERING: 'bg-emerald-100 text-emerald-700',
    RECOVERED: 'bg-emerald-100 text-emerald-700',
    CLOSED: 'bg-slate-200 text-slate-700',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tone[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

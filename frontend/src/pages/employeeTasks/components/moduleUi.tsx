import { ReactNode } from 'react';

/**
 * Shared mobile UI primitives for the in-portal module screens (Site Visit, BOQ, Quotation).
 * Presentation only — matches the forest/ivory look of the task-execution screens so the whole
 * field flow feels like one app. No business logic lives here.
 */

export const inr = (n?: number) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export const CARD = 'rounded-2xl border border-[#ECEAE5] bg-white shadow-[0_2px_10px_rgba(0,35,22,0.04)]';
export const PRIMARY_BTN =
  'flex w-full items-center justify-center gap-2 rounded-xl bg-[#0A573B] py-3.5 text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-60';

/** Soft status chip for a BOQ / Quotation document state. */
export function DocStatus({ status }: { status?: string }) {
  if (!status) return null;
  const s = status.toUpperCase();
  const cls =
    s === 'APPROVED' || s === 'CONVERTED' || s === 'SENT'
      ? 'bg-[#E7F2EC] text-[#28704F]'
      : s === 'REJECTED'
      ? 'bg-[#FBE2E0] text-[#B94B45]'
      : 'bg-[#FBEED0] text-[#9D6B10]';
  return <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${cls}`}>{s.replace(/_/g, ' ')}</span>;
}

/** Context header: who the document is for, its reference numbers, and its status. */
export function LeadContext({
  name, sub, refs = [], status,
}: {
  name?: string;
  sub?: string;
  refs?: (string | null | undefined)[];
  status?: ReactNode;
}) {
  return (
    <div className={`${CARD} p-3.5`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold text-[#111817]">{name ?? 'Loading…'}</p>
          {sub && <p className="mt-0.5 truncate text-[12px] text-[#7A817C]">{sub}</p>}
        </div>
        {status}
      </div>
      {refs.filter(Boolean).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {refs.filter(Boolean).map((r) => (
            <span key={r as string} className="rounded-md bg-[#F1F3F1] px-1.5 py-0.5 font-mono text-[10.5px] text-[#5B625E]">{r}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Totals block — light rows plus an emphasised grand total. */
export function Totals({ rows, grandLabel = 'Grand Total', grand }: {
  rows: { label: string; value: string }[]; grandLabel?: string; grand?: number;
}) {
  return (
    <div className={`${CARD} p-4 text-sm`}>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between py-1 text-[#5B625E]">
          <span>{r.label}</span><span className="font-medium text-[#2C332F] tabular-nums">{r.value}</span>
        </div>
      ))}
      <div className="mt-1.5 flex items-center justify-between border-t border-[#EDECE8] pt-2.5">
        <span className="text-[15px] font-bold text-[#111817]">{grandLabel}</span>
        <span className="text-[18px] font-extrabold text-[#0A573B] tabular-nums">{inr(grand)}</span>
      </div>
    </div>
  );
}

/** Sticky bottom action bar sitting just above the portal's bottom nav. */
export function BottomBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed bottom-16 left-1/2 z-20 w-full max-w-md -translate-x-1/2 border-t border-[#EDEBE6] bg-white px-3 py-2.5 shadow-[0_-2px_10px_rgba(0,0,0,0.06)]">
      {children}
    </div>
  );
}

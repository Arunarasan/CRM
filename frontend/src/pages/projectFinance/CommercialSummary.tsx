import { AlertTriangle } from "lucide-react";

const inr = (n?: number | null) =>
  "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

/**
 * The money strip at the top of a project's Commercial tab: contract value with one bar showing how
 * much is received, billed-but-unpaid and not billed yet, then the four numbers people act on. Each
 * number opens the block below that explains it.
 */
export default function CommercialSummary({ project, profitability, activeSection, onOpen }: {
  project: any;
  profitability: any;
  activeSection: string;
  onOpen: (section: string) => void;
}) {
  const pf = profitability;
  const contract = Number(pf?.quotationValue ?? project.estimatedCost ?? project.budget ?? 0);
  const invoiced = Number(pf?.revenue ?? 0);
  const received = Number(pf?.collected ?? 0);
  const due = Number(pf?.outstanding ?? 0);
  const collectedPct = contract ? Math.min(100, Math.round((received / contract) * 100)) : 0;
  const profit = pf ? Number(pf.cashProfit ?? 0) : null;
  // One bar across the contract: received · billed but unpaid · not billed yet.
  const pct = (n: number) => (contract ? Math.max(0, Math.min(100, (n / contract) * 100)) : 0);
  const receivedW = pct(received);
  const dueW = Math.max(0, Math.min(100 - receivedW, pct(invoiced) - receivedW));
  const unbilled = Math.max(0, contract - Math.max(invoiced, received));
  const stats: { label: string; value: string; sub: string; go: string; tone?: string }[] = [
    { label: 'Invoiced', value: pf ? inr(invoiced) : '—', sub: contract && pf ? `${Math.round(pct(invoiced))}% of contract` : 'bills raised', go: 'payments' },
    { label: 'Received', value: pf ? inr(received) : '—', sub: `${collectedPct}% collected`, go: 'received' },
    { label: 'Balance due', value: pf ? inr(due) : '—', sub: due > 0 ? 'billed, not yet paid' : 'nothing due', go: 'payments', tone: due > 0 ? 'text-rose-700' : undefined },
    { label: 'Profit', value: profit === null ? '—' : inr(profit), sub: pf ? `${Number(pf.cashMarginPercent ?? 0).toFixed(1)}% margin · cash` : 'finance access needed', go: 'profit', tone: profit !== null && profit < 0 ? 'text-rose-700' : undefined },
  ];
  return (
    <div className="@container mb-3 space-y-2.5">
      <section aria-label="Project money summary" className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(17,24,23,0.04)]">
        <div className="grid grid-cols-1 @4xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)]">
          {/* Contract and how much of it is billed / collected */}
          <div className="border-b border-slate-100 p-4 @4xl:border-b-0 @4xl:border-r">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500">Contract value</p>
                <p className="mt-0.5 truncate text-2xl font-semibold tracking-tight tabular-nums text-slate-900">{inr(contract)}</p>
              </div>
              <button type="button" onClick={() => onOpen('quote')}
                className={`shrink-0 rounded-md px-2 py-1 text-xs font-medium transition-colors ${activeSection === 'quote' ? 'bg-emerald-50 text-emerald-800' : 'text-emerald-700 hover:bg-emerald-50'}`}>
                View quote
              </button>
            </div>
            <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-100" role="img"
              aria-label={`${inr(received)} received, ${inr(Math.max(0, invoiced - received))} billed and unpaid, ${inr(unbilled)} not billed yet`}>
              <div className="h-full bg-emerald-600 transition-[width] duration-500" style={{ width: `${receivedW}%` }} />
              <div className="h-full bg-amber-400 transition-[width] duration-500" style={{ width: `${dueW}%` }} />
            </div>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
              <li className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-600" /> Received</li>
              <li className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" /> Billed, unpaid</li>
              <li className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-200" /> Not billed <span className="tabular-nums text-slate-700">{inr(unbilled)}</span></li>
            </ul>
          </div>
          {/* The four numbers people act on — each opens its block below */}
          <div className="grid grid-cols-2 gap-px bg-slate-100 @3xl:grid-cols-4">
            {stats.map((t) => {
              const isActive = activeSection === t.go;
              return (
                <button key={t.label} type="button" onClick={() => onOpen(t.go)}
                  className={`min-w-0 px-4 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-300 ${isActive ? 'bg-slate-50' : 'bg-white'}`}>
                  <span className="block text-xs font-medium text-slate-500">{t.label}</span>
                  <span className={`mt-1 block truncate text-lg font-semibold tabular-nums leading-tight ${t.tone || 'text-slate-900'}`}>{t.value}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-slate-400">{t.sub}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>
      {Number(pf?.excessPaid ?? 0) > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
          <div>
            <div className="font-semibold">Customer has paid {inr(Number(pf?.excessPaid))} more than the contract value</div>
            <div className="text-xs text-amber-800/80">Received {inr(received)} against a contract of {inr(Number(pf?.quotationValue ?? 0))} after a quote change. Refund it or adjust it against other work.</div>
          </div>
        </div>
      )}
    </div>
  );
}

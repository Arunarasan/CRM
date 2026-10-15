import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, X, Phone, MapPin, Package, Truck, FolderKanban, User, ChevronRight, IndianRupee, Star, CalendarClock } from 'lucide-react';
import { employeePortalApi } from '@/api/employeePortalApi';
import type { PortalSearchResult, PortalSearchTask } from '@/types/employeePortal';
import { inr } from '../employeePortal/_shared';
import { useGoBack } from '@/hooks/useGoBack';
import { useT } from '@/i18n';

const CARD = 'rounded-2xl border border-[#ECEAE5] bg-white shadow-[0_4px_14px_rgba(0,35,22,0.05)]';

const dueText = (d?: string | null) => {
  if (!d) return '';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

function Pending({ amount }: { amount?: number | null }) {
  const { t } = useT();
  const n = Number(amount ?? 0);
  return (
    <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${n > 0 ? 'bg-[#FBEAE8] text-[#B94B45]' : 'bg-[#E7F2EC] text-[#28704F]'}`}>
      <IndianRupee className="h-3 w-3" />
      {n > 0 ? `${t('portal.search.pending')} ${inr(n)}` : t('portal.search.noPending')}
    </span>
  );
}

function Tasks({ tasks }: { tasks?: PortalSearchTask[] }) {
  const { t } = useT();
  const navigate = useNavigate();
  if (!tasks || tasks.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#858B87]">{t('portal.search.openTasks')}</p>
      <div className="divide-y divide-[#ECEBE7] overflow-hidden rounded-xl border border-[#ECEAE5]">
        {tasks.map((k) => (
          <button key={k.id} onClick={() => navigate(`/employee/tasks/${k.id}`)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left active:bg-[#F7F7F5]">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-[#111817]">{k.taskName}</span>
              <span className="block truncate text-[11px] text-[#7A817C]">
                {[k.projectName, k.dueDate ? dueText(k.dueDate) : null, k.progress ? `${k.progress}%` : null].filter(Boolean).join(' · ')}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-[#B9C0BB]" />
          </button>
        ))}
      </div>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  if (count === 0) return null;
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 px-0.5 text-[15px] font-semibold text-[#111817]">
        {title}
        <span className="rounded-full bg-[#EEF0EE] px-1.5 text-[11px] font-semibold text-[#5B625E]">{count}</span>
      </h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:items-start [&>*]:min-w-0">{children}</div>
    </section>
  );
}

/** Universal portal search: customer phone/name, lead, project, shipping ID or order code → everything on one page. */
export default function PortalSearch() {
  const { t } = useT();
  const goBack = useGoBack('/employee');
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [result, setResult] = useState<PortalSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    setParams(term ? { q: term } : {}, { replace: true });
    if (term.length < 2) { setResult(null); setLoading(false); setError(''); return; }
    setLoading(true);
    const id = ++seq.current;
    const timer = window.setTimeout(() => {
      employeePortalApi.search(term)
        .then((r) => { if (id === seq.current) { setResult(r); setError(''); } })
        .catch(() => { if (id === seq.current) setError(t('portal.search.failed')); })
        .finally(() => { if (id === seq.current) setLoading(false); });
    }, 350);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const none = result && !result.customers.length && !result.leads.length && !result.projects.length && !result.parcels.length;

  return (
    <div className="flex flex-col gap-4 p-3.5">
      <div className="sticky top-0 z-10 -mx-3.5 -mt-3.5 flex items-center gap-2 bg-[#F7F7F5] px-3.5 pb-2 pt-3.5">
        <button onClick={goBack} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm active:scale-95" aria-label={t('pw.back')}>
          <ChevronRight className="h-5 w-5 rotate-180" />
        </button>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#858B87]" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('portal.search.placeholder')}
            className="h-11 w-full rounded-xl border border-[#DCDDD9] bg-white pl-9 pr-9 text-[14px] outline-none focus:border-[#06452F]"
          />
          {q && (
            <button onClick={() => setQ('')} className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[#858B87]" aria-label="Clear">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {q.trim().length < 2 && <p className="px-1 py-8 text-center text-[13px] text-[#7A817C]">{t('portal.search.hint')}</p>}
      {loading && <p className="px-1 text-center text-[13px] text-[#7A817C]">{t('portal.search.searching')}</p>}
      {error && <p className="rounded-xl bg-[#FBEAE8] px-3 py-2 text-[13px] text-[#B94B45]">{error}</p>}
      {none && !loading && <p className="px-1 py-8 text-center text-[13px] text-[#7A817C]">{t('portal.search.none')}</p>}

      {result && (
        <>
          <Section title={t('portal.search.customers')} count={result.customers.length}>
            {result.customers.map((c) => (
              <div key={c.id} className={`${CARD} p-4`}>
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E7F2EC]"><User className="h-5 w-5 text-[#06452F]" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-[#111817]">{c.name}</p>
                    <p className="truncate text-[12px] text-[#7A817C]">{[c.code, c.company].filter(Boolean).join(' · ')}</p>
                    {c.phone && (
                      <a href={`tel:${c.phone}`} className="mt-1 flex items-center gap-1 text-[12px] font-medium text-[#06452F]"><Phone className="h-3 w-3" />{c.phone}</a>
                    )}
                    {c.address && <p className="mt-0.5 flex items-start gap-1 text-[11px] text-[#7A817C]"><MapPin className="mt-0.5 h-3 w-3 shrink-0" /><span className="line-clamp-2">{c.address}</span></p>}
                  </div>
                </div>
                <div className="mt-3"><Pending amount={c.pendingAmount} /></div>
                {c.invoices.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {c.invoices.map((i) => (
                      <div key={i.id} className="flex items-center justify-between text-[12px] text-[#4B524E]">
                        <span>{i.number}{i.dueDate ? ` · ${dueText(i.dueDate)}` : ''}</span>
                        <span className="font-semibold tabular-nums">{inr(i.balance)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {c.projects.length > 0 && (
                  <p className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                    {c.projects.map((p) => <span key={p.id} className="rounded-full bg-[#EEF0EE] px-2 py-0.5 font-medium text-[#4B524E]">{p.code ? `${p.code} · ` : ''}{p.name}</span>)}
                  </p>
                )}
                <Tasks tasks={c.tasks} />
              </div>
            ))}
          </Section>

          <Section title={t('portal.search.leads')} count={result.leads.length}>
            {result.leads.map((l) => (
              <div key={l.id} className={`${CARD} p-4`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-[#111817]">{l.name}</p>
                    <p className="truncate text-[12px] text-[#7A817C]">{[l.code, l.stage || l.status].filter(Boolean).join(' · ')}</p>
                  </div>
                  {l.rating ? <span className="flex items-center gap-px text-[#C48A16]">{Array.from({ length: l.rating }).map((_, i) => <Star key={i} className="h-3 w-3 fill-current" />)}</span> : null}
                </div>
                {l.phone && <a href={`tel:${l.phone}`} className="mt-1 flex items-center gap-1 text-[12px] font-medium text-[#06452F]"><Phone className="h-3 w-3" />{l.phone}</a>}
                {l.address && <p className="mt-0.5 line-clamp-2 text-[11px] text-[#7A817C]">{l.address}</p>}
                <Tasks tasks={l.tasks} />
              </div>
            ))}
          </Section>

          <Section title={t('portal.search.projects')} count={result.projects.length}>
            {result.projects.map((p) => (
              <div key={p.id} className={`${CARD} p-4`}>
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FBF1DA]"><FolderKanban className="h-5 w-5 text-[#9D6B10]" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-[#111817]">{p.name}</p>
                    <p className="truncate text-[12px] text-[#7A817C]">{[p.code, p.status].filter(Boolean).join(' · ')}</p>
                    {p.customerName && <p className="truncate text-[12px] text-[#4B524E]">{p.customerName}{p.customerPhone ? ` · ${p.customerPhone}` : ''}</p>}
                    {p.address && <p className="mt-0.5 line-clamp-2 text-[11px] text-[#7A817C]">{p.address}</p>}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Pending amount={p.pendingAmount} />
                  {p.dueDate && <span className="flex items-center gap-1 text-[11px] text-[#7A817C]"><CalendarClock className="h-3 w-3" />{dueText(p.dueDate)}</span>}
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-[11px] text-[#7A817C]"><span>{t('portal.search.progress')}</span><span>{p.progress}%</span></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[#E4E7E4]"><div className="h-full rounded-full bg-[#2F8F65]" style={{ width: `${Math.min(100, p.progress)}%` }} /></div>
                </div>
                <Tasks tasks={p.tasks} />
              </div>
            ))}
          </Section>

          <Section title={t('portal.search.parcels')} count={result.parcels.length}>
            {result.parcels.map((x) => (
              <div key={`${x.kind}-${x.id}`} className={`${CARD} p-4`}>
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E7F2EC]">
                    {x.kind === 'SHIPMENT' ? <Truck className="h-5 w-5 text-[#06452F]" /> : <Package className="h-5 w-5 text-[#06452F]" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-[#111817]">{x.code}</p>
                    <p className="text-[12px] text-[#7A817C]">
                      {x.kind === 'SHIPMENT' ? t('portal.search.shipment') : t('portal.search.order')} · {String(x.status).replace(/_/g, ' ')}
                    </p>
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
                  {x.kind === 'SHIPMENT' ? (
                    <>
                      {x.poNumber && <div><dt className="text-[11px] text-[#858B87]">PO</dt><dd className="font-medium">{x.poNumber}</dd></div>}
                      {x.transporter && <div><dt className="text-[11px] text-[#858B87]">{t('portal.search.transporter')}</dt><dd className="font-medium">{x.transporter}</dd></div>}
                      {x.place && <div><dt className="text-[11px] text-[#858B87]">{t('portal.search.place')}</dt><dd className="font-medium">{x.place}</dd></div>}
                      {x.dispatchDate && <div><dt className="text-[11px] text-[#858B87]">{t('portal.search.dispatched')}</dt><dd className="font-medium">{dueText(x.dispatchDate)}</dd></div>}
                      {x.receivedAt && <div><dt className="text-[11px] text-[#858B87]">{t('portal.search.received')}</dt><dd className="font-medium">{dueText(x.receivedAt)}</dd></div>}
                    </>
                  ) : (
                    <>
                      {x.customerName && <div><dt className="text-[11px] text-[#858B87]">{t('portal.search.customer')}</dt><dd className="font-medium">{x.customerName}{x.customerPhone ? ` · ${x.customerPhone}` : ''}</dd></div>}
                      {x.workType && <div><dt className="text-[11px] text-[#858B87]">{t('portal.search.work')}</dt><dd className="font-medium">{x.workType}</dd></div>}
                      {x.bundleNo != null && <div><dt className="text-[11px] text-[#858B87]">{t('portal.search.bundle')}</dt><dd className="font-medium">{x.bundleNo}/{x.bundleTotal}</dd></div>}
                      {x.dueDate && <div><dt className="text-[11px] text-[#858B87]">{t('portal.search.due')}</dt><dd className="font-medium">{dueText(x.dueDate)}</dd></div>}
                      {x.deliveredAt && <div><dt className="text-[11px] text-[#858B87]">{t('portal.search.delivered')}</dt><dd className="font-medium">{dueText(x.deliveredAt)}</dd></div>}
                    </>
                  )}
                </dl>
                {x.kind === 'ORDER' && <div className="mt-3"><Pending amount={x.balanceDue} /></div>}
                {x.kind === 'ORDER' && x.taskId && (
                  <TaskLink id={x.taskId} />
                )}
              </div>
            ))}
          </Section>
        </>
      )}
    </div>
  );
}

function TaskLink({ id }: { id: number }) {
  const { t } = useT();
  const navigate = useNavigate();
  return (
    <button onClick={() => navigate(`/employee/tasks/${id}`)} className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl bg-[#06452F] py-2.5 text-[13px] font-semibold text-white active:opacity-90">
      {t('portal.search.openTask')} <ChevronRight className="h-4 w-4" />
    </button>
  );
}

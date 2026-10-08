import { BaseInput } from '@/components/ui/input';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus, X, Phone, MapPin, Star, Search, Sparkles, CheckCircle2, TrendingUp,
  ChevronRight, CalendarClock, Mail, FileText, SlidersHorizontal,
} from 'lucide-react';
import api from '@/lib/api';
import { employeePortalApi } from '@/api/employeePortalApi';
import { LeadSummary, LeadCreateBody } from '@/types/employeePortal';
import { PortalHeader, StatusPill, EmptyState, inr } from './_shared';
import QuickLeadSheet from '@/components/leads/QuickLeadSheet';
import { ENQUIRY_TYPES, formatTime } from '@/pages/leads/constants';
import { CATEGORY_GROUPS, EnquiryTag, categoryGroupOf, enquiryDetails, enquiryLabel, enquiryTypeOf, splitList } from '@/pages/leads/enquiry';

type CatalogCategory = { id: number; name: string; slug: string };
type CatalogProduct = { id: number; name: string; slug: string; categorySlug?: string };
type CatalogService = { id: number; title: string; slug: string };

// Enquiry filters for the lead list — same four as the admin Leads page, applied client-side.
type EnquiryFilters = { enquiryType: string; category: string; product: string; service: string };
const NO_ENQUIRY_FILTERS: EnquiryFilters = { enquiryType: '', category: '', product: '', service: '' };
const filterSelect = 'h-9 w-full min-w-0 rounded-lg border bg-background px-2 text-xs';
const listHas = (v: string | null | undefined, name: string) =>
  splitList(v).some((x) => x.toLowerCase() === name.toLowerCase());

const joinParts = (...parts: (string | number | false | undefined | null)[]) => parts.filter(Boolean).join(' · ');

// ---- time-frame partitions for the entry / conversion stats ----
type PeriodKey = 'TODAY' | 'WEEK' | 'MONTH' | 'ALL';
const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'TODAY', label: 'Today' }, { key: 'WEEK', label: 'Week' },
  { key: 'MONTH', label: 'Month' }, { key: 'ALL', label: 'All' },
];
function periodStart(key: PeriodKey): number {
  const now = new Date();
  if (key === 'ALL') return 0;
  if (key === 'TODAY') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (key === 'MONTH') return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const day = now.getDay(); const monday = new Date(now); monday.setDate(now.getDate() - ((day + 6) % 7));
  return new Date(monday.getFullYear(), monday.getMonth(), monday.getDate()).getTime();
}

// ---- status filter chips ----
type StatusKey = 'ALL' | 'New' | 'Contacted' | 'Interested' | 'Converted' | 'Lost';
const STATUS_CHIPS: StatusKey[] = ['ALL', 'New', 'Contacted', 'Interested', 'Converted', 'Lost'];
const isConverted = (l: LeadSummary) => l.isConverted === true;
const isLost = (l: LeadSummary) => (l.status || '').toLowerCase().includes('lost');
function matchesStatus(l: LeadSummary, s: StatusKey) {
  if (s === 'ALL') return true;
  if (s === 'Converted') return isConverted(l);
  if (s === 'Lost') return isLost(l);
  return (l.status || '').toLowerCase() === s.toLowerCase();
}

const AVATAR_COLORS = ['bg-emerald-100 text-emerald-700', 'bg-violet-100 text-violet-700', 'bg-amber-100 text-amber-700', 'bg-sky-100 text-sky-700', 'bg-rose-100 text-rose-700', 'bg-teal-100 text-teal-700'];
const avatarColor = (s: string) => AVATAR_COLORS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
const initials = (s: string) => s.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';
const tempDot: Record<string, string> = { hot: 'bg-rose-500', warm: 'bg-amber-500', cold: 'bg-sky-500' };
const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : null);

export default function Leads() {
  const [list, setList] = useState<LeadSummary[]>([]);
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [services, setServices] = useState<CatalogService[]>([]);
  // redesign state
  const [period, setPeriod] = useState<PeriodKey>('MONTH');
  const [statusFilter, setStatusFilter] = useState<StatusKey>('ALL');
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [detail, setDetail] = useState<LeadSummary | null>(null);
  const [enq, setEnq] = useState<EnquiryFilters>(NO_ENQUIRY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [catGroup, setCatGroup] = useState('');

  const load = useCallback(() => {
    employeePortalApi.leads().then(setList).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  // Requirement category + product come from the website catalog (same list the public site shows).
  // Loaded up front because the list filters use it too.
  useEffect(() => {
    if (categories.length) return;
    api.get('/public/categories').then((res) => setCategories(res.data || [])).catch(() => {});
    api.get('/public/products').then((res) => setProducts(res.data || [])).catch(() => {});
    api.get('/public/services').then((res) => setServices(res.data || [])).catch(() => {});
  }, [categories.length]);

  // Leads within the selected time frame drive both the stats and the list below.
  const periodLeads = useMemo(() => {
    const start = periodStart(period);
    return list.filter((l) => (l.createdAt ? new Date(l.createdAt).getTime() >= start : period === 'ALL'));
  }, [list, period]);

  const stats = useMemo(() => {
    const entered = periodLeads.length;
    const converted = periodLeads.filter(isConverted).length;
    const lost = periodLeads.filter(isLost).length;
    const rate = entered ? Math.round((converted / entered) * 1000) / 10 : 0;
    return { entered, converted, lost, rate };
  }, [periodLeads]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return periodLeads
      .filter((l) => matchesStatus(l, statusFilter))
      .filter((l) => !catGroup || categoryGroupOf(l.requirementCategory) === catGroup)
      .filter((l) => !enq.enquiryType || enquiryTypeOf(l as any) === enq.enquiryType)
      .filter((l) => !enq.category || listHas(l.requirementCategory, enq.category))
      .filter((l) => !enq.product || listHas(l.requirementProduct, enq.product))
      .filter((l) => !enq.service || listHas(l.requirementService, enq.service))
      .filter((l) => !q || [l.name, l.leadNumber, l.mobileNumber, l.city].some((v) => (v || '').toLowerCase().includes(q)));
  }, [periodLeads, statusFilter, search, enq, catGroup]);

  const groupCounts = useMemo(() => {
    const out: Record<string, number> = {};
    periodLeads.forEach((l) => { const g = categoryGroupOf(l.requirementCategory); out[g] = (out[g] || 0) + 1; });
    return out;
  }, [periodLeads]);

  const enqCount = Object.values(enq).filter(Boolean).length;
  const enqCategory = categories.find((c) => c.name === enq.category);
  const enqProducts = products.filter((p) => !enqCategory || p.categorySlug === enqCategory.slug);
  // Switching category drops a product that isn't in it, so the filters never contradict.
  const setEnqCategory = (value: string) => setEnq((f) => {
    const cat = categories.find((c) => c.name === value);
    const keep = !cat || products.some((p) => p.name === f.product && p.categorySlug === cat.slug);
    return { ...f, category: value, product: keep ? f.product : '' };
  });

  const createLead = async (body: LeadCreateBody) => {
    await employeePortalApi.createLead(body);
    setOpen(false);
    load();
  };

  // Tiles double as quick filters: Entered → all, Converted / Rate → converted only.
  const STAT_TILES: { icon: typeof Sparkles; label: string; value: React.ReactNode; tone: string; filter: StatusKey; ring: string }[] = [
    { icon: Sparkles, label: 'Entered', value: stats.entered, tone: 'text-sky-600 bg-sky-100', filter: 'ALL', ring: 'ring-sky-500' },
    { icon: CheckCircle2, label: 'Converted', value: stats.converted, tone: 'text-emerald-600 bg-emerald-100', filter: 'Converted', ring: 'ring-emerald-500' },
    { icon: TrendingUp, label: 'Rate', value: `${stats.rate}%`, tone: 'text-primary bg-primary/10', filter: 'Converted', ring: 'ring-primary' },
  ];

  return (
    <div className="flex flex-col">
      <PortalHeader
        title="My Leads"
        action={
          <button onClick={() => setOpen(true)} className="flex h-9 items-center gap-1 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground active:scale-95">
            <Plus className="h-4 w-4" /> Add
          </button>
        }
      />

      <div className="mx-3 my-3 flex flex-col gap-3">
        {/* Time-frame partition + entry / conversion stats */}
        <div className="rounded-2xl border bg-card p-3 shadow-sm">
          <div className="mb-2.5 flex gap-1.5">
            {PERIODS.map((p) => (
              <button key={p.key} type="button" onClick={() => setPeriod(p.key)}
                className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${period === p.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {STAT_TILES.map((s) => {
              const active = s.label === 'Entered' ? statusFilter === 'ALL' : s.label === 'Converted' && statusFilter === 'Converted';
              return (
                <button key={s.label} type="button" onClick={() => setStatusFilter(s.filter)}
                  className={`flex flex-col items-center gap-1 rounded-xl bg-muted/30 py-2.5 transition active:scale-95 ${active ? `ring-2 ${s.ring}` : ''}`}>
                  <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${s.tone}`}><s.icon size={14} /></span>
                  <span className="text-lg font-bold leading-none">{s.value}</span>
                  <span className="text-[10.5px] font-medium text-muted-foreground">{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main product category cards — tap to filter, tap again to clear */}
        <div className="grid grid-cols-3 gap-2">
          {CATEGORY_GROUPS.map((g) => {
            const active = catGroup === g.key;
            return (
              <button key={g.key} type="button" onClick={() => setCatGroup(active ? '' : g.key)} aria-pressed={active}
                className={`flex items-center gap-2 rounded-xl border bg-card p-2 text-left shadow-sm ${active ? 'ring-2 ring-primary' : ''}`}>
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${g.tone}`}><g.icon className="h-3.5 w-3.5" /></span>
                <span className="min-w-0">
                  <span className="block text-base font-bold leading-none">{groupCounts[g.key] ?? 0}</span>
                  <span className="block truncate text-[10px] font-medium text-muted-foreground">{g.label}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Search + status filter chips */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-xl border bg-card px-3 py-2 shadow-sm">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <BaseInput value={search} onFocus={() => setShowSearch(true)} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, number, city…" className="w-full bg-transparent text-sm outline-none" />
              {(search || showSearch) && (
                <button onClick={() => { setSearch(''); setShowSearch(false); }} aria-label="Clear"><X className="h-4 w-4 text-muted-foreground" /></button>
              )}
            </div>
            <button type="button" onClick={() => setShowFilters((v) => !v)} aria-label="Filters"
              className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-sm ${showFilters || enqCount ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground'}`}>
              <SlidersHorizontal className="h-4 w-4" />
              {enqCount > 0 && (
                <span className="absolute -right-1 -top-1 rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">{enqCount}</span>
              )}
            </button>
          </div>
          {showFilters && (
            <div className="flex flex-col gap-2 rounded-xl border bg-card p-3 shadow-sm">
              <div className="flex flex-wrap gap-1.5">
                {[{ value: '', label: 'All' }, ...ENQUIRY_TYPES].map((t) => (
                  <button key={t.value} type="button" onClick={() => setEnq((f) => ({ ...f, enquiryType: t.value }))}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${enq.enquiryType === t.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select className={filterSelect} value={enq.category} onChange={(e) => setEnqCategory(e.target.value)}>
                  <option value="">All categories</option>
                  {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
                <select className={filterSelect} value={enq.product} onChange={(e) => setEnq((f) => ({ ...f, product: e.target.value }))}>
                  <option value="">All products</option>
                  {enqProducts.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
                <select className={`${filterSelect} col-span-2`} value={enq.service} onChange={(e) => setEnq((f) => ({ ...f, service: e.target.value }))}>
                  <option value="">All services</option>
                  {services.map((sv) => <option key={sv.id} value={sv.title}>{sv.title}</option>)}
                </select>
              </div>
              {enqCount > 0 && (
                <button type="button" onClick={() => setEnq(NO_ENQUIRY_FILTERS)} className="self-end text-xs font-semibold text-primary">
                  Clear filters
                </button>
              )}
            </div>
          )}
          <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5">
            {STATUS_CHIPS.map((s) => {
              const count = s === 'ALL' ? periodLeads.length : periodLeads.filter((l) => matchesStatus(l, s)).length;
              return (
                <button key={s} type="button" onClick={() => setStatusFilter(s)}
                  className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground shadow-sm'}`}>
                  {s === 'ALL' ? 'All' : s}
                  {count > 0 && <span className={`rounded-full px-1.5 text-[10px] ${statusFilter === s ? 'bg-white/25' : 'bg-muted text-muted-foreground'}`}>{count}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Lead cards */}
        {filtered.length === 0 ? (
          <div className="rounded-xl border bg-card shadow-sm"><EmptyState message={list.length === 0 ? 'No leads yet. Add your first one.' : 'No leads match this filter.'} /></div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((l) => {
              const temp = (l.leadTemperature || '').toLowerCase();
              const products = (l.requirementProduct || '').split(',').map((s) => s.trim()).filter(Boolean);
              return (
                <button key={l.id} onClick={() => setDetail(l)}
                  className="w-full rounded-2xl border bg-card p-3 text-left shadow-sm transition active:scale-[0.99]">
                  <div className="flex items-start gap-3">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${avatarColor(l.name)}`}>
                      {initials(l.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{l.name}</p>
                        <StatusPill status={isConverted(l) ? 'CONVERTED' : (l.status || 'NEW').toUpperCase()} />
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{l.leadNumber}</span>
                        {temp && tempDot[temp] && (
                          <span className="flex items-center gap-1"><span className={`h-1.5 w-1.5 rounded-full ${tempDot[temp]}`} />{l.leadTemperature}</span>
                        )}
                        {l.rating ? (
                          <span className="flex items-center gap-0.5 text-amber-500">{Array.from({ length: l.rating }).map((_, i) => <Star key={i} className="h-3 w-3 fill-current" />)}</span>
                        ) : null}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {l.mobileNumber && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{l.mobileNumber}</span>}
                        {l.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{l.city}</span>}
                        <EnquiryTag type={enquiryTypeOf(l as any)} className="text-[10px]" />
                        {enquiryDetails(l as any).map((d) => <span key={d} className="rounded-full bg-violet-100 px-2 py-0.5 text-[10.5px] font-medium text-violet-700">{d}</span>)}
                        {l.requirementCategory && <span className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-medium text-foreground/70">{l.requirementCategory}</span>}
                        {l.estimatedBudget != null && <span className="font-semibold text-foreground">{inr(l.estimatedBudget)}</span>}
                      </div>
                      {products.length > 0 && <p className="mt-1 truncate text-[11.5px] text-muted-foreground">{products.join(' · ')}</p>}
                      {fmtDate(l.nextFollowUpDate) && (
                        <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-amber-600"><CalendarClock className="h-3 w-3" /> Follow-up {fmtDate(l.nextFollowUpDate)}{formatTime(l.nextFollowUpTime) && `, ${formatTime(l.nextFollowUpTime)}`}</p>
                      )}
                    </div>
                    <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground/50" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Lead detail sheet — read-only view of everything captured. */}
      {detail && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/40" onClick={() => setDetail(null)}>
          <div className="max-h-[90vh] w-full max-w-md mx-auto overflow-y-auto rounded-t-2xl bg-card p-4 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className={`flex h-11 w-11 items-center justify-center rounded-full text-base font-bold ${avatarColor(detail.name)}`}>{initials(detail.name)}</span>
                <div>
                  <h2 className="text-base font-semibold leading-tight">{detail.name}</h2>
                  <p className="text-[11px] text-muted-foreground">{detail.leadNumber}</p>
                </div>
              </div>
              <button onClick={() => setDetail(null)} className="flex h-8 w-8 items-center justify-center rounded-full active:bg-accent"><X className="h-5 w-5" /></button>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-2">
              <StatusPill status={isConverted(detail) ? 'CONVERTED' : (detail.status || 'NEW').toUpperCase()} />
              {detail.leadTemperature && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">{detail.leadTemperature}</span>}
              {detail.rating ? <span className="flex items-center gap-0.5 text-amber-500">{Array.from({ length: detail.rating }).map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-current" />)}</span> : null}
            </div>

            <div className="flex flex-col gap-1">
              {detail.mobileNumber && <DetailRow icon={Phone} label="Mobile" value={<a href={`tel:${detail.mobileNumber}`} className="text-primary">{detail.mobileNumber}</a>} />}
              {detail.email && <DetailRow icon={Mail} label="Email" value={detail.email} />}
              {(detail.address || detail.city) && <DetailRow icon={MapPin} label="Location" value={[detail.address, detail.city].filter(Boolean).join(', ')} />}
              {enquiryTypeOf(detail as any) && (
                <DetailRow icon={FileText} label="Looking for" value={joinParts(enquiryLabel(enquiryTypeOf(detail as any)), ...enquiryDetails(detail as any))} />
              )}
              {detail.requirementCategory && <DetailRow icon={FileText} label="Category" value={detail.requirementCategory} />}
              {detail.requirementProduct && <DetailRow icon={FileText} label="Products" value={detail.requirementProduct} />}
              {detail.requirement && <DetailRow icon={FileText} label="Requirement" value={detail.requirement} />}
              {detail.estimatedBudget != null && <DetailRow icon={TrendingUp} label="Budget" value={inr(detail.estimatedBudget)} />}
              {fmtDate(detail.siteVisitDate) && <DetailRow icon={CalendarClock} label="Site visit" value={fmtDate(detail.siteVisitDate)!} />}
              {fmtDate(detail.nextFollowUpDate) && <DetailRow icon={CalendarClock} label="Next follow-up" value={[fmtDate(detail.nextFollowUpDate), formatTime(detail.nextFollowUpTime)].filter(Boolean).join(', ')} />}
              {detail.notes && <DetailRow icon={FileText} label="Notes" value={detail.notes} />}
              {fmtDate(detail.createdAt) && <DetailRow icon={CalendarClock} label="Added" value={new Date(detail.createdAt!).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} />}
            </div>
          </div>
        </div>
      )}

      <QuickLeadSheet open={open} onClose={() => setOpen(false)} onSubmit={createLead} />
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 border-b py-2 last:border-0">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="whitespace-pre-wrap break-words text-sm">{value}</p>
      </div>
    </div>
  );
}

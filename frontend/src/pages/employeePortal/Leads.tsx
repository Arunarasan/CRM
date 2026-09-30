import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus, X, Phone, MapPin, Star, Search, Sparkles, CheckCircle2, TrendingUp,
  ChevronRight, CalendarClock, Mail, FileText,
} from 'lucide-react';
import api from '@/lib/api';
import { employeePortalApi } from '@/api/employeePortalApi';
import { LeadSummary, LeadCreateBody } from '@/types/employeePortal';
import { PortalHeader, StatusPill, EmptyState, inr } from './_shared';
import MultiImageCaptureField, { type CapturedImage } from '@/components/MultiImageCaptureField';
import AudioCaptureField, { type CapturedAudio } from '@/components/AudioCaptureField';

const EMPTY: LeadCreateBody = {
  name: '', mobileNumber: '', email: '', address: '', city: '',
  requirementCategory: '', requirementProduct: '', requirement: '', estimatedBudget: '', preferredVisitDate: '', notes: '',
};

// Fallback categories if the website catalog can't be reached (keeps the form usable offline).
const FALLBACK_CATEGORIES = ['Full Home', 'Kitchen', 'Wardrobe', 'False Ceiling', 'Painting', 'Flooring', 'Other'];

type CatalogCategory = { id: number; name: string; slug: string };
type CatalogProduct = { id: number; name: string; slug: string; categorySlug?: string };

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<LeadCreateBody>(EMPTY);
  const [images, setImages] = useState<CapturedImage[]>([]);
  const [audioClips, setAudioClips] = useState<CapturedAudio[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  // redesign state
  const [period, setPeriod] = useState<PeriodKey>('MONTH');
  const [statusFilter, setStatusFilter] = useState<StatusKey>('ALL');
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [detail, setDetail] = useState<LeadSummary | null>(null);

  const load = useCallback(() => {
    employeePortalApi.leads().then(setList).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  // Requirement category + product come from the website catalog (same list the public site shows).
  useEffect(() => {
    if (!open || categories.length) return;
    api.get('/public/categories').then((res) => setCategories(res.data || [])).catch(() => {});
    api.get('/public/products').then((res) => setProducts(res.data || [])).catch(() => {});
  }, [open, categories.length]);

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
      .filter((l) => !q || [l.name, l.leadNumber, l.mobileNumber, l.city].some((v) => (v || '').toLowerCase().includes(q)));
  }, [periodLeads, statusFilter, search]);

  const set = <K extends keyof LeadCreateBody>(k: K, v: LeadCreateBody[K]) => setForm((f) => ({ ...f, [k]: v }));

  const categoryNames = categories.length ? categories.map((c) => c.name) : FALLBACK_CATEGORIES;
  const selectedCategory = categories.find((c) => c.name === form.requirementCategory);
  const productOptions = products
    .filter((p) => !selectedCategory || p.categorySlug === selectedCategory.slug)
    .map((p) => p.name);

  // Several products per lead, stored comma-separated in requirementProduct.
  const selectedProducts = (form.requirementProduct || '').split(',').map((s) => s.trim()).filter(Boolean);
  const applyProducts = (names: string[]) => set('requirementProduct', names.join(', '));
  const addProduct = (name: string) => { if (name && !selectedProducts.includes(name)) applyProducts([...selectedProducts, name]); };
  const removeProduct = (name: string) => applyProducts(selectedProducts.filter((p) => p !== name));

  const submit = async () => {
    setError('');
    if (!form.name?.trim()) { setError('Customer name is required.'); return; }
    setSaving(true);
    try {
      const body = Object.fromEntries(
        Object.entries(form).filter(([, v]) => v !== '' && v != null),
      ) as unknown as LeadCreateBody;
      const documents = [
        ...images.map((img) => ({ fileName: img.fileName, fileUrl: img.url, documentType: 'Image', category: 'Site Photos' })),
        ...audioClips.map((clip) => ({ fileName: clip.fileName, fileUrl: clip.url, documentType: 'Audio', category: 'Voice Notes' })),
      ];
      if (documents.length) body.documents = documents;
      await employeePortalApi.createLead(body);
      setOpen(false);
      setForm(EMPTY);
      setImages([]);
      setAudioClips([]);
      load();
    } catch (e: any) {
      setError(e?.message || 'Could not submit the lead.');
    } finally {
      setSaving(false);
    }
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
          <button onClick={() => { setForm(EMPTY); setImages([]); setAudioClips([]); setError(''); setOpen(true); }} className="flex h-9 items-center gap-1 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground active:scale-95">
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

        {/* Search + status filter chips */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-xl border bg-card px-3 py-2 shadow-sm">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input value={search} onFocus={() => setShowSearch(true)} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, number, city…" className="w-full bg-transparent text-sm outline-none" />
              {(search || showSearch) && (
                <button onClick={() => { setSearch(''); setShowSearch(false); }} aria-label="Clear"><X className="h-4 w-4 text-muted-foreground" /></button>
              )}
            </div>
          </div>
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
                        {l.requirementCategory && <span className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-medium text-foreground/70">{l.requirementCategory}</span>}
                        {l.estimatedBudget != null && <span className="font-semibold text-foreground">{inr(l.estimatedBudget)}</span>}
                      </div>
                      {products.length > 0 && <p className="mt-1 truncate text-[11.5px] text-muted-foreground">{products.join(' · ')}</p>}
                      {fmtDate(l.nextFollowUpDate) && (
                        <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-amber-600"><CalendarClock className="h-3 w-3" /> Follow-up {fmtDate(l.nextFollowUpDate)}</p>
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
              {detail.requirementCategory && <DetailRow icon={FileText} label="Category" value={detail.requirementCategory} />}
              {detail.requirementProduct && <DetailRow icon={FileText} label="Products" value={detail.requirementProduct} />}
              {detail.requirement && <DetailRow icon={FileText} label="Requirement" value={detail.requirement} />}
              {detail.estimatedBudget != null && <DetailRow icon={TrendingUp} label="Budget" value={inr(detail.estimatedBudget)} />}
              {fmtDate(detail.siteVisitDate) && <DetailRow icon={CalendarClock} label="Site visit" value={fmtDate(detail.siteVisitDate)!} />}
              {fmtDate(detail.nextFollowUpDate) && <DetailRow icon={CalendarClock} label="Next follow-up" value={fmtDate(detail.nextFollowUpDate)!} />}
              {detail.notes && <DetailRow icon={FileText} label="Notes" value={detail.notes} />}
              {fmtDate(detail.createdAt) && <DetailRow icon={CalendarClock} label="Added" value={new Date(detail.createdAt!).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} />}
            </div>
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/40" onClick={() => setOpen(false)}>
          <div className="max-h-[92vh] w-full max-w-md mx-auto overflow-y-auto rounded-t-2xl bg-card p-4 pb-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Add Lead</h2>
              <button onClick={() => setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full active:bg-accent"><X className="h-5 w-5" /></button>
            </div>
            {error && <p className="mb-2 rounded-md bg-destructive/15 p-2 text-xs text-destructive">{error}</p>}

            <div className="flex flex-col gap-3">
              <Field label="Customer name *">
                <input value={form.name} onChange={(e) => set('name', e.target.value)} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" placeholder="Full name" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Mobile">
                  <input value={form.mobileNumber} onChange={(e) => set('mobileNumber', e.target.value)} inputMode="tel" className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" placeholder="10-digit" />
                </Field>
                <Field label="City">
                  <input value={form.city} onChange={(e) => set('city', e.target.value)} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
                </Field>
              </div>
              <Field label="Email">
                <input value={form.email} onChange={(e) => set('email', e.target.value)} inputMode="email" className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
              </Field>
              <Field label="Address / Location">
                <textarea value={form.address} onChange={(e) => set('address', e.target.value)} rows={2} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
              </Field>
              <Field label="Requirement category">
                <div className="mt-1 flex flex-wrap gap-2">
                  {categoryNames.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => set('requirementCategory', c)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium ${form.requirementCategory === c ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'}`}
                    >{c}</button>
                  ))}
                </div>
              </Field>
              {productOptions.length > 0 && (
                <Field label="Products">
                  <select
                    value=""
                    onChange={(e) => addProduct(e.target.value)}
                    className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Add a product…</option>
                    {productOptions.filter((p) => !selectedProducts.includes(p)).map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  {selectedProducts.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {selectedProducts.map((p) => (
                        <span key={p} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                          {p}
                          <button type="button" onClick={() => removeProduct(p)} aria-label={`Remove ${p}`}><X className="h-3 w-3" /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </Field>
              )}
              <Field label="Rating">
                <div className="mt-1 flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => set('rating', star === form.rating ? undefined : star)}
                      aria-label={`${star} star${star === 1 ? '' : 's'}`}
                      className="p-0.5 text-muted-foreground/40 active:scale-90"
                    >
                      <Star className={`h-6 w-6 ${star <= (form.rating || 0) ? 'fill-amber-400 text-amber-400' : ''}`} />
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Requirement details">
                <textarea value={form.requirement} onChange={(e) => set('requirement', e.target.value)} rows={2} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" placeholder="What does the customer want?" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Estimated budget">
                  <input value={form.estimatedBudget as string} onChange={(e) => set('estimatedBudget', e.target.value)} inputMode="numeric" className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" placeholder="₹" />
                </Field>
                <Field label="Preferred visit">
                  <input type="date" value={form.preferredVisitDate} onChange={(e) => set('preferredVisitDate', e.target.value)} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
                </Field>
              </div>
              <Field label="Notes">
                <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
              </Field>

              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="mb-2 text-xs font-semibold text-muted-foreground">Photos &amp; voice notes</p>
                <div className="flex flex-col gap-4">
                  <MultiImageCaptureField label="Add site / reference photos" module="LEAD" value={images} onChange={setImages} />
                  <AudioCaptureField label="Record or upload a voice note" module="LEAD" value={audioClips} onChange={setAudioClips} />
                </div>
              </div>

              <button onClick={submit} disabled={saving} className="mt-1 w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground active:scale-[0.99] disabled:opacity-60">
                {saving ? 'Submitting…' : 'Submit Lead'}
              </button>
              <p className="text-center text-[11px] text-muted-foreground">Your manager will review and assign this lead.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
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

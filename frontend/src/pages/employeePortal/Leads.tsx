import { useCallback, useEffect, useState } from 'react';
import { Plus, X, Phone, MapPin, Star } from 'lucide-react';
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
      // strip empty strings so the backend sees nulls, not blanks
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

      <div className="mx-3 my-3 flex flex-col gap-2">
        {list.length === 0 ? (
          <div className="rounded-xl border bg-card shadow-sm"><EmptyState message="No leads yet. Add your first one." /></div>
        ) : (
          list.map((l) => (
            <div key={l.id} className="rounded-xl border bg-card p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{l.name}</p>
                  <p className="text-[11px] text-muted-foreground">{l.leadNumber}</p>
                </div>
                <StatusPill status={(l.status || 'NEW').toUpperCase()} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {l.mobileNumber && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{l.mobileNumber}</span>}
                {l.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{l.city}</span>}
                {l.requirementCategory && <span>{l.requirementCategory}</span>}
                {l.requirementProduct && <span>{l.requirementProduct}</span>}
                {l.estimatedBudget != null && <span className="font-medium text-foreground">{inr(l.estimatedBudget)}</span>}
              </div>
            </div>
          ))
        )}
      </div>

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

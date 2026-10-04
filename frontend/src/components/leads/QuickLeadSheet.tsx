import { Input } from '@/components/ui/input';
import { useEffect, useState } from 'react';
import { X, Star, Check } from 'lucide-react';
import api from '@/lib/api';
import { LeadCreateBody } from '@/types/employeePortal';
import MultiImageCaptureField, { type CapturedImage } from '@/components/MultiImageCaptureField';
import AudioCaptureField, { type CapturedAudio } from '@/components/AudioCaptureField';
import { ENQUIRY_TYPES } from '@/pages/leads/constants';
import { enquiryLabel, splitList } from '@/pages/leads/enquiry';
import { Chip, F, Step, areaCls, inDays, stepControls } from '@/pages/leads/formSteps';

export const EMPTY_LEAD: LeadCreateBody = {
  name: '', mobileNumber: '', email: '', address: '', city: '',
  requirementCategory: '', requirementProduct: '', requirement: '', estimatedBudget: '', preferredVisitDate: '', notes: '',
};

// Fallback categories if the website catalog can't be reached (keeps the form usable offline).
const FALLBACK_CATEGORIES = ['Full Home', 'Kitchen', 'Wardrobe', 'False Ceiling', 'Painting', 'Flooring', 'Other'];

type CatalogCategory = { id: number; name: string; slug: string };
type CatalogProduct = { id: number; name: string; slug: string; categorySlug?: string };
type CatalogService = { id: number; title: string; slug: string };

// The sheet is a stack of numbered open/close steps (same design as the admin dialog).
type StepKey = 'customer' | 'enquiry' | 'visit' | 'notes' | 'media';
const STEP_ORDER: StepKey[] = ['customer', 'enquiry', 'visit', 'notes', 'media'];
const VISIT_CHIPS = [{ label: 'Today', days: 0 }, { label: 'Tomorrow', days: 1 }, { label: 'In 3 days', days: 3 }, { label: 'Next week', days: 7 }];
const selectCls = 'w-full h-9 rounded-md border border-input bg-card px-2.5 text-sm';
const joinParts = (...parts: (string | number | false | undefined | null)[]) => parts.filter(Boolean).join(' · ');

/**
 * The mobile "Add Lead" bottom sheet — customer, what they're looking for, visit & budget, notes,
 * photos & voice notes. Shared by the Employee Portal "My Leads" page and the call-recording task
 * (where it opens pre-filled with the caller's number and the recording already attached). It only
 * builds the request body; the caller decides where it is sent.
 */
export default function QuickLeadSheet({
  open, onClose, onSubmit, initial, initialAudio, title = 'Add Lead',
  subtitle = 'Only the name is required — open a step to add more.',
  submitLabel = 'Submit Lead', footerNote = 'Your manager will review and assign this lead.',
}: {
  open: boolean;
  onClose: () => void;
  /** Receives the cleaned body (with photos / voice notes as `documents`). Throw to show an error. */
  onSubmit: (body: LeadCreateBody) => Promise<void>;
  initial?: Partial<LeadCreateBody>;
  initialAudio?: CapturedAudio[];
  title?: string;
  subtitle?: string;
  submitLabel?: string;
  footerNote?: string;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<LeadCreateBody>(EMPTY_LEAD);
  const [images, setImages] = useState<CapturedImage[]>([]);
  const [audioClips, setAudioClips] = useState<CapturedAudio[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [services, setServices] = useState<CatalogService[]>([]);
  const [openSteps, setOpenSteps] = useState<Set<StepKey>>(new Set(['customer', 'enquiry']));
  const [customDate, setCustomDate] = useState(false);

  // Fresh form every time the sheet opens, seeded with whatever the caller already knows.
  useEffect(() => {
    if (!open) return;
    setForm({ ...EMPTY_LEAD, ...(initial || {}) });
    setImages([]);
    setAudioClips(initialAudio || []);
    setError('');
    setCustomDate(false);
    setOpenSteps(new Set(['customer', 'enquiry']));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Requirement category + product + services come from the website catalog.
  useEffect(() => {
    if (!open || categories.length) return;
    api.get('/public/categories').then((res) => setCategories(res.data || [])).catch(() => {});
    api.get('/public/products').then((res) => setProducts(res.data || [])).catch(() => {});
    api.get('/public/services').then((res) => setServices(res.data || [])).catch(() => {});
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

  // Services: several per lead, stored comma-separated in requirementService.
  const selectedServices = splitList(form.requirementService);
  const toggleService = (name: string) => set('requirementService', (selectedServices.includes(name)
    ? selectedServices.filter((x) => x !== name) : [...selectedServices, name]).join(', '));

  const stepProps = stepControls(STEP_ORDER, openSteps, setOpenSteps);
  const visitIsChip = VISIT_CHIPS.some((c) => form.preferredVisitDate === inDays(c.days));
  const showDatePicker = customDate || (!!form.preferredVisitDate && !visitIsChip);
  const enquirySummary = !form.enquiryType ? '' : form.enquiryType === 'SERVICE'
    ? joinParts(enquiryLabel(form.enquiryType), selectedServices.join(', '), selectedProducts.length > 0 && `for ${selectedProducts.join(', ')}`)
    : form.enquiryType === 'OTHER'
      ? joinParts(enquiryLabel(form.enquiryType), form.requirementOther)
      : joinParts(enquiryLabel(form.enquiryType), form.requirementCategory, selectedProducts.join(', '));
  const visitSummary = joinParts(
    form.preferredVisitDate && `Visit ${new Date(form.preferredVisitDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`,
    form.estimatedBudget && `₹${Number(form.estimatedBudget).toLocaleString('en-IN')}`,
    form.rating && `${form.rating}★`);
  const mediaSummary = joinParts(images.length > 0 && `${images.length} photo${images.length > 1 ? 's' : ''}`,
    audioClips.length > 0 && `${audioClips.length} voice note${audioClips.length > 1 ? 's' : ''}`);

  const submit = async () => {
    setError('');
    if (!form.name?.trim()) {
      setOpenSteps((st) => new Set(st).add('customer'));
      setError('Customer name is required.');
      return;
    }
    setSaving(true);
    try {
      const body = Object.fromEntries(
        Object.entries(form).filter(([, v]) => v !== '' && v != null),
      ) as unknown as LeadCreateBody;
      // Keep only the detail that belongs to the chosen enquiry type.
      if (body.enquiryType === 'PRODUCT') { delete body.requirementService; delete body.requirementOther; }
      // A service is for a product, so the category + products stay alongside the services.
      if (body.enquiryType === 'SERVICE') { delete body.requirementOther; }
      if (body.enquiryType === 'OTHER') { delete body.requirementCategory; delete body.requirementProduct; delete body.requirementService; }
      const documents = [
        ...images.map((img) => ({ fileName: img.fileName, fileUrl: img.url, documentType: 'Image', category: 'Site Photos' })),
        ...audioClips.map((clip) => ({ fileName: clip.fileName, fileUrl: clip.url, documentType: 'Audio', category: 'Voice Notes' })),
      ];
      if (documents.length) body.documents = documents;
      await onSubmit(body);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Could not submit the lead.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-md mx-auto flex-col rounded-t-2xl bg-card sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            <p className="text-[11px] text-muted-foreground">{subtitle}</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full active:bg-accent"><X className="h-5 w-5" /></button>
        </div>

          <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
            {/* 1 — Customer */}
            <Step {...stepProps('customer', joinParts(form.name, form.mobileNumber, form.city))} title="Customer" hint="Name, mobile, city and address">
              <F label="Customer name" required>
                <Input autoFocus value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Full name" />
              </F>
              <div className="grid grid-cols-2 gap-3">
                <F label="Mobile">
                  <Input value={form.mobileNumber} onChange={(e) => set('mobileNumber', e.target.value)} type="tel" inputMode="tel" placeholder="10-digit" />
                </F>
                <F label="City"><Input value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="City / town" /></F>
              </div>
              <F label="Address / location">
                <textarea value={form.address} onChange={(e) => set('address', e.target.value)} rows={2} className={areaCls} placeholder="Door no, street, area" />
              </F>
              <F label="Email">
                <Input value={form.email} onChange={(e) => set('email', e.target.value)} inputMode="email" placeholder="Optional" />
              </F>
            </Step>

            {/* 2 — Looking for: Product / Service / Others */}
            <Step {...stepProps('enquiry', enquirySummary)} title="Looking for" hint="Product, service or something else">
              <div className="flex flex-wrap gap-1.5">
                {ENQUIRY_TYPES.map((t) => (
                  <Chip key={t.value} active={form.enquiryType === t.value}
                    onClick={() => set('enquiryType', form.enquiryType === t.value ? undefined : t.value)}>
                    {t.label}
                  </Chip>
                ))}
              </div>

              {form.enquiryType === 'SERVICE' && (
                <div className="rounded-md bg-muted/30 p-3">
                  <F label="Which service? (pick one or more)">
                    {services.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {services.map((s) => (
                          <Chip key={s.id} active={selectedServices.includes(s.title)} onClick={() => toggleService(s.title)}>
                            {selectedServices.includes(s.title) && <Check className="mr-1 inline h-3 w-3" />}
                            {s.title}
                          </Chip>
                        ))}
                      </div>
                    ) : (
                      <Input value={form.requirementService || ''} onChange={(e) => set('requirementService', e.target.value)}
                        placeholder="e.g. Curtain installation, Repair" />
                    )}
                  </F>
                </div>
              )}

              {(form.enquiryType === 'PRODUCT' || form.enquiryType === 'SERVICE') && (
                <div className="space-y-3 rounded-md bg-muted/30 p-3">
                  <F label="Category">
                    <div className="flex flex-wrap gap-1.5">
                      {categoryNames.map((c) => (
                        <Chip key={c} active={form.requirementCategory === c}
                          onClick={() => set('requirementCategory', form.requirementCategory === c ? '' : c)}>
                          {c}
                        </Chip>
                      ))}
                    </div>
                  </F>
                  {productOptions.length > 0 && (
                    <F label="Products">
                      <select value="" onChange={(e) => addProduct(e.target.value)} className={selectCls}>
                        <option value="">Add a product…</option>
                        {productOptions.filter((p) => !selectedProducts.includes(p)).map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                      {selectedProducts.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {selectedProducts.map((p) => (
                            <span key={p} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                              {p}
                              <button type="button" onClick={() => removeProduct(p)} aria-label={`Remove ${p}`}><X className="h-3 w-3" /></button>
                            </span>
                          ))}
                        </div>
                      )}
                    </F>
                  )}
                </div>
              )}

              {form.enquiryType === 'OTHER' && (
                <div className="rounded-md bg-muted/30 p-3">
                  <F label="What are they looking for?">
                    <textarea className={areaCls} rows={2} value={form.requirementOther || ''}
                      onChange={(e) => set('requirementOther', e.target.value)} placeholder="Describe the enquiry" />
                  </F>
                </div>
              )}
              <F label="Requirement">
                <textarea value={form.requirement} onChange={(e) => set('requirement', e.target.value)} rows={2} className={areaCls}
                  placeholder="What does the customer want? Size, colour, rooms, timing…" />
              </F>
            </Step>

            {/* 3 — Visit, budget & rating */}
            <Step {...stepProps('visit', visitSummary)} title="Visit & budget" hint="Preferred visit date, budget, rating">
              <F label="Preferred site visit">
                <div className="flex flex-wrap items-center gap-1.5">
                  {VISIT_CHIPS.map((c) => {
                    const v = inDays(c.days);
                    return (
                      <Chip key={c.label} active={!customDate && form.preferredVisitDate === v}
                        onClick={() => { setCustomDate(false); set('preferredVisitDate', form.preferredVisitDate === v ? '' : v); }}>
                        {c.label}
                      </Chip>
                    );
                  })}
                  <Chip active={showDatePicker} onClick={() => setCustomDate(true)}>Pick date</Chip>
                </div>
                {showDatePicker && (
                  <Input type="date" className="mt-2" value={form.preferredVisitDate} onChange={(e) => set('preferredVisitDate', e.target.value)} />
                )}
              </F>
              <div className="grid grid-cols-2 gap-3">
                <F label="Estimated budget">
                  <Input value={form.estimatedBudget as string} onChange={(e) => set('estimatedBudget', e.target.value)} inputMode="numeric" placeholder="₹" />
                </F>
                <F label="Rating">
                  <div className="flex h-9 items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => set('rating', star === form.rating ? undefined : star)}
                        aria-label={`${star} star${star === 1 ? '' : 's'}`}
                        className="p-0.5 text-muted-foreground/40 active:scale-90"
                      >
                        <Star className={`h-5 w-5 ${star <= (form.rating || 0) ? 'fill-amber-400 text-amber-400' : ''}`} />
                      </button>
                    ))}
                  </div>
                </F>
              </div>
            </Step>

            {/* 4 — Notes */}
            <Step {...stepProps('notes', joinParts(form.notes))} title="Notes" hint="Optional — anything else to remember">
              <F label="Notes">
                <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} className={areaCls} />
              </F>
            </Step>

            {/* 5 — Photos & voice notes */}
            <Step {...stepProps('media', mediaSummary)} title="Photos & voice notes" hint="Optional — site photos, recorded requirement">
              <MultiImageCaptureField label="Add site / reference photos" module="LEAD" value={images} onChange={setImages} />
              <AudioCaptureField label="Record or upload a voice note" module="LEAD" value={audioClips} onChange={setAudioClips} />
            </Step>
          </div>

        {/* Sticky footer — submit is always reachable. */}
        <div className="border-t px-4 pb-5 pt-3">
          {error && <p className="mb-2 rounded-md bg-destructive/15 p-2 text-xs text-destructive">{error}</p>}
          <button onClick={submit} disabled={saving} className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground active:scale-[0.99] disabled:opacity-60">
            {saving ? 'Submitting…' : submitLabel}
          </button>
          {footerNote && <p className="mt-1.5 text-center text-[11px] text-muted-foreground">{footerNote}</p>}
        </div>
      </div>
    </div>
  );
}

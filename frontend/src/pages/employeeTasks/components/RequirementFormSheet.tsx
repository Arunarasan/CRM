import { BaseInput } from '@/components/ui/input';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, ChevronDown, User, Phone, MapPin, Home, ListChecks, FileText, Camera, Check, Wallet, CalendarClock, Mic, Crosshair, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { employeeTaskApi } from '@/api/employeeTaskApi';
import { resolveFileUrl } from '@/lib/uploadFile';
import { LeadFormMedia } from '@/types/employeeTask';
import TaskCallRecordings from './TaskCallRecordings';
import PhotoPickButtons from './PhotoPickButtons';
import { getBestPosition, locationErrorMessage, reverseGeocode } from '@/lib/geo';
import { useT, useTr } from '@/i18n';

/**
 * The redesigned "Collect Requirement" form for the TT_COLLECT_REQUIREMENT task. Captures the WHOLE
 * lead picture the office needs — the same groups as the desktop lead's Sales Journey — but on one
 * portal page as collapsible open/close sections. Existing lead values are pre-filled so the field
 * employee confirms/edits rather than retyping. On submit every field is written onto the lead
 * (once the task is approved). "Save changes" writes the edits onto the lead right away WITHOUT
 * completing the task. Photos taken here go straight onto the lead (except a call's new lead, where
 * they ride along with the submission that creates it).
 */

const CONSTRUCTION_STAGES = ['New Construction', 'Ready to Move', 'Under Renovation', 'Old / Resale', 'Bare Shell'];
// Fallback only — the picker reads the live catalogue categories (same list as the lead form).
const CATEGORIES = ['Full Interior', 'Modular Kitchen', 'Wardrobe', 'False Ceiling', 'Painting', 'Flooring', 'Renovation', 'Commercial', 'Other'];
const PAYMENT_PREFS = ['Full Advance', 'Milestone Based', 'On Completion', 'EMI / Finance'];
const LEAD_TYPES = ['Individual', 'Business', 'Builder', 'Architect', 'Dealer', 'Other'];
const LEAD_SOURCES = ['Walk-in', 'Phone Call', 'WhatsApp', 'Website', 'Facebook', 'Instagram', 'Google', 'Referral', 'Existing Customer', 'Exhibition', 'Email', 'Other'];
const RATINGS = ['1', '2', '3', '4', '5'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const TEMPERATURES = ['Hot', 'Warm', 'Cold'];

const SCOPE: { key: string }[] = [
  { key: 'reqKitchen' }, { key: 'reqWardrobe' }, { key: 'reqTvUnit' }, { key: 'reqFalseCeiling' }, { key: 'reqPainting' },
  { key: 'reqFlooring' }, { key: 'reqElectrical' }, { key: 'reqPlumbing' }, { key: 'reqWoodFinish' },
];

// Which lead fields each section owns (used for prefill + the "filled" indicator).
const SECTION_FIELDS: Record<string, string[]> = {
  summary: ['name', 'companyName', 'contactPerson', 'gstNumber', 'leadType', 'leadSource', 'rating', 'priority', 'leadTemperature'],
  contact: ['mobileNumber', 'alternateMobile', 'whatsappNumber', 'email'],
  address: ['address', 'city', 'district', 'state', 'pincode', 'landmark', 'googleMapLocation'],
  property: ['propertyType', 'propertyName', 'currentConstructionStage', 'floorCount', 'areaSqft', 'expectedWorkArea', 'siteAddress'],
  requirement: ['requirementCategory', 'requirementProduct', 'projectDescription', 'customerRequirements', 'roomsRequired', 'specialRequests',
    'preferredDesignStyle', 'preferredMaterial', 'preferredColorTheme', 'remarks'],
  budget: ['estimatedBudget', 'minimumBudget', 'maximumBudget', 'expectedProjectValue', 'paymentPreference',
    'expectedStartDate', 'expectedEndDate', 'preferredCompletionDate', 'estimatedDuration'],
  nextstep: ['siteVisitDate', 'followUpDate', 'followUpTime', 'followUpNotes'],
};

type Values = Record<string, string>;

export default function RequirementFormSheet({ taskId, leadId, open, onOpenChange, onSaved, onDetailsSaved, initial, fromCall, focus, detailsOnly }: {
  taskId: number; leadId?: number | null; open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => void;
  /** "Save changes" finished — lead updated, task still open. */
  onDetailsSaved?: () => void;
  /** Starting values when there's no lead yet (a call task: the caller's number, name, the office note). */
  initial?: Record<string, string | null | undefined>;
  /** A call task with no lead yet — submitting creates the lead (and attaches the call's recording). */
  fromCall?: boolean;
  /** Open with only this section expanded and scrolled into view (the task page's "Edit" buttons). */
  focus?: string | null;
  /** Lead workspace: edit the lead's details only — no next-step scheduling, no completing, saved by lead id. */
  detailsOnly?: boolean;
}) {
  const { t } = useT();
  const tr = useTr();
  const [v, setV] = useState<Values>({});
  const [scope, setScope] = useState<Record<string, boolean>>({});
  const [media, setMedia] = useState<LeadFormMedia[]>([]);
  const [openSecs, setOpenSecs] = useState<Set<string>>(new Set(['requirement', 'scope', 'nextstep']));
  const [nextStep, setNextStep] = useState<'VISIT' | 'FOLLOWUP'>('VISIT');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);
  // Photos saved straight onto the lead from this form (shown as a strip; the task page lists them all).
  const [savedPhotos, setSavedPhotos] = useState<string[]>([]);
  const photosToLead = !fromCall && !!leadId;

  // Prefill from the lead AND the latest draft (so a re-collected follow-up shows what was already entered).
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      leadId ? api.get(`/leads/${leadId}`).then((r) => r.data).catch(() => ({})) : Promise.resolve({}),
      detailsOnly ? Promise.resolve({}) : employeeTaskApi.leadFormDraft(taskId).catch(() => ({})),
    ]).then(([l, draft]: [any, any]) => {
      const next: Values = {};
      const put = (k: string, val: any) => { if (val != null && val !== '') next[k] = String(val); };
      Object.entries(initial || {}).forEach(([k, val]) => put(k, val));
      Object.values(SECTION_FIELDS).flat().forEach((k) => put(k, l[k]));
      if (!next.projectDescription) put('projectDescription', l.customerRequirements);
      // Draft (accumulated capture) overrides the lead.
      Object.entries(draft || {}).forEach(([k, val]) => { if (val != null && val !== '') next[k] = String(val); });
      setV(next);
      const sc: Record<string, boolean> = {};
      SCOPE.forEach((s) => { sc[s.key] = (draft && s.key in draft) ? !!draft[s.key] : !!l[s.key]; });
      setScope(sc);
      if (next.siteVisitDate) setNextStep('VISIT');
      else if (next.followUpDate) setNextStep('FOLLOWUP');
    }).catch(() => {}).finally(() => setLoading(false));
  }, [open, leadId, taskId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    setOpenSecs(new Set(focus ? [focus] : detailsOnly ? ['requirement', 'scope'] : ['requirement', 'scope', 'nextstep']));
    if (!focus) return;
    const t = setTimeout(() => document.getElementById(`req-sec-${focus}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350);
    return () => clearTimeout(t);
  }, [open, focus]);

  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }));

  // Categories: several can be picked, stored comma-separated on the lead (like products).
  const [catalogCategories, setCatalogCategories] = useState<string[]>([]);
  useEffect(() => {
    if (!open || catalogCategories.length) return;
    api.get('/public/categories')
      .then((res) => setCatalogCategories((res.data || []).map((c: { name: string }) => c.name).filter(Boolean)))
      .catch(() => {});
  }, [open, catalogCategories.length]);
  const pickedCategories = (v.requirementCategory || '').split(',').map((x) => x.trim()).filter(Boolean);
  // Keep saved values visible even if the catalogue renamed/removed them.
  const categoryChoices = [
    ...pickedCategories.filter((c) => !(catalogCategories.length ? catalogCategories : CATEGORIES).includes(c)),
    ...(catalogCategories.length ? catalogCategories : CATEGORIES),
  ];
  const toggleCategory = (name: string) => set('requirementCategory',
    (pickedCategories.includes(name) ? pickedCategories.filter((c) => c !== name) : [...pickedCategories, name]).join(', '));
  const toggleScope = (k: string) => setScope((p) => ({ ...p, [k]: !p[k] }));
  const toggleSec = (id: string) => setOpenSecs((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const filledCount = (id: string) => id === 'scope'
    ? Object.values(scope).filter(Boolean).length
    : (SECTION_FIELDS[id] || []).filter((k) => v[k]?.trim()).length;

  const onFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) {
        const res = await employeeTaskApi.uploadFile(file, photosToLead ? 'LEAD' : 'lead-task');
        if (photosToLead) {
          await employeeTaskApi.addLeadPhoto(taskId, { fileUrl: res.fileUrl, fileName: res.fileName || file.name });
          setSavedPhotos((prev) => [...prev, res.fileUrl]);
        } else {
          setMedia((prev) => [...prev, { url: res.fileUrl, type: 'PHOTO', caption: res.fileName }]);
        }
      }
    } catch (e: any) { setError(e?.response?.data?.message || t('pw.rf.errUpload')); } finally { setUploading(false); }
  };

  // GPS -> map link + the street address for that spot (only blank address fields are filled).
  const useGps = async () => {
    setError('');
    setLocating(true);
    try {
      const fix = await getBestPosition({ targetAccuracyM: 25, maxWaitMs: 15000 });
      if (!fix) { setError(await locationErrorMessage()); return; }
      const addr = await reverseGeocode(fix.lat, fix.lng);
      setV((p) => {
        const n: Values = { ...p, googleMapLocation: `https://www.google.com/maps?q=${fix.lat.toFixed(6)},${fix.lng.toFixed(6)}` };
        (Object.entries(addr) as [string, string | undefined][]).forEach(([k, val]) => { if (val && !p[k]?.trim()) n[k] = val; });
        return n;
      });
    } finally { setLocating(false); }
  };

  const SCHED_KEYS = ['siteVisitDate', 'followUpDate', 'followUpTime', 'followUpNotes'];
  // The lead fields as the backend expects them (scheduling keys left out).
  const leadData = () => {
    const data: Record<string, string | boolean> = {};
    for (const [k, val] of Object.entries(v)) if (val != null && val !== '' && !SCHED_KEYS.includes(k)) data[k] = val;
    for (const s of SCOPE) data[s.key] = !!scope[s.key];
    return data;
  };

  const saveChanges = async () => {
    setError('');
    setSaving(true);
    try {
      if (detailsOnly && leadId) await employeeTaskApi.saveLeadDetails(leadId, leadData());
      else await employeeTaskApi.saveLeadForm(taskId, leadData());
      onOpenChange(false);
      onDetailsSaved?.();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || t('pw.rf.errSave'));
    } finally { setSaving(false); }
  };

  const submit = async () => {
    setError('');
    if (fromCall && !v.name?.trim()) { setError(t('pw.rf.errName')); return; }
    // Next-step validation drives whether the workflow advances to the site visit or holds for follow-up.
    if (nextStep === 'VISIT') {
      if (!v.siteVisitDate) { setError(t('pw.rf.errVisit')); return; }
      const described = v.projectDescription?.trim() || v.roomsRequired?.trim();
      if (!described && !Object.values(scope).some(Boolean)) { setError(t('pw.rf.errDescribe')); return; }
    } else {
      if (!v.followUpDate) { setError(t('pw.rf.errFollow')); return; }
    }
    setSaving(true);
    try {
      const data = leadData();
      if (nextStep === 'VISIT') {
        data.siteVisitDate = v.siteVisitDate;
      } else {
        data.followUpDate = v.followUpDate;
        if (v.followUpTime) data.followUpTime = v.followUpTime;
        if (v.followUpNotes?.trim()) data.followUpNotes = v.followUpNotes.trim();
      }
      await employeeTaskApi.submitLeadForm(taskId, { notes: v.notes || undefined, media: media.length ? media : undefined, data });
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || t('pw.rf.errSubmit'));
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>{fromCall ? t('pw.rf.collect_requirement_new_lead') : t('pw.rf.collect_requirement')}</DialogTitle></DialogHeader>
        {fromCall && (
          <p className="rounded-lg bg-[#EFF5F0] p-2.5 text-xs text-[#2C5C45]">
            {t('pw.rf.fromCallNote')}
          </p>
        )}
        {loading && <p className="text-xs text-muted-foreground">{t('pw.rf.loading_current_details')}</p>}
        {error && <p className="rounded-md bg-destructive/15 p-2 text-xs text-destructive">{error}</p>}

        <div className="flex flex-col gap-2">
          {!detailsOnly && (<Section id="nextstep" icon={<CalendarClock className="h-4 w-4" />} title={t('pw.rf.next_step')} count={nextStep === 'VISIT' ? (v.siteVisitDate ? 1 : 0) : (v.followUpDate ? 1 : 0)} openSecs={openSecs} toggle={toggleSec}>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setNextStep('VISIT')}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold ${nextStep === 'VISIT' ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'}`}>
                {t('pw.rf.schedule_site_visit')}
              </button>
              <button type="button" onClick={() => setNextStep('FOLLOWUP')}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold ${nextStep === 'FOLLOWUP' ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'}`}>
                {t('pw.rf.follow_up_later')}
              </button>
            </div>
            {nextStep === 'VISIT' ? (
              <>
                <Text label={t('pw.rf.site_visit_date')} type="date" value={v.siteVisitDate} onChange={(x) => set('siteVisitDate', x)} />
                <p className="text-[11px] text-muted-foreground">{t('pw.rf.visitDueNote')}</p>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Text label={t('pw.rf.follow_up_date')} type="date" value={v.followUpDate} onChange={(x) => set('followUpDate', x)} />
                  <Text label={t('pw.rf.time')} type="time" value={v.followUpTime} onChange={(x) => set('followUpTime', x)} />
                </div>
                <Area label={t('pw.rf.pendingNotes')} value={v.followUpNotes} onChange={(x) => set('followUpNotes', x)} rows={2} placeholder={t('pw.rf.pendingPh')} />
                <p className="text-[11px] text-muted-foreground">{t('pw.rf.freshTaskNote')}</p>
              </>
            )}
          </Section>)}

          <Section id="summary" icon={<User className="h-4 w-4" />} title={t('pw.rf.lead_summary')} count={filledCount('summary')} openSecs={openSecs} toggle={toggleSec}>
            <Text label={t('pw.rf.customer_lead_name')} value={v.name} onChange={(x) => set('name', x)} />
            <div className="grid grid-cols-2 gap-3">
              <Text label={t('pw.rf.company_if_any')} value={v.companyName} onChange={(x) => set('companyName', x)} />
              <Text label={t('pw.rf.contact_person')} value={v.contactPerson} onChange={(x) => set('contactPerson', x)} />
              <Text label={t('pw.rf.gst_number')} value={v.gstNumber} onChange={(x) => set('gstNumber', x)} />
              <Select label={t('pw.rf.lead_type')} value={v.leadType} onChange={(x) => set('leadType', x)} options={LEAD_TYPES} />
              <Select label={t('pw.rf.lead_source')} value={v.leadSource} onChange={(x) => set('leadSource', x)} options={LEAD_SOURCES} />
              <Select label={t('pw.rf.quality_rating')} value={v.rating} onChange={(x) => set('rating', x)} options={RATINGS} />
              <Select label={t('pw.rf.priority')} value={v.priority} onChange={(x) => set('priority', x)} options={PRIORITIES} />
              <Select label={t('pw.rf.interest_level')} value={v.leadTemperature} onChange={(x) => set('leadTemperature', x)} options={TEMPERATURES} />
            </div>
          </Section>

          <Section id="contact" icon={<Phone className="h-4 w-4" />} title={t('pw.rf.contact_details')} count={filledCount('contact')} openSecs={openSecs} toggle={toggleSec}>
            <div className="grid grid-cols-2 gap-3">
              <Text label={t('pw.rf.mobile')} type="tel" value={v.mobileNumber} onChange={(x) => set('mobileNumber', x)} />
              <Text label={t('pw.rf.alternate_mobile')} type="tel" value={v.alternateMobile} onChange={(x) => set('alternateMobile', x)} />
              <Text label={t('pw.rf.whatsapp')} type="tel" value={v.whatsappNumber} onChange={(x) => set('whatsappNumber', x)} />
              <Text label={t('pw.rf.email')} type="email" value={v.email} onChange={(x) => set('email', x)} />
            </div>
          </Section>

          <Section id="address" icon={<MapPin className="h-4 w-4" />} title={t('pw.rf.address')} count={filledCount('address')} openSecs={openSecs} toggle={toggleSec}>
            <Area label={t('pw.rf.address')} value={v.address} onChange={(x) => set('address', x)} rows={2} />
            <div className="grid grid-cols-2 gap-3">
              <Text label={t('pw.rf.city')} value={v.city} onChange={(x) => set('city', x)} />
              <Text label={t('pw.rf.district')} value={v.district} onChange={(x) => set('district', x)} />
              <Text label={t('pw.rf.state')} value={v.state} onChange={(x) => set('state', x)} />
              <Text label={t('pw.rf.pincode')} type="tel" value={v.pincode} onChange={(x) => set('pincode', x)} />
            </div>
            <Text label={t('pw.rf.landmark')} value={v.landmark} onChange={(x) => set('landmark', x)} />
            <Text label={t('pw.rf.google_maps_link')} value={v.googleMapLocation} onChange={(x) => set('googleMapLocation', x)} />
            <button type="button" onClick={useGps} disabled={locating}
              className="flex items-center justify-center gap-2 rounded-xl border border-[#0A573B]/30 bg-[#F3F8F5] px-3 py-2.5 text-[13px] font-semibold text-[#0A573B] active:scale-[0.98] disabled:opacity-60">
              {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
              {locating ? t('pw.rf.getting_gps_location') : t('pw.rf.set_location_by_gps')}
            </button>
            <p className="-mt-1 text-[11px] text-muted-foreground">{t('pw.rf.gpsNote')}</p>
          </Section>

          <Section id="property" icon={<Home className="h-4 w-4" />} title={t('pw.rf.property_details')} count={filledCount('property')} openSecs={openSecs} toggle={toggleSec}>
            <div className="grid grid-cols-2 gap-3">
              <Text label={t('pw.rf.property_type')} value={v.propertyType} onChange={(x) => set('propertyType', x)} placeholder={t('pw.rf.flat_villa')} />
              <Text label={t('pw.rf.property_project_name')} value={v.propertyName} onChange={(x) => set('propertyName', x)} />
              <Select label={t('pw.rf.construction_stage')} value={v.currentConstructionStage} onChange={(x) => set('currentConstructionStage', x)} options={CONSTRUCTION_STAGES} />
              <Text label={t('pw.rf.no_of_floors')} type="number" value={v.floorCount} onChange={(x) => set('floorCount', x)} />
              <Text label={t('pw.rf.total_area_sq_ft')} type="number" value={v.areaSqft} onChange={(x) => set('areaSqft', x)} />
              <Text label={t('pw.rf.work_area_sq_ft')} type="number" value={v.expectedWorkArea} onChange={(x) => set('expectedWorkArea', x)} />
            </div>
            <Area label={t('pw.rf.site_address_if_different')} value={v.siteAddress} onChange={(x) => set('siteAddress', x)} rows={2} />
          </Section>

          <Section id="scope" icon={<ListChecks className="h-4 w-4" />} title={t('pw.rf.scope_of_work')} count={filledCount('scope')} openSecs={openSecs} toggle={toggleSec}>
            <div className="flex flex-wrap gap-2">
              {SCOPE.map((s) => (
                <button key={s.key} type="button" onClick={() => toggleScope(s.key)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${scope[s.key] ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'}`}>
                  {scope[s.key] ? '✓ ' : ''}{t(`pw.rs.scope.${s.key}`)}
                </button>
              ))}
            </div>
          </Section>

          <Section id="requirement" icon={<FileText className="h-4 w-4" />} title={t('pw.rf.requirement')} count={filledCount('requirement')} openSecs={openSecs} toggle={toggleSec}>
            <div>
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Categories (pick one or more)</span>
              <div className="flex flex-wrap gap-2">
                {categoryChoices.map((c) => {
                  const on = pickedCategories.includes(c);
                  return (
                    <button key={c} type="button" aria-pressed={on} onClick={() => toggleCategory(c)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${on ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'}`}>
                      {on ? '✓ ' : ''}{tr(`pw.rf.o.${c}`, c)}
                    </button>
                  );
                })}
              </div>
            </div>
            <Text label={t('pw.rf.products_asked')} value={v.requirementProduct} onChange={(x) => set('requirementProduct', x)} placeholder={t('pw.rf.e_g_sofa_wardrobe_tv_unit_comma_separated')} />
            <Area label={t('pw.rf.requirement_description')} value={v.projectDescription} onChange={(x) => set('projectDescription', x)} placeholder={t('pw.rf.describe_the_full_scope_the_customer_wants')} />
            <Area label={t('pw.rf.detailed_requirements_customer_notes')} value={v.customerRequirements} onChange={(x) => set('customerRequirements', x)} rows={2} />
            <Area label={t('pw.rf.rooms_required')} value={v.roomsRequired} onChange={(x) => set('roomsRequired', x)} placeholder={t('pw.rf.e_g_3_bedrooms_living_kitchen')} rows={2} />
            <Area label={t('pw.rf.special_requests')} value={v.specialRequests} onChange={(x) => set('specialRequests', x)} rows={2} />
            <div className="grid grid-cols-2 gap-3">
              <Text label={t('pw.rf.design_style')} value={v.preferredDesignStyle} onChange={(x) => set('preferredDesignStyle', x)} placeholder={t('pw.rf.modern')} />
              <Text label={t('pw.rf.material')} value={v.preferredMaterial} onChange={(x) => set('preferredMaterial', x)} />
              <Text label={t('pw.rf.colour_theme')} value={v.preferredColorTheme} onChange={(x) => set('preferredColorTheme', x)} />
            </div>
          </Section>

          <Section id="budget" icon={<Wallet className="h-4 w-4" />} title={t('pw.rf.budget_timeline')} count={filledCount('budget')} openSecs={openSecs} toggle={toggleSec}>
            <div className="grid grid-cols-3 gap-3">
              <Text label={t('pw.rf.estimated')} type="number" value={v.estimatedBudget} onChange={(x) => set('estimatedBudget', x)} />
              <Text label={t('pw.rf.min')} type="number" value={v.minimumBudget} onChange={(x) => set('minimumBudget', x)} />
              <Text label={t('pw.rf.max')} type="number" value={v.maximumBudget} onChange={(x) => set('maximumBudget', x)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Text label={t('pw.rf.expected_project_value')} type="number" value={v.expectedProjectValue} onChange={(x) => set('expectedProjectValue', x)} />
              <Select label={t('pw.rf.payment_preference')} value={v.paymentPreference} onChange={(x) => set('paymentPreference', x)} options={PAYMENT_PREFS} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Text label={t('pw.rf.expected_start')} type="date" value={v.expectedStartDate} onChange={(x) => set('expectedStartDate', x)} />
              <Text label={t('pw.rf.expected_end')} type="date" value={v.expectedEndDate} onChange={(x) => set('expectedEndDate', x)} />
              <Text label={t('pw.rf.target_completion')} type="date" value={v.preferredCompletionDate} onChange={(x) => set('preferredCompletionDate', x)} />
              <Text label={t('pw.rf.estimated_duration')} value={v.estimatedDuration} onChange={(x) => set('estimatedDuration', x)} placeholder={t('pw.rf.e_g_2_months')} />
            </div>
          </Section>

          {!fromCall && !detailsOnly && (
            <Section id="calls" icon={<Mic className="h-4 w-4" />} title={t('pw.rf.call_recordings')} count={0} openSecs={openSecs} toggle={toggleSec}>
              <TaskCallRecordings taskId={taskId} />
            </Section>
          )}

          {!detailsOnly && (<Section id="media" icon={<Camera className="h-4 w-4" />} title={t('pw.rf.photos_notes')} count={media.length + savedPhotos.length + (v.notes?.trim() ? 1 : 0)} openSecs={openSecs} toggle={toggleSec}>
            <PhotoPickButtons onPicked={onFiles} busy={uploading} />
            {uploading && <p className="mt-1 text-xs text-muted-foreground">{t('pw.rf.uploading')}</p>}
            {savedPhotos.length > 0 && (
              <div className="flex gap-2 overflow-x-auto">
                {savedPhotos.map((u) => <img key={u} src={resolveFileUrl(u)} alt="" className="h-16 w-16 shrink-0 rounded-md object-cover" />)}
              </div>
            )}
            {photosToLead && <p className="text-[11px] text-muted-foreground">{t('pw.rf.photos_are_saved_on_the_lead_straight_away')}</p>}
            {media.length > 0 && (
              <div className="mt-2 flex gap-2 overflow-x-auto">
                {media.map((m, i) => (
                  <div key={i} className="relative shrink-0">
                    <img src={m.url} alt="" className="h-16 w-16 rounded-md object-cover" />
                    <button type="button" onClick={() => setMedia((prev) => prev.filter((_, x) => x !== i))}
                      className="absolute -right-1 -top-1 rounded-full bg-black/70 p-0.5 text-white"><X className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            )}
            <Area label={t('pw.rf.remarks_saved_on_the_lead')} value={v.remarks} onChange={(x) => set('remarks', x)} rows={2} placeholder={t('pw.rf.any_general_remark_about_this_lead')} />
            <Area label={t('pw.rf.notes')} value={v.notes} onChange={(x) => set('notes', x)} rows={2} />
          </Section>)}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          {!fromCall && (
            <Button variant="outline" onClick={saveChanges} disabled={saving || uploading || loading} className="w-full">
              {saving ? t('pw.rf.saving') : t('pw.rf.save_changes')}
            </Button>
          )}
          {!detailsOnly && <Button onClick={submit} disabled={saving || uploading} className="w-full">
            {saving ? t('pw.rf.saving') : nextStep === 'FOLLOWUP' ? t('pw.rf.save_schedule_follow_up') : t('pw.rf.save_schedule_site_visit')}
          </Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ id, icon, title, count, openSecs, toggle, children }: {
  id: string; icon: React.ReactNode; title: string; count: number;
  openSecs: Set<string>; toggle: (id: string) => void; children: React.ReactNode;
}) {
  const isOpen = openSecs.has(id);
  return (
    <div id={`req-sec-${id}`} className="overflow-hidden rounded-2xl border border-[#EDE6D8] bg-white shadow-[0_1px_6px_rgba(80,55,20,0.04)]">
      <button type="button" onClick={() => toggle(id)} className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left">
        <span className="text-[#9B6B32]">{icon}</span>
        <span className="text-[14px] font-semibold text-[#22271F]">{title}</span>
        {count > 0 && (
          <span className="flex items-center gap-0.5 rounded-full bg-[#E7F2EC] px-1.5 py-0.5 text-[10px] font-semibold text-[#2C7050]">
            <Check className="h-2.5 w-2.5" /> {count}
          </span>
        )}
        <ChevronDown className={`ml-auto h-4 w-4 text-[#B4B0A4] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && <div className="flex flex-col gap-3 border-t border-[#F1ECE2] px-3.5 py-3.5">{children}</div>}
    </div>
  );
}

const inputCls = 'mt-1 w-full rounded-xl border border-[#DDE2DE] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0A573B]';
function Text({ label, value, onChange, type = 'text', placeholder }: { label: string; value?: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <BaseInput type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={inputCls} placeholder={placeholder}
        inputMode={type === 'number' ? 'numeric' : type === 'tel' ? 'tel' : undefined} />
    </div>
  );
}
function Area({ label, value, onChange, placeholder, rows = 3 }: { label: string; value?: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <textarea value={value ?? ''} onChange={(e) => onChange(e.target.value)} rows={rows} className={inputCls} placeholder={placeholder} />
    </div>
  );
}
function Select({ label, value, onChange, options }: { label: string; value?: string; onChange: (v: string) => void; options: string[] }) {
  const { t } = useT();
  const tr = useTr();
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={inputCls}>
        <option value="">{t('pw.rf.select')}</option>
        {options.map((o) => <option key={o} value={o}>{tr(`pw.rf.o.${o}`, o)}</option>)}
      </select>
    </div>
  );
}

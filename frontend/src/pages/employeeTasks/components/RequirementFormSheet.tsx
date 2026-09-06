import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, ChevronDown, User, Phone, MapPin, Home, ListChecks, FileText, Camera, Check, Wallet, CalendarClock } from 'lucide-react';
import api from '@/lib/api';
import { employeeTaskApi } from '@/api/employeeTaskApi';
import { LeadFormMedia } from '@/types/employeeTask';

/**
 * The redesigned "Collect Requirement" form for the TT_COLLECT_REQUIREMENT task. Captures the WHOLE
 * lead picture the office needs — the same groups as the desktop lead's Sales Journey — but on one
 * portal page as collapsible open/close sections. Existing lead values are pre-filled so the field
 * employee confirms/edits rather than retyping. On submit every field is written onto the lead
 * (once the task is approved).
 */

const CONSTRUCTION_STAGES = ['New Construction', 'Ready to Move', 'Under Renovation', 'Old / Resale', 'Bare Shell'];
const CATEGORIES = ['Full Interior', 'Modular Kitchen', 'Wardrobe', 'False Ceiling', 'Painting', 'Flooring', 'Renovation', 'Commercial', 'Other'];
const PAYMENT_PREFS = ['Full Advance', 'Milestone Based', 'On Completion', 'EMI / Finance'];
const LEAD_TYPES = ['Individual', 'Business', 'Builder', 'Architect', 'Dealer', 'Other'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const TEMPERATURES = ['Hot', 'Warm', 'Cold'];

const SCOPE: { key: string; label: string }[] = [
  { key: 'reqKitchen', label: 'Modular Kitchen' }, { key: 'reqWardrobe', label: 'Wardrobe' },
  { key: 'reqTvUnit', label: 'TV Unit' }, { key: 'reqFalseCeiling', label: 'False Ceiling' },
  { key: 'reqPainting', label: 'Painting' }, { key: 'reqFlooring', label: 'Flooring' },
  { key: 'reqElectrical', label: 'Electrical' }, { key: 'reqPlumbing', label: 'Plumbing' },
  { key: 'reqWoodFinish', label: 'Wood Finish' },
];

// Which lead fields each section owns (used for prefill + the "filled" indicator).
const SECTION_FIELDS: Record<string, string[]> = {
  summary: ['name', 'companyName', 'contactPerson', 'gstNumber', 'leadType', 'priority', 'leadTemperature'],
  contact: ['mobileNumber', 'alternateMobile', 'whatsappNumber', 'email'],
  address: ['address', 'city', 'district', 'state', 'pincode', 'landmark', 'googleMapLocation'],
  property: ['propertyType', 'propertyName', 'currentConstructionStage', 'floorCount', 'areaSqft', 'expectedWorkArea', 'siteAddress'],
  requirement: ['requirementCategory', 'projectDescription', 'customerRequirements', 'roomsRequired', 'specialRequests',
    'preferredDesignStyle', 'preferredMaterial', 'preferredColorTheme'],
  budget: ['estimatedBudget', 'minimumBudget', 'maximumBudget', 'expectedProjectValue', 'paymentPreference',
    'expectedStartDate', 'expectedEndDate', 'preferredCompletionDate', 'estimatedDuration'],
  nextstep: ['siteVisitDate', 'followUpDate', 'followUpNotes'],
};

type Values = Record<string, string>;

export default function RequirementFormSheet({ taskId, leadId, open, onOpenChange, onSaved }: {
  taskId: number; leadId?: number | null; open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => void;
}) {
  const [v, setV] = useState<Values>({});
  const [scope, setScope] = useState<Record<string, boolean>>({});
  const [media, setMedia] = useState<LeadFormMedia[]>([]);
  const [openSecs, setOpenSecs] = useState<Set<string>>(new Set(['requirement', 'scope', 'nextstep']));
  const [nextStep, setNextStep] = useState<'VISIT' | 'FOLLOWUP'>('VISIT');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Prefill from the lead AND the latest draft (so a re-collected follow-up shows what was already entered).
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      leadId ? api.get(`/leads/${leadId}`).then((r) => r.data).catch(() => ({})) : Promise.resolve({}),
      employeeTaskApi.leadFormDraft(taskId).catch(() => ({})),
    ]).then(([l, draft]: [any, any]) => {
      const next: Values = {};
      const put = (k: string, val: any) => { if (val != null && val !== '') next[k] = String(val); };
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
  }, [open, leadId, taskId]);

  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }));
  const toggleScope = (k: string) => setScope((p) => ({ ...p, [k]: !p[k] }));
  const toggleSec = (id: string) => setOpenSecs((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const filledCount = (id: string) => id === 'scope'
    ? Object.values(scope).filter(Boolean).length
    : (SECTION_FIELDS[id] || []).filter((k) => v[k]?.trim()).length;

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const res = await employeeTaskApi.uploadFile(file, 'lead-task');
        setMedia((prev) => [...prev, { url: res.fileUrl, type: 'PHOTO', caption: res.fileName }]);
      }
    } catch { setError('Upload failed. Try again.'); } finally { setUploading(false); }
  };

  const SCHED_KEYS = ['siteVisitDate', 'followUpDate', 'followUpNotes'];
  const submit = async () => {
    setError('');
    // Next-step validation drives whether the workflow advances to the site visit or holds for follow-up.
    if (nextStep === 'VISIT') {
      if (!v.siteVisitDate) { setError('Pick the agreed site-visit date.'); return; }
      const described = v.projectDescription?.trim() || v.roomsRequired?.trim();
      if (!described && !Object.values(scope).some(Boolean)) { setError('Capture what the customer wants (description, rooms, or scope).'); return; }
    } else {
      if (!v.followUpDate) { setError('Pick the follow-up date.'); return; }
    }
    setSaving(true);
    try {
      const data: Record<string, string | boolean> = {};
      for (const [k, val] of Object.entries(v)) if (val != null && val !== '' && !SCHED_KEYS.includes(k)) data[k] = val;
      for (const s of SCOPE) data[s.key] = !!scope[s.key];
      if (nextStep === 'VISIT') {
        data.siteVisitDate = v.siteVisitDate;
      } else {
        data.followUpDate = v.followUpDate;
        if (v.followUpNotes?.trim()) data.followUpNotes = v.followUpNotes.trim();
      }
      await employeeTaskApi.submitLeadForm(taskId, { notes: v.notes || undefined, media: media.length ? media : undefined, data });
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Could not submit the requirement.');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Collect Requirement</DialogTitle></DialogHeader>
        {loading && <p className="text-xs text-muted-foreground">Loading current details…</p>}
        {error && <p className="rounded-md bg-destructive/15 p-2 text-xs text-destructive">{error}</p>}

        <div className="flex flex-col gap-2">
          <Section id="nextstep" icon={<CalendarClock className="h-4 w-4" />} title="Next Step" count={nextStep === 'VISIT' ? (v.siteVisitDate ? 1 : 0) : (v.followUpDate ? 1 : 0)} openSecs={openSecs} toggle={toggleSec}>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setNextStep('VISIT')}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold ${nextStep === 'VISIT' ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'}`}>
                Schedule site visit
              </button>
              <button type="button" onClick={() => setNextStep('FOLLOWUP')}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold ${nextStep === 'FOLLOWUP' ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'}`}>
                Follow up later
              </button>
            </div>
            {nextStep === 'VISIT' ? (
              <>
                <Text label="Site visit date" type="date" value={v.siteVisitDate} onChange={(x) => set('siteVisitDate', x)} />
                <p className="text-[11px] text-muted-foreground">The Site Visit &amp; Measurement task will be due on this date.</p>
              </>
            ) : (
              <>
                <Text label="Follow-up date" type="date" value={v.followUpDate} onChange={(x) => set('followUpDate', x)} />
                <Area label="What's pending / follow-up notes" value={v.followUpNotes} onChange={(x) => set('followUpNotes', x)} rows={2} placeholder="Why not ready yet, what to confirm next time…" />
                <p className="text-[11px] text-muted-foreground">A fresh "Collect Requirement" task will be created for that date, with everything you've entered kept.</p>
              </>
            )}
          </Section>

          <Section id="summary" icon={<User className="h-4 w-4" />} title="Lead Summary" count={filledCount('summary')} openSecs={openSecs} toggle={toggleSec}>
            <Text label="Customer / lead name" value={v.name} onChange={(x) => set('name', x)} />
            <div className="grid grid-cols-2 gap-3">
              <Text label="Company (if any)" value={v.companyName} onChange={(x) => set('companyName', x)} />
              <Text label="Contact person" value={v.contactPerson} onChange={(x) => set('contactPerson', x)} />
              <Text label="GST number" value={v.gstNumber} onChange={(x) => set('gstNumber', x)} />
              <Select label="Lead type" value={v.leadType} onChange={(x) => set('leadType', x)} options={LEAD_TYPES} />
              <Select label="Priority" value={v.priority} onChange={(x) => set('priority', x)} options={PRIORITIES} />
              <Select label="Interest level" value={v.leadTemperature} onChange={(x) => set('leadTemperature', x)} options={TEMPERATURES} />
            </div>
          </Section>

          <Section id="contact" icon={<Phone className="h-4 w-4" />} title="Contact Details" count={filledCount('contact')} openSecs={openSecs} toggle={toggleSec}>
            <div className="grid grid-cols-2 gap-3">
              <Text label="Mobile" type="tel" value={v.mobileNumber} onChange={(x) => set('mobileNumber', x)} />
              <Text label="Alternate mobile" type="tel" value={v.alternateMobile} onChange={(x) => set('alternateMobile', x)} />
              <Text label="WhatsApp" type="tel" value={v.whatsappNumber} onChange={(x) => set('whatsappNumber', x)} />
              <Text label="Email" type="email" value={v.email} onChange={(x) => set('email', x)} />
            </div>
          </Section>

          <Section id="address" icon={<MapPin className="h-4 w-4" />} title="Address" count={filledCount('address')} openSecs={openSecs} toggle={toggleSec}>
            <Area label="Address" value={v.address} onChange={(x) => set('address', x)} rows={2} />
            <div className="grid grid-cols-2 gap-3">
              <Text label="City" value={v.city} onChange={(x) => set('city', x)} />
              <Text label="District" value={v.district} onChange={(x) => set('district', x)} />
              <Text label="State" value={v.state} onChange={(x) => set('state', x)} />
              <Text label="Pincode" type="tel" value={v.pincode} onChange={(x) => set('pincode', x)} />
            </div>
            <Text label="Landmark" value={v.landmark} onChange={(x) => set('landmark', x)} />
            <Text label="Google Maps link" value={v.googleMapLocation} onChange={(x) => set('googleMapLocation', x)} />
          </Section>

          <Section id="property" icon={<Home className="h-4 w-4" />} title="Property Details" count={filledCount('property')} openSecs={openSecs} toggle={toggleSec}>
            <div className="grid grid-cols-2 gap-3">
              <Text label="Property type" value={v.propertyType} onChange={(x) => set('propertyType', x)} placeholder="Flat, Villa…" />
              <Text label="Property / project name" value={v.propertyName} onChange={(x) => set('propertyName', x)} />
              <Select label="Construction stage" value={v.currentConstructionStage} onChange={(x) => set('currentConstructionStage', x)} options={CONSTRUCTION_STAGES} />
              <Text label="No. of floors" type="number" value={v.floorCount} onChange={(x) => set('floorCount', x)} />
              <Text label="Total area (sq.ft)" type="number" value={v.areaSqft} onChange={(x) => set('areaSqft', x)} />
              <Text label="Work area (sq.ft)" type="number" value={v.expectedWorkArea} onChange={(x) => set('expectedWorkArea', x)} />
            </div>
            <Area label="Site address (if different)" value={v.siteAddress} onChange={(x) => set('siteAddress', x)} rows={2} />
          </Section>

          <Section id="scope" icon={<ListChecks className="h-4 w-4" />} title="Scope of Work" count={filledCount('scope')} openSecs={openSecs} toggle={toggleSec}>
            <div className="flex flex-wrap gap-2">
              {SCOPE.map((s) => (
                <button key={s.key} type="button" onClick={() => toggleScope(s.key)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${scope[s.key] ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'}`}>
                  {scope[s.key] ? '✓ ' : ''}{s.label}
                </button>
              ))}
            </div>
          </Section>

          <Section id="requirement" icon={<FileText className="h-4 w-4" />} title="Requirement" count={filledCount('requirement')} openSecs={openSecs} toggle={toggleSec}>
            <Select label="Category" value={v.requirementCategory} onChange={(x) => set('requirementCategory', x)} options={CATEGORIES} />
            <Area label="Requirement description" value={v.projectDescription} onChange={(x) => set('projectDescription', x)} placeholder="Describe the full scope the customer wants…" />
            <Area label="Detailed requirements / customer notes" value={v.customerRequirements} onChange={(x) => set('customerRequirements', x)} rows={2} />
            <Area label="Rooms required" value={v.roomsRequired} onChange={(x) => set('roomsRequired', x)} placeholder="e.g. 3 Bedrooms, Living, Kitchen" rows={2} />
            <Area label="Special requests" value={v.specialRequests} onChange={(x) => set('specialRequests', x)} rows={2} />
            <div className="grid grid-cols-2 gap-3">
              <Text label="Design style" value={v.preferredDesignStyle} onChange={(x) => set('preferredDesignStyle', x)} placeholder="Modern…" />
              <Text label="Material" value={v.preferredMaterial} onChange={(x) => set('preferredMaterial', x)} />
              <Text label="Colour theme" value={v.preferredColorTheme} onChange={(x) => set('preferredColorTheme', x)} />
            </div>
          </Section>

          <Section id="budget" icon={<Wallet className="h-4 w-4" />} title="Budget & Timeline" count={filledCount('budget')} openSecs={openSecs} toggle={toggleSec}>
            <div className="grid grid-cols-3 gap-3">
              <Text label="Estimated ₹" type="number" value={v.estimatedBudget} onChange={(x) => set('estimatedBudget', x)} />
              <Text label="Min ₹" type="number" value={v.minimumBudget} onChange={(x) => set('minimumBudget', x)} />
              <Text label="Max ₹" type="number" value={v.maximumBudget} onChange={(x) => set('maximumBudget', x)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Text label="Expected project value ₹" type="number" value={v.expectedProjectValue} onChange={(x) => set('expectedProjectValue', x)} />
              <Select label="Payment preference" value={v.paymentPreference} onChange={(x) => set('paymentPreference', x)} options={PAYMENT_PREFS} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Text label="Expected start" type="date" value={v.expectedStartDate} onChange={(x) => set('expectedStartDate', x)} />
              <Text label="Expected end" type="date" value={v.expectedEndDate} onChange={(x) => set('expectedEndDate', x)} />
              <Text label="Target completion" type="date" value={v.preferredCompletionDate} onChange={(x) => set('preferredCompletionDate', x)} />
              <Text label="Estimated duration" value={v.estimatedDuration} onChange={(x) => set('estimatedDuration', x)} placeholder="e.g. 2 months" />
            </div>
          </Section>

          <Section id="media" icon={<Camera className="h-4 w-4" />} title="Photos & Notes" count={media.length + (v.notes?.trim() ? 1 : 0)} openSecs={openSecs} toggle={toggleSec}>
            <input type="file" accept="image/*" multiple capture="environment" onChange={(e) => onFiles(e.target.files)} className="w-full text-xs" />
            {uploading && <p className="mt-1 text-xs text-muted-foreground">Uploading…</p>}
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
            <Area label="Notes" value={v.notes} onChange={(x) => set('notes', x)} rows={2} />
          </Section>
        </div>

        <DialogFooter>
          <Button onClick={submit} disabled={saving || uploading} className="w-full">
            {saving ? 'Saving…' : nextStep === 'FOLLOWUP' ? 'Save & Schedule Follow-up' : 'Save & Schedule Site Visit'}
          </Button>
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
    <div className="rounded-xl border bg-card">
      <button type="button" onClick={() => toggle(id)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
        <span className="text-primary">{icon}</span>
        <span className="text-sm font-semibold">{title}</span>
        {count > 0 && (
          <span className="flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
            <Check className="h-2.5 w-2.5" /> {count}
          </span>
        )}
        <ChevronDown className={`ml-auto h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && <div className="flex flex-col gap-3 border-t px-3 py-3">{children}</div>}
    </div>
  );
}

const inputCls = 'mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm';
function Text({ label, value, onChange, type = 'text', placeholder }: { label: string; value?: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={inputCls} placeholder={placeholder}
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
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={inputCls}>
        <option value="">Select…</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

import { BaseInput } from '@/components/ui/input';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, ChevronDown, ChevronRight, Loader2, MapPin, X } from 'lucide-react';
import api from '@/lib/api';
import { uploadFile } from '@/lib/uploadFile';
import { leadApi } from '../leads/leadApi';
import { PortalHeader } from '../employeePortal/_shared';
import QuoteWorkspace from '../leads/quote/QuoteWorkspace';
import type { LeadProjectStatus } from '@/api/boqApi';
import ConvertProjectSheet from './components/ConvertProjectSheet';
import { CARD, LeadContext } from './components/moduleUi';

/**
 * The field employee's ONE lead task — "Site Visit, Measure & Quote" (TT_MEASURE_QUOTE), also opened by
 * the older Site-Visit and BOQ-&-Quotation tasks. A short site-visit note (date, observations, photos)
 * sits above the same one-page quote sheet the office uses: rooms, sizes, items, prices, the customer's
 * ticks, PDF / print, send to office, and Create Project when the customer agrees. Nothing is typed
 * twice — the sheet IS the measurement and the quotation.
 */
export default function EmployeeQuote() {
  const [params] = useSearchParams();
  const leadId = Number(params.get('leadId'));
  const navigate = useNavigate();
  const [lead, setLead] = useState<any>(null);
  const [convertOpen, setConvertOpen] = useState(false);
  // The lead's existing project (from an earlier quote): the sheet then updates it instead of creating one.
  const [leadProject, setLeadProject] = useState<LeadProjectStatus | null>(null);

  useEffect(() => {
    if (leadId) api.get(`/leads/${leadId}`).then((r) => setLead(r.data)).catch(() => {});
  }, [leadId]);

  if (!leadId) return <p className="p-4 text-sm text-muted-foreground">No lead selected.</p>;

  return (
    <div className="flex flex-col pb-6">
      <PortalHeader title="Visit, Measure & Quote" />
      <div className="flex flex-col gap-3 p-3">
        <LeadContext name={lead?.name} sub={[lead?.city, lead?.phone].filter(Boolean).join(' · ') || undefined} />
        <SiteVisitCard leadId={leadId} agreedDate={lead?.siteVisitDate} />
        <QuoteWorkspace leadId={String(leadId)} fieldMode onChanged={() => {}} onCreateProject={(lp) => { setLeadProject(lp); setConvertOpen(true); }} />
      </div>
      <ConvertProjectSheet leadId={leadId} leadProject={leadProject} open={convertOpen} onOpenChange={setConvertOpen}
        onDone={() => navigate('/employee/tasks')} />
    </div>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

/** Record the visit once (date, notes, photos); shows what was recorded afterwards. */
function SiteVisitCard({ leadId, agreedDate }: { leadId: number; agreedDate?: string }) {
  const [visits, setVisits] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    leadApi.getSiteVisits(leadId).then((r) => setVisits(r.data || [])).catch(() => setVisits([]));
  }, [leadId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (agreedDate) setDate(String(agreedDate).slice(0, 10)); }, [agreedDate]);

  const done = visits.filter((v) => (v.status || '').toUpperCase() === 'COMPLETED');
  const last = [...done].sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0];

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        const { fileUrl } = await uploadFile(f, 'site-visit');
        setPhotos((p) => [...p, fileUrl]);
      }
    } catch { setError('Upload failed. Try again.'); } finally { setUploading(false); }
  };

  const save = async () => {
    setSaving(true); setError('');
    try {
      const sv = await api.post('/site-visits', {
        lead: { id: leadId }, visitType: 'Measurement', scheduledDate: date, purpose: notes || 'Site visit',
      });
      const id = sv.data?.id;
      if (id) {
        await api.put(`/site-visits/${id}/start`).catch(() => {});
        await api.put(`/site-visits/${id}/complete`, { outcome: 'Completed', nextActionNotes: notes }).catch(() => {});
        for (const url of photos) {
          await api.post(`/site-visits/${id}/media`, { fileUrl: url, mediaType: 'PHOTO' }).catch(() => {});
        }
      }
      setNotes(''); setPhotos([]); setOpen(false);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not save the visit.');
    } finally { setSaving(false); }
  };

  return (
    <div className={`${CARD} overflow-hidden`}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-3.5 py-3 text-left">
        <MapPin className="h-4 w-4 text-[#0A573B]" />
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold text-[#111817]">Site visit</span>
          <span className="block truncate text-[12px] text-[#7A817C]">
            {last
              ? <><CheckCircle2 className="mr-1 inline h-3 w-3 text-green-600" />Recorded {String(last.actualEndTime || last.scheduledDate || '').slice(0, 10)}{last.nextActionNotes ? ` · ${last.nextActionNotes}` : ''}</>
              : agreedDate ? `Agreed for ${String(agreedDate).slice(0, 10)} — add notes & photos after the visit` : 'Add visit notes & photos'}
          </span>
        </span>
        {open ? <ChevronDown className="h-4 w-4 text-[#7A817C]" /> : <ChevronRight className="h-4 w-4 text-[#7A817C]" />}
      </button>
      {open && (
        <div className="space-y-2.5 border-t border-[#F0EFEB] p-3.5">
          {error && <p className="rounded-md bg-[#FBE2E0] p-2 text-xs font-medium text-[#B94B45]">{error}</p>}
          <label className="block text-xs font-medium text-[#7A817C]">Visit date
            <BaseInput type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
          </label>
          <label className="block text-xs font-medium text-[#7A817C]">Notes
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              placeholder="Site condition, what the customer showed, notes for the office…"
              className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-[#0A573B]" />
          </label>
          <div>
            <span className="text-xs font-medium text-[#7A817C]">Photos</span>
            <BaseInput type="file" accept="image/*" multiple capture="environment" onChange={(e) => onFiles(e.target.files)} className="mt-1 w-full text-xs" />
            {uploading && <p className="mt-1 text-xs text-[#7A817C]">Uploading…</p>}
            {photos.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {photos.map((url, i) => (
                  <div key={i} className="relative">
                    <img src={url} alt="" className="h-16 w-16 rounded-md object-cover" />
                    <button type="button" onClick={() => setPhotos((ps) => ps.filter((_, x) => x !== i))}
                      className="absolute -right-1 -top-1 rounded-full bg-black/70 p-0.5 text-white"><X className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button type="button" onClick={save} disabled={saving || uploading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0A573B] py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save visit
          </button>
        </div>
      )}
    </div>
  );
}

import { BaseInput } from '@/components/ui/input';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, ChevronDown, ChevronRight, Image as ImageIcon, Loader2, MapPin, MessageCircle, Phone, X } from 'lucide-react';
import api from '@/lib/api';
import { resolveFileUrl, uploadFile } from '@/lib/uploadFile';
import { leadApi } from '../leads/leadApi';
import { PortalHeader } from '../employeePortal/_shared';
import QuoteWorkspace from '../leads/quote/QuoteWorkspace';
import type { LeadProjectStatus } from '@/api/boqApi';
import ConvertProjectSheet from './components/ConvertProjectSheet';
import { CARD } from './components/moduleUi';
import FileViewer from '../projectCommandCenter/documents/FileViewer';
import type { ProjectFile } from '../projectCommandCenter/documents/fileTypes';

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
  // Bumped when a site visit is saved, so its new photos show in the Site photos strip.
  const [photosKey, setPhotosKey] = useState(0);

  useEffect(() => {
    if (leadId) api.get(`/leads/${leadId}`).then((r) => setLead(r.data)).catch(() => {});
  }, [leadId]);

  if (!leadId) return <p className="p-4 text-sm text-muted-foreground">No lead selected.</p>;

  return (
    <div className="flex flex-col pb-6">
      <PortalHeader title="Visit, Measure & Quote" />
      {/* Phone: one column — who, photos, visit, then the sheet.
          Tablet (md): who + visit | photos side by side above a full-width sheet.
          Wide (xl): that context becomes a sticky left rail beside the sheet, which then has room for its table view. */}
      <div className="mx-auto w-full max-w-[1600px] p-3 md:p-4 xl:grid xl:grid-cols-[300px_minmax(0,1fr)] xl:items-start xl:gap-4">
        <aside className="flex flex-col gap-3 md:grid md:grid-cols-2 md:items-start xl:sticky xl:top-[4.25rem] xl:flex xl:max-h-[calc(100vh-11rem)] xl:overflow-y-auto">
          <CustomerCard lead={lead} />
          <div className="md:col-start-2 md:row-span-2 md:row-start-1 xl:contents">
            <SitePhotosCard leadId={leadId} refreshKey={photosKey} />
          </div>
          <SiteVisitCard leadId={leadId} agreedDate={lead?.siteVisitDate} onSaved={() => setPhotosKey((k) => k + 1)} />
        </aside>
        <div className="mt-3 min-w-0 xl:mt-0">
          <QuoteWorkspace leadId={String(leadId)} fieldMode onChanged={() => {}} onCreateProject={(lp) => { setLeadProject(lp); setConvertOpen(true); }} />
        </div>
      </div>
      <ConvertProjectSheet leadId={leadId} leadProject={leadProject} open={convertOpen} onOpenChange={setConvertOpen}
        onDone={() => navigate('/employee/tasks')} />
    </div>
  );
}

const waHref = (s: string) => 'https://wa.me/' + s.replace(/[^\d]/g, '');

/** Who the quote is for, with one-tap Call / WhatsApp — the employee is usually on the phone with them. */
function CustomerCard({ lead }: { lead: any }) {
  const phone: string | undefined = lead?.mobileNumber || lead?.phone;
  const wa: string | undefined = lead?.whatsappNumber || phone;
  const place = [lead?.address, lead?.city].filter(Boolean).join(', ');
  const btn = 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#E4E2DC] text-[#0A573B] active:bg-[#F1F3F1]';
  return (
    <div className={`${CARD} flex items-center gap-3 p-3.5`}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold text-[#111817]">{lead?.name ?? 'Loading…'}</p>
        {(place || phone) && (
          <p className="mt-0.5 truncate text-[12px] text-[#7A817C]">{[place, phone].filter(Boolean).join(' · ')}</p>
        )}
      </div>
      {phone && <a href={`tel:${phone}`} className={btn} aria-label={`Call ${lead?.name || 'customer'}`}><Phone className="h-4 w-4" /></a>}
      {wa && (
        <a href={waHref(wa)} target="_blank" rel="noopener noreferrer" className={btn} aria-label="WhatsApp">
          <MessageCircle className="h-4 w-4" />
        </a>
      )}
    </div>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif', 'bmp'];
const isImage = (type: string | undefined, url: string | undefined) => {
  const t = (type || '').toLowerCase();
  if (t === 'image' || t === 'photo') return true;
  const ext = ((url || '').split('?')[0].split('.').pop() || '').toLowerCase();
  return IMAGE_EXT.includes(ext);
};

/**
 * Every photo already on the lead — the ones captured when the lead was added (lead documents) and the
 * ones from site visits — so the person preparing the BOQ / quote can see the site without leaving the page.
 * Tap a thumbnail for the full-screen viewer.
 */
function SitePhotosCard({ leadId, refreshKey }: { leadId: number; refreshKey: number }) {
  const [files, setFiles] = useState<ProjectFile[] | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [docs, visits] = await Promise.all([
        leadApi.getDocuments(leadId).then((r) => r.data || []).catch(() => []),
        leadApi.getSiteVisits(leadId).then((r) => r.data || []).catch(() => []),
      ]);
      const media = (await Promise.all((visits as any[]).map((v) =>
        api.get(`/site-visits/${v.id}/media`).then((r) => r.data || []).catch(() => [])))).flat();
      const out: ProjectFile[] = [
        ...(docs as any[]).filter((d) => d.fileUrl && isImage(d.documentType, d.fileName || d.fileUrl)).map((d) => ({
          key: `doc${d.id}`, source: 'LEAD', sourceLabel: 'Lead photos', type: d.category || 'Photo', kind: 'image' as const,
          category: 'PHOTO' as const, fileName: d.fileName || 'Photo', fileUrl: d.fileUrl, description: d.description || d.remarks,
          addedBy: d.uploadedBy?.name, addedAt: d.createdAt, editable: false, generated: false,
        })),
        ...(media as any[]).filter((m) => m.fileUrl && isImage(m.mediaType, m.fileUrl)).map((m) => ({
          key: `svm${m.id}`, source: 'SITE_VISIT', sourceLabel: 'Site visit', type: m.category || 'Site photo', kind: 'image' as const,
          category: 'PHOTO' as const, fileName: m.description || 'Site visit photo', fileUrl: m.fileUrl, description: m.description,
          addedBy: m.uploadedByName, addedAt: m.uploadTime, editable: false, generated: false,
        })),
      ];
      if (alive) setFiles(out);
    })();
    return () => { alive = false; };
  }, [leadId, refreshKey]);

  if (files === null) return null;
  return (
    <div className={`${CARD} p-3.5`}>
      <div className="mb-2 flex items-center gap-2">
        <ImageIcon className="h-4 w-4 text-[#0A573B]" />
        <span className="flex-1 text-sm font-semibold text-[#111817]">Site photos</span>
        <span className="text-[12px] text-[#7A817C]">{files.length}</span>
      </div>
      {files.length === 0 ? (
        <p className="text-[12px] text-[#7A817C]">No photos on this lead yet. Add them with the site visit below.</p>
      ) : (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 md:flex-wrap md:overflow-visible">
          {files.map((f, i) => (
            <button key={f.key} type="button" onClick={() => setViewerIndex(i)}
              className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-[#ECEAE5] bg-[#F7F6F2]">
              <ImageIcon className="absolute inset-0 m-auto h-5 w-5 text-[#C9C6BE]" />
              <img src={resolveFileUrl(f.fileUrl)} alt="" loading="lazy" className="relative h-full w-full object-cover"
                onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/45 px-1 py-0.5 text-[9px] font-medium text-white">
                {f.source === 'SITE_VISIT' ? 'Site visit' : 'Lead'}
              </span>
            </button>
          ))}
        </div>
      )}
      {viewerIndex !== null && (
        <FileViewer files={files} index={viewerIndex} onIndex={setViewerIndex} onClose={() => setViewerIndex(null)}
          onChanged={() => {}} canEdit={false} />
      )}
    </div>
  );
}

/** Record the visit once (date, notes, photos); shows what was recorded afterwards. */
function SiteVisitCard({ leadId, agreedDate, onSaved }: { leadId: number; agreedDate?: string; onSaved?: () => void }) {
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
      load(); onSaved?.();
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

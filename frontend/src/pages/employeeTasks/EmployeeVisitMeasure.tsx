import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Trash2, ChevronDown, MapPin, Ruler, X, Home } from 'lucide-react';
import api from '@/lib/api';
import { measurementApi } from '@/api/measurementApi';
import { employeeTaskApi } from '@/api/employeeTaskApi';
import { uploadFile } from '@/lib/uploadFile';
import { PortalHeader } from '../employeePortal/_shared';

/**
 * Compact, in-portal "Site Visit & Measurement" capture for the TT_VISIT_MEASURE lead task. Replaces
 * the deep-link into the heavy desktop module: the field employee records the visit + a room-by-room
 * measurement on their phone, and on submit this creates the REAL SiteVisit + Measurement records
 * (measurement completion advances the lead workflow → BOQ), so nothing downstream breaks.
 */

const SITE_CONDITIONS = ['Ready to Move', 'Under Construction', 'Bare Shell', 'Renovation', 'Occupied'];
const ITEM_TYPES = ['Wall', 'Floor', 'Ceiling', 'Wardrobe', 'Kitchen', 'Window', 'Door', 'Loft', 'Other'];
const UNITS = ['sqft', 'ft', 'running ft', 'nos'];
const today = () => new Date().toISOString().slice(0, 10);

interface ItemDraft { itemType: string; length: string; width: string; height: string; quantity: string; unit: string }
interface RoomDraft { name: string; floor: string; open: boolean; items: ItemDraft[] }
const emptyItem = (): ItemDraft => ({ itemType: '', length: '', width: '', height: '', quantity: '1', unit: 'sqft' });
const emptyRoom = (): RoomDraft => ({ name: '', floor: '', open: true, items: [emptyItem()] });
const num = (s: string) => { const n = parseFloat(s); return isNaN(n) ? undefined : n; };
const areaOf = (it: ItemDraft) => { const l = num(it.length), w = num(it.width); return l != null && w != null ? (l * w).toFixed(2) : null; };

export default function EmployeeVisitMeasure() {
  const [params] = useSearchParams();
  const leadId = Number(params.get('leadId'));
  const navigate = useNavigate();
  const [lead, setLead] = useState<any>(null);
  const [visit, setVisit] = useState({ visitDate: today(), siteCondition: '', observations: '', outcome: 'Completed' });
  const [reschedule, setReschedule] = useState(false);
  const [rooms, setRooms] = useState<RoomDraft[]>([emptyRoom()]);
  const [photos, setPhotos] = useState<{ url: string; caption?: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState('');
  const [error, setError] = useState('');
  const [revisitOpen, setRevisitOpen] = useState(false);
  const [nextVisitDate, setNextVisitDate] = useState('');

  const load = useCallback(() => {
    if (!leadId) return;
    api.get(`/leads/${leadId}`).then((r) => {
      setLead(r.data);
      // Default the visit date to the date agreed during the requirement step.
      if (r.data?.siteVisitDate) setVisit((p) => ({ ...p, visitDate: String(r.data.siteVisitDate).slice(0, 10) }));
    }).catch(() => {});
  }, [leadId]);
  useEffect(() => { load(); }, [load]);

  const setV = (k: keyof typeof visit, val: string) => setVisit((p) => ({ ...p, [k]: val }));
  const patchRoom = (i: number, patch: Partial<RoomDraft>) => setRooms((rs) => rs.map((r, x) => x === i ? { ...r, ...patch } : r));
  const patchItem = (ri: number, ii: number, patch: Partial<ItemDraft>) =>
    setRooms((rs) => rs.map((r, x) => x === ri ? { ...r, items: r.items.map((it, y) => y === ii ? { ...it, ...patch } : it) } : r));
  const addRoom = () => setRooms((rs) => [...rs.map((r) => ({ ...r, open: false })), emptyRoom()]);
  const removeRoom = (i: number) => setRooms((rs) => rs.filter((_, x) => x !== i));
  const addItem = (ri: number) => setRooms((rs) => rs.map((r, x) => x === ri ? { ...r, items: [...r.items, emptyItem()] } : r));
  const removeItem = (ri: number, ii: number) => setRooms((rs) => rs.map((r, x) => x === ri ? { ...r, items: r.items.filter((_, y) => y !== ii) } : r));

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        const { fileUrl } = await uploadFile(f, 'site-visit');
        setPhotos((p) => [...p, { url: fileUrl }]);
      }
    } catch { setError('Upload failed. Try again.'); } finally { setUploading(false); }
  };

  // finalize=true → complete the measurement (advances the workflow to BOQ & Quotation).
  // finalize=false → save this trip's records but leave the measurement open, then schedule another
  // visit (spawns a repeat visit task; BOQ stays locked until a final visit completes).
  const submit = async (finalize = true) => {
    setError('');
    const validRooms = rooms.filter((r) => r.name.trim() && r.items.some((it) => it.itemType.trim()));
    if (validRooms.length === 0) { setError('Add at least one room with one measured item.'); return; }
    if (!finalize && !nextVisitDate) { setError('Pick the date for the next visit.'); return; }
    setSaving(true);
    try {
      // 1. Site Visit record (kept for the lead's Site Visits tab; a no-op for the workflow on combined leads).
      let visitId: number | null = null;
      try {
        setStep('Recording site visit…');
        const sv = await api.post('/site-visits', {
          lead: { id: leadId },
          visitType: 'Measurement',
          scheduledDate: visit.visitDate,
          purpose: visit.observations || 'Site visit & measurement',
        });
        visitId = sv.data?.id ?? null;
        if (visitId) {
          await api.put(`/site-visits/${visitId}/start`).catch(() => {});
          await api.put(`/site-visits/${visitId}/complete`, { outcome: visit.outcome, nextActionNotes: visit.observations }).catch(() => {});
          for (const p of photos) {
            await api.post(`/site-visits/${visitId}/media`, { fileUrl: p.url, mediaType: 'PHOTO', caption: p.caption }).catch(() => {});
          }
        }
      } catch { /* site visit is optional for the workflow — keep going to the measurement */ }

      // 2. Measurement — creating + completing this advances the lead workflow to BOQ.
      setStep('Saving measurement…');
      const m = await measurementApi.create({
        lead: { id: leadId },
        siteVisit: visitId ? { id: visitId } : undefined,
        measurementType: 'Site Measurement',
        propertyType: lead?.propertyType || undefined,
        location: lead?.city || undefined,
        constructionStage: visit.siteCondition || undefined,
        internalNotes: visit.observations || undefined,
      } as any);
      const mid = m.id!;
      await measurementApi.start(mid).catch(() => {});
      for (const r of validRooms) {
        const room = await measurementApi.addRoom(mid, { roomName: r.name.trim(), floorNumber: r.floor || undefined } as any);
        for (const it of r.items.filter((x) => x.itemType.trim())) {
          await measurementApi.addItem(mid, room.id!, {
            itemType: it.itemType.trim(),
            length: num(it.length), width: num(it.width), height: num(it.height),
            quantity: num(it.quantity) ?? 1, unit: it.unit || 'sqft',
          } as any);
        }
      }
      if (finalize) {
        setStep('Finalising…');
        await measurementApi.submit(mid);
        await measurementApi.approve(mid);
        await measurementApi.complete(mid); // → onMeasurementCompleted advances the workflow (→ BOQ)
      } else {
        // Leave the measurement open (no submit/approve/complete → no workflow advance) and schedule
        // the next visit; the backend spawns a repeat visit task and closes this attempt.
        setStep('Scheduling next visit…');
        await employeeTaskApi.scheduleRevisit(leadId, { nextVisitDate, notes: visit.observations || undefined });
      }
      navigate('/employee/tasks');
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Could not save. Please try again.');
    } finally { setSaving(false); setStep(''); }
  };

  const totalItems = rooms.reduce((n, r) => n + r.items.filter((it) => it.itemType.trim()).length, 0);

  return (
    <div className="flex flex-col pb-28">
      <PortalHeader title="Site Visit & Measurement" />

      <div className="mx-3 mt-3 rounded-xl border bg-card p-3 text-xs text-muted-foreground">
        {lead ? <><span className="font-semibold text-foreground">{lead.name}</span>{lead.city ? ` · ${lead.city}` : ''}{lead.leadNumber ? ` · ${lead.leadNumber}` : ''}</> : 'Loading lead…'}
      </div>

      {error && <p className="mx-3 mt-2 rounded-md bg-destructive/15 p-2 text-xs text-destructive">{error}</p>}

      {/* Site visit */}
      <Card icon={<MapPin className="h-4 w-4" />} title="Site Visit">
        {/* Date agreed during requirement — confirm it, or reschedule to another date. */}
        {!reschedule ? (
          <div className="flex items-center justify-between rounded-lg border bg-emerald-50 px-3 py-2.5">
            <div>
              <p className="text-[11px] text-emerald-700">Scheduled visit date</p>
              <p className="text-sm font-semibold text-emerald-900">{visit.visitDate}</p>
            </div>
            <button type="button" onClick={() => setReschedule(true)} className="rounded-md border border-emerald-300 bg-white px-2.5 py-1 text-xs font-medium text-emerald-700">Reschedule</button>
          </div>
        ) : (
          <Field label="New visit date">
            <input type="date" value={visit.visitDate} onChange={(e) => setV('visitDate', e.target.value)} className={inp} autoFocus />
          </Field>
        )}
        <Field label="Site condition">
          <select value={visit.siteCondition} onChange={(e) => setV('siteCondition', e.target.value)} className={inp}>
            <option value="">Select…</option>{SITE_CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Observations"><textarea value={visit.observations} onChange={(e) => setV('observations', e.target.value)} rows={3} className={inp} placeholder="Site condition, what the customer showed, notes for the office…" /></Field>
        <Field label="Photos">
          <input type="file" accept="image/*" multiple capture="environment" onChange={(e) => onFiles(e.target.files)} className="w-full text-xs" />
          {uploading && <p className="mt-1 text-xs text-muted-foreground">Uploading…</p>}
          {photos.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {photos.map((p, i) => (
                <div key={i} className="relative">
                  <img src={p.url} alt="" className="h-16 w-16 rounded-md object-cover" />
                  <button type="button" onClick={() => setPhotos((ps) => ps.filter((_, x) => x !== i))} className="absolute -right-1 -top-1 rounded-full bg-black/70 p-0.5 text-white"><X className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          )}
        </Field>
      </Card>

      {/* Measurement */}
      <div className="mx-3 mt-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold"><Ruler className="h-4 w-4 text-primary" /> Measurement</h2>
        <span className="text-[11px] text-muted-foreground">{rooms.length} room{rooms.length !== 1 ? 's' : ''} · {totalItems} item{totalItems !== 1 ? 's' : ''}</span>
      </div>

      <div className="mx-3 mt-2 flex flex-col gap-2">
        {rooms.map((r, ri) => (
          <div key={ri} className="rounded-xl border bg-card">
            <div className="flex items-center gap-2 px-3 py-2.5">
              <Home className="h-4 w-4 shrink-0 text-primary" />
              <input value={r.name} onChange={(e) => patchRoom(ri, { name: e.target.value })} placeholder={`Room ${ri + 1} name`} className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1.5 text-sm" />
              <input value={r.floor} onChange={(e) => patchRoom(ri, { floor: e.target.value })} placeholder="Floor" className="w-16 rounded-md border bg-background px-2 py-1.5 text-sm" />
              <button type="button" onClick={() => patchRoom(ri, { open: !r.open })} className="p-1"><ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${r.open ? 'rotate-180' : ''}`} /></button>
              {rooms.length > 1 && <button type="button" onClick={() => removeRoom(ri)} className="p-1 text-destructive"><Trash2 className="h-4 w-4" /></button>}
            </div>
            {r.open && (
              <div className="border-t px-3 py-2.5">
                <div className="flex flex-col gap-2">
                  {r.items.map((it, ii) => (
                    <div key={ii} className="rounded-lg border bg-background/60 p-2">
                      <div className="flex items-center gap-2">
                        <input list="vm-item-types" value={it.itemType} onChange={(e) => patchItem(ri, ii, { itemType: e.target.value })} placeholder="Item (Wall, Wardrobe…)" className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1.5 text-sm" />
                        <select value={it.unit} onChange={(e) => patchItem(ri, ii, { unit: e.target.value })} className="w-24 rounded-md border bg-background px-1.5 py-1.5 text-sm">
                          {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                        </select>
                        {r.items.length > 1 && <button type="button" onClick={() => removeItem(ri, ii)} className="p-1 text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>}
                      </div>
                      <div className="mt-2 grid grid-cols-4 gap-1.5">
                        <NumIn label="L" value={it.length} onChange={(x) => patchItem(ri, ii, { length: x })} />
                        <NumIn label="W" value={it.width} onChange={(x) => patchItem(ri, ii, { width: x })} />
                        <NumIn label="H" value={it.height} onChange={(x) => patchItem(ri, ii, { height: x })} />
                        <NumIn label="Qty" value={it.quantity} onChange={(x) => patchItem(ri, ii, { quantity: x })} />
                      </div>
                      {areaOf(it) && <p className="mt-1 text-[11px] text-muted-foreground">Area ≈ <span className="font-medium text-foreground">{areaOf(it)}</span> sqft (L×W)</p>}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => addItem(ri)} className="mt-2 flex items-center gap-1 text-xs font-medium text-primary"><Plus className="h-3.5 w-3.5" /> Add item</button>
              </div>
            )}
          </div>
        ))}
        <datalist id="vm-item-types">{ITEM_TYPES.map((t) => <option key={t} value={t} />)}</datalist>
        <button type="button" onClick={addRoom} className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed py-2.5 text-sm font-medium text-primary"><Plus className="h-4 w-4" /> Add room</button>
      </div>

      {/* Sticky submit */}
      <div className="fixed bottom-16 left-1/2 z-20 w-full max-w-md -translate-x-1/2 border-t bg-card px-3 py-2 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
        {revisitOpen && (
          <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
            <p className="mb-1.5 text-[11px] font-medium text-amber-800">Save what you measured today and come back — the BOQ stays on hold until the final visit.</p>
            <div className="flex items-center gap-2">
              <input type="date" value={nextVisitDate} onChange={(e) => setNextVisitDate(e.target.value)}
                className="flex-1 rounded-md border bg-background px-2 py-1.5 text-sm" />
              <button onClick={() => submit(false)} disabled={saving || uploading || !nextVisitDate}
                className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                {saving ? (step || 'Saving…') : 'Save & schedule'}
              </button>
            </div>
          </div>
        )}
        <button onClick={() => submit(true)} disabled={saving || uploading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-3 text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-60">
          {saving ? (step || 'Saving…') : 'Finish & Submit'}
        </button>
        <button type="button" onClick={() => setRevisitOpen((o) => !o)} disabled={saving}
          className="mt-1.5 w-full py-1.5 text-center text-xs font-medium text-amber-700 active:opacity-70">
          {revisitOpen ? 'Cancel' : 'Need another visit?'}
        </button>
      </div>
    </div>
  );
}

const inp = 'mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm';
function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="mx-3 mt-3 rounded-xl border bg-card p-3">
      <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><span className="text-primary">{icon}</span> {title}</div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="text-xs font-medium text-muted-foreground">{label}</label>{children}</div>;
}
function NumIn({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <span className="block text-center text-[10px] text-muted-foreground">{label}</span>
      <input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-md border bg-background px-1.5 py-1.5 text-center text-sm" />
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, FileSpreadsheet, CheckCircle2, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { boqApi } from '@/api/boqApi';
import { leadApi } from '../leads/leadApi';
import type { Boq, BoqItem } from '@/types/boq';
import { PortalHeader } from '../employeePortal/_shared';
import BoqItemEditor from '@/components/boq/BoqItemEditor';
import { inr, CARD, PRIMARY_BTN, DocStatus, LeadContext, Totals, BottomBar } from './components/moduleUi';

/**
 * Compact in-portal BOQ for the TT_PREPARE_BOQ lead task. Auto-generates the BOQ from the lead's
 * completed measurement, shows a clean room-by-room summary with light edits (quantity, add/remove a
 * line), and Submit & Approve advances the workflow to the Quotation task. Detailed pricing stays in
 * the desktop module.
 */
export default function EmployeeBoq() {
  const [params] = useSearchParams();
  const leadId = Number(params.get('leadId'));
  const navigate = useNavigate();
  const [lead, setLead] = useState<any>(null);
  const [boq, setBoq] = useState<Boq | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [newItem, setNewItem] = useState({ roomName: '', itemName: '', quantity: '1', unit: 'nos' });

  const reload = useCallback((id: number) => boqApi.get(id).then(setBoq), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (leadId) api.get(`/leads/${leadId}`).then((r) => setLead(r.data)).catch(() => {});
      const existing = (await leadApi.getBoqs(leadId).then((r) => r.data).catch(() => [])) as Boq[];
      const latest = existing.find((b) => b.isLatestVersion) || existing[existing.length - 1];
      if (latest?.id) { await reload(latest.id); return; }
      // No BOQ yet — generate it from the completed measurement.
      const measurements = (await leadApi.getMeasurements(leadId).then((r) => r.data).catch(() => [])) as any[];
      const done = measurements.find((m) => m.status === 'Completed') || measurements[0];
      if (!done?.id) { setError('No completed measurement found for this lead. Finish the site visit & measurement first.'); return; }
      const created = await boqApi.createFromMeasurement(done.id);
      if (created?.id) await reload(created.id);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not load or generate the BOQ.');
    } finally { setLoading(false); }
  }, [leadId, reload]);

  useEffect(() => { load(); }, [load]);

  const approved = boq?.status === 'APPROVED';
  const addItem = async () => {
    if (!boq?.id || !newItem.itemName.trim()) return;
    setBusy(true);
    try {
      await boqApi.addItem(boq.id, {
        itemName: newItem.itemName.trim(), roomName: newItem.roomName.trim() || 'General',
        quantity: parseFloat(newItem.quantity) || 1, unit: newItem.unit || 'nos',
      });
      setNewItem({ roomName: '', itemName: '', quantity: '1', unit: 'nos' });
      await reload(boq.id);
    } finally { setBusy(false); }
  };

  const submit = async () => {
    if (!boq?.id) return;
    setBusy(true); setError('');
    try {
      if (boq.status !== 'APPROVED') {
        if (boq.status === 'DRAFT' || boq.status === 'REJECTED') await boqApi.submitForReview(boq.id);
        await boqApi.approve(boq.id); // → onBoqApproved advances the workflow to the Quotation task
      }
      navigate('/employee/tasks');
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not submit the BOQ.');
    } finally { setBusy(false); }
  };

  // Group items by room for a readable summary.
  const rooms: Record<string, BoqItem[]> = {};
  (boq?.items || []).forEach((it) => { (rooms[it.roomName || 'General'] ||= []).push(it); });

  return (
    <div className="flex flex-col pb-28">
      <PortalHeader title="BOQ Creation" />
      <div className="flex flex-col gap-3 p-3.5">
      <LeadContext
        name={lead?.name}
        sub={lead?.city}
        refs={[boq?.boqNumber]}
        status={<DocStatus status={boq?.status} />}
      />

      <p className="px-1 text-[12px] text-[#7A817C]">
        Auto-built from the site measurement. Check quantities, add anything missing, then approve to unlock the quotation.
      </p>

      {error && <p className="rounded-md bg-[#FBE2E0] p-2.5 text-xs font-medium text-[#B94B45]">{error}</p>}
      {loading && (
        <div className="flex items-center gap-2 px-1 py-6 text-sm text-[#7A817C]">
          <Loader2 className="h-4 w-4 animate-spin" /> Generating BOQ from the measurement…
        </div>
      )}

      {boq && !loading && (
        <>
          <div className="flex flex-col gap-2.5">
            {Object.entries(rooms).map(([room, items]) => (
              <div key={room} className={`${CARD} overflow-hidden`}>
                <div className="flex items-center justify-between border-b border-[#F0EFEB] px-4 py-2.5">
                  <span className="text-sm font-semibold text-[#111817]">{room}</span>
                  <span className="rounded-full bg-[#EEF0EE] px-2 py-0.5 text-[11px] font-semibold text-[#5B625E]">{items.length} item{items.length !== 1 ? 's' : ''}</span>
                </div>
                <div>
                  {items.map((it) => (
                    <BoqItemEditor key={it.id} boqId={boq!.id!} item={it} editable={!approved} onChanged={() => reload(boq!.id!)} />
                  ))}
                </div>
              </div>
            ))}
            {(boq.items || []).length === 0 && (
              <p className={`${CARD} p-6 text-center text-sm text-[#7A817C]`}>No items yet — add one below.</p>
            )}
          </div>

          {!approved && (
            <div className={`${CARD} p-3.5`}>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#7A817C]">Add a line</p>
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <input value={newItem.roomName} onChange={(e) => setNewItem({ ...newItem, roomName: e.target.value })} placeholder="Room" className={fieldCls} />
                  <input value={newItem.itemName} onChange={(e) => setNewItem({ ...newItem, itemName: e.target.value })} placeholder="Item name" className={fieldCls} />
                </div>
                <div className="flex gap-2">
                  <input inputMode="decimal" value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })} placeholder="Qty" className={`${fieldCls} w-20`} />
                  <input value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })} placeholder="Unit" className={`${fieldCls} w-24`} />
                  <button type="button" onClick={addItem} disabled={busy || !newItem.itemName.trim()} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#E7F2EC] text-sm font-semibold text-[#0A573B] active:scale-[0.99] disabled:opacity-50"><Plus className="h-4 w-4" /> Add</button>
                </div>
              </div>
            </div>
          )}

          <Totals
            rows={[
              { label: 'Subtotal', value: inr(boq.subtotal) },
              ...(boq.discountAmount ? [{ label: 'Discount', value: `- ${inr(boq.discountAmount)}` }] : []),
              ...(boq.taxAmount ? [{ label: `Tax${boq.taxPercent ? ` (${boq.taxPercent}%)` : ''}`, value: inr(boq.taxAmount) }] : []),
            ]}
            grand={boq.grandTotal}
          />
        </>
      )}
      </div>

      <BottomBar>
        {approved ? (
          <button onClick={() => navigate('/employee/tasks')} className={PRIMARY_BTN}>
            <CheckCircle2 className="h-4 w-4" /> BOQ approved — back to tasks
          </button>
        ) : (
          <button onClick={submit} disabled={busy || loading || !boq} className={PRIMARY_BTN}>
            <FileSpreadsheet className="h-4 w-4" /> {busy ? 'Submitting…' : 'Submit & Approve BOQ'}
          </button>
        )}
      </BottomBar>
    </div>
  );
}

const fieldCls = 'rounded-lg border border-[#DDE2DE] bg-white px-3 py-2 text-sm outline-none focus:border-[#0A573B]';

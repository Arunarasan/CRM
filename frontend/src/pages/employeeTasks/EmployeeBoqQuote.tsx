import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, FileSpreadsheet, CheckCircle2, Check, Loader2, Rocket } from 'lucide-react';
import api from '@/lib/api';
import { boqApi } from '@/api/boqApi';
import { quotationApi, boqQuotationApi } from '@/api/quotationApi';
import { leadApi } from '../leads/leadApi';
import type { Boq, BoqItem } from '@/types/boq';
import type { Quotation } from '@/types/quotation';
import { PortalHeader } from '../employeePortal/_shared';
import BoqItemEditor from '@/components/boq/BoqItemEditor';
import ConvertProjectSheet from './components/ConvertProjectSheet';
import { inr, CARD, PRIMARY_BTN, LeadContext, DocStatus, Totals, BottomBar } from './components/moduleUi';

/**
 * Combined BOQ + Quotation page for the single TT_BOQ_QUOTE lead task. Two guided steps on one screen:
 *   Step 1 — generate the BOQ from the measurement, tweak quantities, Approve.
 *   Step 2 — generate the quotation from the approved BOQ, set terms, Send for approval.
 * The office then approves + converts to a project (which completes this task). Replaces the two
 * separate BOQ / Quotation pages with one flow.
 */
export default function EmployeeBoqQuote() {
  const [params] = useSearchParams();
  const leadId = Number(params.get('leadId'));
  const navigate = useNavigate();
  const [lead, setLead] = useState<any>(null);
  const [step, setStep] = useState<'boq' | 'quote'>('boq');
  const [boq, setBoq] = useState<Boq | null>(null);
  const [quote, setQuote] = useState<Quotation | null>(null);
  const [terms, setTerms] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [convertOpen, setConvertOpen] = useState(false);
  const [newItem, setNewItem] = useState({ roomName: '', itemName: '', quantity: '1', unit: 'nos' });

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      if (leadId) api.get(`/leads/${leadId}`).then((r) => setLead(r.data)).catch(() => {});
      // Existing quotation? → jump to the quotation step.
      const quotes = (await leadApi.getQuotations(leadId).then((r) => r.data).catch(() => [])) as Quotation[];
      const existingQuote = quotes.find((x) => x.status !== 'REVISED') || quotes[quotes.length - 1];
      const existingBoqs = (await leadApi.getBoqs(leadId).then((r) => r.data).catch(() => [])) as Boq[];
      const latestBoq = existingBoqs.find((b) => b.isLatestVersion) || existingBoqs[existingBoqs.length - 1];

      if (existingQuote?.id) {
        setQuote(existingQuote); setTerms(existingQuote.termsAndConditions || '');
        if (latestBoq?.id) setBoq(await boqApi.get(latestBoq.id));
        setStep('quote');
        return;
      }
      // Need a BOQ. Use the latest, else generate from the completed measurement.
      let b = latestBoq?.id ? await boqApi.get(latestBoq.id) : null;
      if (!b) {
        const measurements = (await leadApi.getMeasurements(leadId).then((r) => r.data).catch(() => [])) as any[];
        const done = measurements.find((m) => m.status === 'Completed') || measurements[0];
        if (!done?.id) { setError('No completed measurement found. Finish the site visit & measurement first.'); return; }
        const created = await boqApi.createFromMeasurement(done.id);
        b = created?.id ? await boqApi.get(created.id) : null;
      }
      setBoq(b);
      setStep(b?.status === 'APPROVED' ? 'quote' : 'boq');
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not load the BOQ / quotation.');
    } finally { setLoading(false); }
  }, [leadId]);

  useEffect(() => { load(); }, [load]);

  const reloadBoq = async () => { if (boq?.id) setBoq(await boqApi.get(boq.id)); };
  const addItem = async () => {
    if (!boq?.id || !newItem.itemName.trim()) return; setBusy(true);
    try {
      await boqApi.addItem(boq.id, { itemName: newItem.itemName.trim(), roomName: newItem.roomName.trim() || 'General', quantity: parseFloat(newItem.quantity) || 1, unit: newItem.unit || 'nos' });
      setNewItem({ roomName: '', itemName: '', quantity: '1', unit: 'nos' }); await reloadBoq();
    } finally { setBusy(false); }
  };

  // Step 1 → approve BOQ, then generate the quotation and move to step 2.
  const approveBoqAndContinue = async () => {
    if (!boq?.id) return; setBusy(true); setError('');
    try {
      if (boq.status !== 'APPROVED') {
        if (boq.status === 'DRAFT' || boq.status === 'REJECTED') await boqApi.submitForReview(boq.id);
        await boqApi.approve(boq.id);
      }
      const q = await boqQuotationApi.generateFromBoq(boq.id, { mode: 'ALL' });
      setQuote(q); setTerms(q.termsAndConditions || ''); setStep('quote');
    } catch (e: any) { setError(e?.response?.data?.message || 'Could not approve the BOQ.'); }
    finally { setBusy(false); }
  };

  const sent = quote?.status === 'APPROVED' || quote?.status === 'CONVERTED' || quote?.internalApprovalStatus === 'PENDING';
  const sendQuotation = async () => {
    if (!quote?.id) return; setBusy(true); setError('');
    try {
      if (terms !== (quote.termsAndConditions || '')) await quotationApi.update(quote.id, { termsAndConditions: terms });
      await quotationApi.updateApprovalStatus(quote.id, 'PENDING');
      navigate('/employee/tasks');
    } catch (e: any) { setError(e?.response?.data?.message || 'Could not send the quotation.'); }
    finally { setBusy(false); }
  };

  const rooms: Record<string, BoqItem[]> = {};
  (boq?.items || []).forEach((it) => { (rooms[it.roomName || 'General'] ||= []).push(it); });
  const boqApproved = boq?.status === 'APPROVED';

  return (
    <div className="flex flex-col pb-28">
      <PortalHeader title="BOQ & Quotation" />
      <div className="flex flex-col gap-3 p-3.5">
        {/* Stepper */}
        <div className="flex items-center gap-2">
          <StepPill active={step === 'boq'} done={boqApproved} n={1} label="BOQ" />
          <div className={`h-0.5 flex-1 rounded-full ${boqApproved ? 'bg-[#0A573B]' : 'bg-[#E1E3DF]'}`} />
          <StepPill active={step === 'quote'} done={sent} n={2} label="Quotation" />
        </div>

        <LeadContext
          name={lead?.name}
          refs={[boq?.boqNumber, step === 'quote' ? quote?.quotationNumber : null]}
          status={<DocStatus status={step === 'quote' ? quote?.status : boq?.status} />}
        />

        {error && <p className="rounded-md bg-[#FBE2E0] p-2.5 text-xs font-medium text-[#B94B45]">{error}</p>}
        {loading && (
          <div className="flex items-center gap-2 px-1 py-6 text-sm text-[#7A817C]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        )}

        {/* ---------- Step 1: BOQ ---------- */}
        {step === 'boq' && boq && !loading && (
          <>
            <p className="px-1 text-[12px] text-[#7A817C]">Auto-built from the measurement. Check quantities and add anything missing.</p>
            <div className="flex flex-col gap-2.5">
              {Object.entries(rooms).map(([room, items]) => (
                <div key={room} className={`${CARD} overflow-hidden`}>
                  <div className="flex items-center justify-between border-b border-[#F0EFEB] px-4 py-2.5">
                    <span className="text-sm font-semibold text-[#111817]">{room}</span>
                    <span className="rounded-full bg-[#EEF0EE] px-2 py-0.5 text-[11px] font-semibold text-[#5B625E]">{items.length} item{items.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div>
                    {items.map((it) => (
                      <BoqItemEditor key={it.id} boqId={boq!.id!} item={it} editable onChanged={reloadBoq} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className={`${CARD} p-3.5`}>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#7A817C]">Add a line</p>
              <div className="grid grid-cols-2 gap-2">
                <input value={newItem.roomName} onChange={(e) => setNewItem({ ...newItem, roomName: e.target.value })} placeholder="Room" className={fieldCls} />
                <input value={newItem.itemName} onChange={(e) => setNewItem({ ...newItem, itemName: e.target.value })} placeholder="Item name" className={fieldCls} />
              </div>
              <div className="mt-2 flex gap-2">
                <input inputMode="decimal" value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })} placeholder="Qty" className={`${fieldCls} w-20`} />
                <input value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })} placeholder="Unit" className={`${fieldCls} w-24`} />
                <button type="button" onClick={addItem} disabled={busy || !newItem.itemName.trim()} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#E7F2EC] text-sm font-semibold text-[#0A573B] active:scale-[0.99] disabled:opacity-50"><Plus className="h-4 w-4" /> Add</button>
              </div>
            </div>
            <Totals
              rows={[
                { label: 'Subtotal', value: inr(boq.subtotal) },
                ...(boq.taxAmount ? [{ label: `Tax${boq.taxPercent ? ` (${boq.taxPercent}%)` : ''}`, value: inr(boq.taxAmount) }] : []),
              ]}
              grand={boq.grandTotal}
            />
          </>
        )}

        {/* ---------- Step 2: Quotation ---------- */}
        {step === 'quote' && quote && !loading && (
          <>
            <p className="px-1 text-[12px] text-[#7A817C]">Priced from the approved BOQ. Set the terms, then send it for office approval.</p>
            <div className={`${CARD} overflow-hidden`}>
              <div className="flex items-center justify-between border-b border-[#F0EFEB] px-4 py-2.5">
                <h3 className="text-sm font-semibold text-[#111817]">Quotation line items</h3>
                <span className="rounded-full bg-[#EEF0EE] px-2 py-0.5 text-[11px] font-semibold text-[#5B625E]">{(quote.items || []).length}</span>
              </div>
              <div className="divide-y divide-[#F0EFEB]">
                {(quote.items || []).map((it, i) => (
                  <div key={it.id ?? i} className="flex items-center gap-2 px-4 py-2.5">
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-[#111817]">{it.itemName}</p><p className="text-[11px] text-[#7A817C]">{it.quantity ?? ''} {it.unit ?? ''} {it.rate ? `× ${inr(it.rate)}` : ''}</p></div>
                    <span className="text-sm font-semibold text-[#111817] tabular-nums">{inr(it.totalAmount)}</span>
                  </div>
                ))}
                {(quote.items || []).length === 0 && <p className="px-4 py-6 text-center text-sm text-[#7A817C]">No line items.</p>}
              </div>
            </div>
            <Totals
              rows={[
                ...(quote.discount ? [{ label: 'Discount', value: `- ${inr(quote.discount)}` }] : []),
                ...(quote.gst ? [{ label: 'GST', value: inr(quote.gst) }] : []),
              ]}
              grand={quote.grandTotal}
            />
            <div className={`${CARD} p-3.5`}>
              <label className="text-xs font-bold uppercase tracking-wide text-[#7A817C]">Terms &amp; conditions</label>
              <textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={3} disabled={sent} className="mt-2 w-full rounded-lg border border-[#DDE2DE] bg-white px-3 py-2 text-sm outline-none focus:border-[#0A573B] disabled:opacity-70" placeholder="Payment terms, validity, warranty…" />
            </div>
          </>
        )}
      </div>

      <BottomBar>
        {step === 'boq' ? (
          <button onClick={approveBoqAndContinue} disabled={busy || loading || !boq} className={PRIMARY_BTN}>
            <FileSpreadsheet className="h-4 w-4" /> {busy ? 'Working…' : 'Approve BOQ & Continue'}
          </button>
        ) : sent ? (
          <button onClick={() => navigate('/employee/tasks')} className={PRIMARY_BTN}>
            <CheckCircle2 className="h-4 w-4" /> Sent for approval — back to tasks
          </button>
        ) : (
          <>
            <button onClick={() => setConvertOpen(true)} disabled={busy || loading || !quote} className={PRIMARY_BTN}>
              <Rocket className="h-4 w-4" /> Create Project
            </button>
            <button onClick={sendQuotation} disabled={busy || loading || !quote}
              className="mt-2 w-full py-2 text-center text-[13px] font-semibold text-[#0A573B] active:opacity-70 disabled:opacity-50">
              {busy ? 'Sending…' : 'Or send to office for approval'}
            </button>
          </>
        )}
      </BottomBar>

      <ConvertProjectSheet leadId={leadId} open={convertOpen} onOpenChange={setConvertOpen}
        onDone={() => navigate('/employee/tasks')} />
    </div>
  );
}

function StepPill({ active, done, n, label }: { active: boolean; done: boolean; n: number; label: string }) {
  return (
    <div className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${done ? 'border-[#BFE0CE] bg-[#E7F2EC] text-[#28704F]' : active ? 'border-[#0A573B] bg-[#0A573B] text-white' : 'border-[#E1E3DF] bg-white text-[#8A918C]'}`}>
      <span className={`grid h-4 w-4 place-items-center rounded-full text-[10px] ${done ? 'bg-[#28704F] text-white' : active ? 'bg-white text-[#0A573B]' : 'bg-[#EEF0EE] text-[#8A918C]'}`}>
        {done ? <Check className="h-3 w-3" /> : n}
      </span>
      {label}
    </div>
  );
}

const fieldCls = 'rounded-lg border border-[#DDE2DE] bg-white px-3 py-2 text-sm outline-none focus:border-[#0A573B]';

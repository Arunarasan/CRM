import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, Rocket } from 'lucide-react';
import api from '@/lib/api';
import { quotationApi, boqQuotationApi } from '@/api/quotationApi';
import { leadApi } from '../leads/leadApi';
import type { Quotation } from '@/types/quotation';
import type { Boq } from '@/types/boq';
import { PortalHeader } from '../employeePortal/_shared';
import ConvertProjectSheet from './components/ConvertProjectSheet';
import { inr, CARD, PRIMARY_BTN, DocStatus, LeadContext, Totals, BottomBar } from './components/moduleUi';

/**
 * Compact in-portal Quotation for the TT_GENERATE_QUOTE lead task. Auto-generates the quotation from
 * the approved BOQ, shows a clean line-item summary + editable terms, and "Send for Approval" flags it
 * for the office. The admin then approves + converts to a project (see the Convert step). Detailed
 * pricing edits stay in the BOQ / desktop module.
 */
export default function EmployeeQuotation() {
  const [params] = useSearchParams();
  const leadId = Number(params.get('leadId'));
  const navigate = useNavigate();
  const [lead, setLead] = useState<any>(null);
  const [quote, setQuote] = useState<Quotation | null>(null);
  const [terms, setTerms] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [convertOpen, setConvertOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      if (leadId) api.get(`/leads/${leadId}`).then((r) => setLead(r.data)).catch(() => {});
      const existing = (await leadApi.getQuotations(leadId).then((r) => r.data).catch(() => [])) as Quotation[];
      let q = existing.find((x) => x.status !== 'REVISED') || existing[existing.length - 1];
      if (!q?.id) {
        const boqs = (await leadApi.getBoqs(leadId).then((r) => r.data).catch(() => [])) as Boq[];
        const approvedBoq = boqs.find((b) => b.status === 'APPROVED');
        if (!approvedBoq?.id) { setError('No approved BOQ found. Approve the BOQ first.'); return; }
        q = await boqQuotationApi.generateFromBoq(approvedBoq.id, { mode: 'ALL' });
      }
      setQuote(q);
      setTerms(q.termsAndConditions || '');
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not load or generate the quotation.');
    } finally { setLoading(false); }
  }, [leadId]);

  useEffect(() => { load(); }, [load]);

  const sent = quote?.status === 'APPROVED' || quote?.status === 'CONVERTED' || quote?.internalApprovalStatus === 'PENDING';

  const submit = async () => {
    if (!quote?.id) return;
    setBusy(true); setError('');
    try {
      if (terms !== (quote.termsAndConditions || '')) {
        await quotationApi.update(quote.id, { termsAndConditions: terms });
      }
      await quotationApi.updateApprovalStatus(quote.id, 'PENDING'); // flag for the office to approve + convert
      navigate('/employee/tasks');
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not send the quotation.');
    } finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col pb-28">
      <PortalHeader title="Quotation" />
      <div className="flex flex-col gap-3 p-3.5">
        <LeadContext
          name={lead?.name}
          sub={lead?.city}
          refs={[quote?.quotationNumber]}
          status={<DocStatus status={quote?.status} />}
        />

        <p className="px-1 text-[12px] text-[#7A817C]">
          Priced automatically from the approved BOQ. Review the lines and terms, then send it to the office for approval.
        </p>

        {error && <p className="rounded-md bg-[#FBE2E0] p-2.5 text-xs font-medium text-[#B94B45]">{error}</p>}
        {loading && (
          <div className="flex items-center gap-2 px-1 py-6 text-sm text-[#7A817C]">
            <Loader2 className="h-4 w-4 animate-spin" /> Generating quotation from the BOQ…
          </div>
        )}

        {quote && !loading && (
          <>
            <div className={`${CARD} overflow-hidden`}>
              <div className="flex items-center justify-between border-b border-[#F0EFEB] px-4 py-2.5">
                <h3 className="text-sm font-semibold text-[#111817]">Line items</h3>
                <span className="rounded-full bg-[#EEF0EE] px-2 py-0.5 text-[11px] font-semibold text-[#5B625E]">{(quote.items || []).length}</span>
              </div>
              <div className="divide-y divide-[#F0EFEB]">
                {(quote.items || []).map((it, i) => (
                  <div key={it.id ?? i} className="flex items-center gap-2 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[#111817]">{it.itemName}</p>
                      <p className="text-[11px] text-[#7A817C]">{it.quantity ?? ''} {it.unit ?? ''} {it.rate ? `× ${inr(it.rate)}` : ''}</p>
                    </div>
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
              <textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={3} disabled={sent}
                className="mt-2 w-full rounded-lg border border-[#DDE2DE] bg-white px-3 py-2 text-sm outline-none focus:border-[#0A573B] disabled:opacity-70" placeholder="Payment terms, validity, warranty…" />
            </div>
          </>
        )}
      </div>

      <BottomBar>
        {sent ? (
          <button onClick={() => navigate('/employee/tasks')} className={PRIMARY_BTN}>
            <CheckCircle2 className="h-4 w-4" /> Sent for approval — back to tasks
          </button>
        ) : (
          <>
            <button onClick={() => setConvertOpen(true)} disabled={busy || loading || !quote} className={PRIMARY_BTN}>
              <Rocket className="h-4 w-4" /> Create Project
            </button>
            <button onClick={submit} disabled={busy || loading || !quote}
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

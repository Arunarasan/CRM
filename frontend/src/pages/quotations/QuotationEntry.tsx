import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { boqQuotationApi } from '@/api/quotationApi';
import { leadApi } from '@/pages/leads/leadApi';
import type { Boq } from '@/types/boq';

const isApproved = (s?: string) => s === 'Approved' || s === 'APPROVED';

/**
 * Entry point for the "Generate Quotation" task. A quotation is derived from an approved BOQ, so this
 * resolves the right quotation for the lead and sends the user to its FULL page:
 *   - lead already has a quotation → /quotations/{id}
 *   - approved BOQ                 → generate the quotation, then /quotations/{id}
 *   - neither                      → guidance to finish/approve the BOQ first
 */
export default function QuotationEntry() {
  const [params] = useSearchParams();
  const leadId = params.get('leadId');
  const navigate = useNavigate();
  const [status, setStatus] = useState<'working' | 'need-boq' | 'error'>('working');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!leadId) return;
    (async () => {
      try {
        // Already has a quotation for this lead? open it.
        const qres = await leadApi.getQuotations(leadId);
        const quotes = ((qres as any).data ?? qres) as any[];
        if (quotes && quotes.length && quotes[0]?.id) { navigate(`/quotations/${quotes[0].id}`, { replace: true }); return; }
        // Otherwise generate from the lead's approved BOQ.
        const res = await leadApi.getBoqs(leadId);
        const boqs = ((res as any).data ?? res) as Boq[];
        const approved = boqs.find((b) => isApproved(b.status));
        if (!approved) { setStatus('need-boq'); return; }
        const q = await boqQuotationApi.generateFromBoq(approved.id!, { mode: 'ALL' });
        navigate(`/quotations/${q.id}`, { replace: true });
      } catch (e: any) {
        setMessage(e?.response?.data?.message || e?.response?.data || 'Failed to open the quotation.');
        setStatus('error');
      }
    })();
  }, [leadId, navigate]);

  if (!leadId) return <Navigate to="/quotations" replace />;

  return (
    <div className="p-6 max-w-lg mx-auto text-center space-y-3">
      {status === 'working' && <p className="text-sm text-muted-foreground">Opening the quotation…</p>}
      {status === 'need-boq' && (
        <>
          <p className="text-sm">No approved BOQ for this lead yet — the quotation is generated from it.</p>
          <div className="flex justify-center gap-2">
            <Button onClick={() => navigate(`/boq/new?leadId=${leadId}`)}>Prepare the BOQ</Button>
            <Button variant="outline" onClick={() => navigate(`/leads/${leadId}?tab=quotations`)}>Open lead</Button>
          </div>
        </>
      )}
      {status === 'error' && (
        <>
          <p className="text-sm text-destructive">{message}</p>
          <Button variant="outline" onClick={() => navigate(`/leads/${leadId}?tab=quotations`)}>Open lead's Quotation tab</Button>
        </>
      )}
    </div>
  );
}

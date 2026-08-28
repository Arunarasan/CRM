import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { boqApi } from '@/api/boqApi';
import { leadApi } from '@/pages/leads/leadApi';

/**
 * Entry point for the "Prepare BOQ" task. A BOQ is derived from a completed measurement, so this page
 * resolves the right BOQ for the lead and sends the user to its FULL editor page:
 *   - lead already has a BOQ  → /boq/{id}/edit
 *   - completed measurement   → generate the BOQ, then /boq/{id}/edit
 *   - neither                 → guidance to finish the measurement first
 * With no leadId it behaves like the old /boq/new (start from a measurement).
 */
export default function BoqEntry() {
  const [params] = useSearchParams();
  const leadId = params.get('leadId');
  const navigate = useNavigate();
  const [status, setStatus] = useState<'working' | 'need-measurement' | 'error'>('working');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!leadId) return;
    (async () => {
      try {
        const existing = await boqApi.getByLead(Number(leadId));
        if (existing && existing.length) { navigate(`/boq/${existing[0].id}/edit`, { replace: true }); return; }
        const res = await leadApi.getMeasurements(leadId);
        const list = ((res as any).data ?? res) as any[];
        const completed = list.find((m) => m.status === 'Completed');
        if (!completed) { setStatus('need-measurement'); return; }
        const boq = await boqApi.createFromMeasurement(completed.id);
        navigate(`/boq/${boq.id}/edit`, { replace: true });
      } catch (e: any) {
        setMessage(e?.response?.data?.message || e?.response?.data || 'Failed to open the BOQ.');
        setStatus('error');
      }
    })();
  }, [leadId, navigate]);

  if (!leadId) return <Navigate to="/measurements" replace />;

  return (
    <div className="p-6 max-w-lg mx-auto text-center space-y-3">
      {status === 'working' && <p className="text-sm text-muted-foreground">Opening the BOQ…</p>}
      {status === 'need-measurement' && (
        <>
          <p className="text-sm">No completed measurement for this lead yet — the BOQ is generated from it.</p>
          <div className="flex justify-center gap-2">
            <Button onClick={() => navigate(`/measurements/new?leadId=${leadId}`)}>Do the measurement</Button>
            <Button variant="outline" onClick={() => navigate(`/leads/${leadId}?tab=boqs`)}>Open lead</Button>
          </div>
        </>
      )}
      {status === 'error' && (
        <>
          <p className="text-sm text-destructive">{message}</p>
          <Button variant="outline" onClick={() => navigate(`/leads/${leadId}?tab=boqs`)}>Open lead's BOQ tab</Button>
        </>
      )}
    </div>
  );
}

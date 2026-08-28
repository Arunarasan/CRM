import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SelectField, TextAreaField, TextField } from '../leads/fields';
import { siteVisitApi } from '@/lib/siteVisitApi';
import { leadApi } from '@/pages/leads/leadApi';

const VISIT_TYPES = ['Initial Visit', 'Consultation', 'Measurement', 'Design Discussion', 'Site Inspection', 'Other'];

/**
 * Dedicated "schedule a site visit for this lead" page. Backs the Schedule/Conduct Site Visit tasks:
 * creates a real SiteVisit, then drops the user on its full profile page to conduct + complete it —
 * completeVisit fires onSiteVisitCompleted and advances the lead workflow.
 */
export default function SiteVisitCreate() {
  const [params] = useSearchParams();
  const leadId = params.get('leadId');
  const navigate = useNavigate();

  const [visitType, setVisitType] = useState('Initial Visit');
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().slice(0, 10));
  const [purpose, setPurpose] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Guard against duplicate creation: the workflow "Open Site Visit page" button always lands here,
  // so without this every re-visit would schedule another visit for the same lead. We look up the
  // lead's existing visits and, by default, show them — a new one is scheduled only when the user
  // explicitly confirms. `existing === null` means "not checked yet" (form stays hidden).
  const [existing, setExisting] = useState<any[] | null>(null);
  const [confirmNew, setConfirmNew] = useState(false);

  useEffect(() => {
    if (!leadId) { setExisting([]); return; }
    leadApi.getSiteVisits(leadId)
      .then((res) => setExisting(((res as any)?.data ?? res) as any[]))
      .catch(() => setExisting([]));
  }, [leadId]);

  // Prefer the real previous screen so Back returns wherever the user came from (task detail, a list,
  // a search result) instead of a hardcoded lead page. Fall back to the lead only when opened directly.
  const handleBack = () => {
    if (window.history.length > 2) { navigate(-1); return; }
    navigate(leadId ? `/leads/${leadId}?tab=sitevisits` : '/site-visits');
  };

  const create = async () => {
    if (!leadId) return;
    setBusy(true); setError('');
    try {
      const v = await siteVisitApi.create({ lead: { id: Number(leadId) }, visitType, scheduledDate, purpose: purpose || undefined });
      navigate(`/site-visits/${v.id}`); // full profile page to conduct + complete
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to schedule the site visit.');
    } finally { setBusy(false); }
  };

  if (!leadId) return <div className="p-6 text-center text-sm text-muted-foreground">No lead specified for this site visit.</div>;

  const showForm = existing !== null && (existing.length === 0 || confirmNew);

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={handleBack}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-xl font-bold">Schedule Site Visit</h1>
      </div>

      {existing === null && (
        <p className="text-sm text-muted-foreground">Checking for existing site visits…</p>
      )}

      {existing !== null && existing.length > 0 && !confirmNew && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 sm:p-5 space-y-3">
          <div>
            <h2 className="text-base font-semibold text-amber-900">
              {existing.length === 1 ? 'A site visit already exists' : `${existing.length} site visits already exist`}
            </h2>
            <p className="text-sm text-amber-800 mt-1">
              This lead already has site visit work scheduled. Open the existing one to conduct or complete it —
              don't create a duplicate. Only schedule a new visit if this is a genuinely separate trip.
            </p>
          </div>
          <div className="space-y-2">
            {existing.map((v) => (
              <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{v.visitNumber || `Site Visit #${v.id}`}</p>
                  <p className="text-xs text-muted-foreground">
                    {[v.visitType, v.status, v.scheduledDate].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <Button size="sm" onClick={() => navigate(`/site-visits/${v.id}`)}>Open</Button>
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setConfirmNew(true)}>
              Schedule a new visit anyway
            </Button>
            <Button variant="ghost" size="sm" onClick={handleBack}>Cancel</Button>
          </div>
        </div>
      )}

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">Visit details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SelectField label="Visit Type" value={visitType} onChange={setVisitType} options={VISIT_TYPES} allowEmpty={false} />
              <TextField label="Scheduled Date" type="date" value={scheduledDate} onChange={setScheduledDate} />
            </div>
            <TextAreaField label="Purpose" value={purpose} onChange={setPurpose} rows={2} />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={create} disabled={busy}>{busy ? 'Scheduling…' : 'Schedule & Open Visit'}</Button>
              <Button variant="outline" onClick={() => navigate(`/leads/${leadId}?tab=sitevisits`)}>See lead's visits</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

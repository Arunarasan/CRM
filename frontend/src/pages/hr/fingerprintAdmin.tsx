/**
 * HR → employee profile: enrol fingerprints for the office kiosk. Inside the kiosk app the scans come
 * from the phone's sensor (lib/fingerprintBridge.ts); on a computer they come from a SecuGen scanner
 * plugged into it, through SecuGen WebAPI (lib/secugenWebApi.ts). Image files remain as a test aid.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Fingerprint, Loader2, Trash2, CheckCircle2, Upload } from 'lucide-react';
import { attendanceApi, FingerCapture, FingerprintStatus } from '@/api/attendanceApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { captureFingerprint, cancelFingerprint, fingerprintSensorAvailable, insideKioskApp, readFingerprintFiles } from '@/lib/fingerprintBridge';
import { captureSecugen, cancelSecugen, SECUGEN_WEBAPI_URL } from '@/lib/secugenWebApi';

const errText = (e: any, fallback = 'Action failed') => e?.response?.data?.message || e?.message || fallback;

/** ISO/IEC 19794-2 finger positions offered for enrolment. */
const FINGERS = [
  { value: 2, label: 'Right index' },
  { value: 1, label: 'Right thumb' },
  { value: 7, label: 'Left index' },
  { value: 6, label: 'Left thumb' },
];
const SCANS = 3;

const PROMPTS = ['Place the finger flat on the sensor', 'Lift it, then place the same finger again', 'One more time, same finger'];

export function FingerprintEnrollmentCard({ employeeId, canEdit }: { employeeId: number; canEdit: boolean }) {
  const [status, setStatus] = useState<FingerprintStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [finger, setFinger] = useState(2);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scanNo, setScanNo] = useState(0);
  const [error, setError] = useState('');
  const runRef = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    attendanceApi.fingerprintStatus(employeeId).then(setStatus).catch(() => setStatus(null)).finally(() => setLoading(false));
  }, [employeeId]);
  useEffect(load, [load]);
  useEffect(() => () => { runRef.current += 1; cancelFingerprint(); cancelSecugen(); }, []);

  const inApp = insideKioskApp();
  // The app opens the USB scanner (permission prompt, driver start) after this page has rendered, so
  // readiness has to be re-read; a one-off check left the button disabled for good.
  const [sensor, setSensor] = useState(fingerprintSensorAvailable);
  useEffect(() => {
    if (!inApp) return;
    const t = window.setInterval(() => setSensor(fingerprintSensorAvailable()), 1000);
    return () => window.clearInterval(t);
  }, [inApp]);
  // Outside the kiosk app the scanner is the SecuGen one on this PC; its state is only known on scan.
  const canScan = inApp ? sensor : true;
  const scan = inApp ? captureFingerprint : captureSecugen;

  const save = async (captures: FingerCapture[]) => {
    await attendanceApi.enrollFingerprint(employeeId, finger, { consent, captures });
    toast.success('Fingerprint enrolled');
    load();
  };

  const enrol = async () => {
    setError('');
    if (!consent) { setError('Tick the box to confirm the employee agrees to fingerprint enrolment.'); return; }
    const run = ++runRef.current;
    setBusy(true); setScanNo(0);
    try {
      const captures: FingerCapture[] = [];
      for (let i = 0; i < SCANS; i++) {
        setScanNo(i + 1);
        captures.push(await scan());
        if (run !== runRef.current) return;
      }
      await save(captures);
    } catch (e: any) {
      if (run === runRef.current) setError(errText(e, 'Could not enrol the fingerprint.'));
    } finally {
      if (run === runRef.current) { setBusy(false); setScanNo(0); }
    }
  };

  const enrolFromFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError('');
    if (!consent) { setError('Tick the box to confirm the employee agrees to fingerprint enrolment.'); return; }
    if (files.length < 2) { setError('Choose at least 2 images of the same finger.'); return; }
    setBusy(true);
    try { await save(await readFingerprintFiles(files)); }
    catch (e: any) { setError(errText(e, 'Could not enrol the fingerprint.')); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const removeOne = async (f: number, name: string) => {
    if (!window.confirm(`Remove the ${name.toLowerCase()} fingerprint?`)) return;
    try { await attendanceApi.removeFingerprint(employeeId, f); toast.success('Fingerprint removed'); load(); }
    catch (e: any) { toast.error(errText(e)); }
  };

  const removeAll = async () => {
    if (!window.confirm('Remove all fingerprint data for this employee? They will not be able to check in with a fingerprint until enrolled again.')) return;
    try { await attendanceApi.removeFingerprint(employeeId); toast.success('Fingerprint data removed'); load(); }
    catch (e: any) { toast.error(errText(e)); }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><Fingerprint className="h-4 w-4 text-primary" /> Fingerprint for kiosk check-in</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : status?.enrolled ? (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 font-medium text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Enrolled</p>
            <ul className="space-y-1">
              {status.fingers.map((f) => (
                <li key={f.finger} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-1.5">
                  <span>{f.name} <span className="text-xs text-muted-foreground">· {f.samples} scans</span></span>
                  {canEdit && <button onClick={() => removeOne(f.finger, f.name)} aria-label={`Remove ${f.name}`} className="text-red-600"><Trash2 className="h-4 w-4" /></button>}
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              {status.enrolledAt ? new Date(status.enrolledAt).toLocaleString() : ''}{status.enrolledBy ? ` · by ${status.enrolledBy}` : ''}
              {status.consentAt ? ' · consent recorded' : ''}
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground">Not enrolled. The employee cannot check in with a fingerprint yet.</p>
        )}

        {busy && scanNo > 0 && (
          <div className="rounded-xl bg-primary/5 p-3 text-center">
            <Loader2 className="mx-auto mb-1 h-5 w-5 animate-spin text-primary" />
            <p className="font-medium">Scan {scanNo} of {SCANS}</p>
            <p className="text-muted-foreground">{PROMPTS[scanNo - 1]}</p>
          </div>
        )}
        {busy && scanNo === 0 && <p className="text-muted-foreground"><Loader2 className="mr-1 inline h-4 w-4 animate-spin" />Saving…</p>}

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {canEdit && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <select className="h-9 rounded-md border border-input bg-card px-2 text-sm" value={finger} disabled={busy}
                onChange={(e) => setFinger(Number(e.target.value))} aria-label="Finger to enrol">
                {FINGERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
              <Button size="sm" onClick={enrol} disabled={busy || !canScan}>
                <Fingerprint className="h-4 w-4" /> {status?.fingers.some((f) => f.finger === finger) ? 'Re-enrol this finger' : 'Enrol finger'}
              </Button>
              {!inApp && (
                <>
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg" multiple hidden onChange={(e) => enrolFromFiles(e.target.files)} />
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
                    <Upload className="h-4 w-4" /> Test with image files
                  </Button>
                </>
              )}
            </div>
            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <input type="checkbox" className="mt-0.5 h-4 w-4" checked={consent} disabled={busy} onChange={(e) => setConsent(e.target.checked)} />
              <span>The employee has agreed to give their fingerprint for attendance. Only a numeric template is stored, never the image, and it is deleted when they leave.</span>
            </label>
            {inApp && !sensor && (
              <p className="text-xs text-muted-foreground">The fingerprint sensor is not connected. Plug it into the kiosk phone and allow access.</p>
            )}
            {!inApp && (
              <p className="text-xs text-muted-foreground">
                Scans with the SecuGen scanner plugged into this PC. Needs SecuGen WebAPI installed; the first time, open{' '}
                <a href={SECUGEN_WEBAPI_URL} target="_blank" rel="noreferrer" className="underline">{SECUGEN_WEBAPI_URL}</a> and allow it.
              </p>
            )}
          </div>
        )}
        {canEdit && status?.enrolled && !busy && (
          <Button size="sm" variant="ghost" className="text-red-600" onClick={removeAll}><Trash2 className="h-4 w-4" /> Remove all fingerprints</Button>
        )}
      </CardContent>
    </Card>
  );
}

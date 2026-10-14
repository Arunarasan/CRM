/**
 * HR → employee profile: enrol a face for the office kiosk. HR sits the employee in front of any
 * camera (the laptop, or the kiosk phone via the CRM), the page auto-captures a few samples while
 * the employee follows the prompts, and the server stores the descriptors. The camera and the
 * face models run entirely in the browser.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScanFace, Loader2, Camera, Trash2, CheckCircle2, RotateCcw } from 'lucide-react';
import { attendanceApi, FaceStatus } from '@/api/attendanceApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { uploadFile, resolveFileUrl } from '@/lib/uploadFile';
import { loadFaceEngine, scanFace, snapshot, startFrontCamera, stopCamera, FaceReading } from '@/lib/faceEngine';

const errText = (e: any, fallback = 'Action failed') => e?.response?.data?.message || e?.message || fallback;

/** One prompt per sample, so the samples cover a little pose variety. */
const PROMPTS = [
  'Look straight at the camera',
  'Look straight again',
  'Turn your head a little to the left',
  'Turn your head a little to the right',
  'Look straight and relax',
];
const SAMPLES = PROMPTS.length;
/** Pause between samples so the employee can change pose. */
const GAP_MS = 1400;
/** Face must fill at least this share of the frame width. */
const MIN_FACE_SHARE = 0.22;
const MIN_SCORE = 0.7;

type Phase = 'idle' | 'starting' | 'capturing' | 'saving';

export function FaceEnrollmentCard({ employeeId, canEdit }: { employeeId: number; canEdit: boolean }) {
  const [status, setStatus] = useState<FaceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>('idle');
  const [captured, setCaptured] = useState(0);
  const [hint, setHint] = useState('');
  const [error, setError] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const runRef = useRef(0); // bumped to cancel a running capture loop

  const load = useCallback(() => {
    setLoading(true);
    attendanceApi.faceStatus(employeeId).then(setStatus).catch(() => setStatus(null)).finally(() => setLoading(false));
  }, [employeeId]);
  useEffect(load, [load]);

  const stop = useCallback(() => {
    runRef.current += 1;
    stopCamera(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);
  useEffect(() => stop, [stop]); // release the camera when leaving the page

  const start = async () => {
    setError(''); setCaptured(0); setHint(''); setPhase('starting');
    const run = ++runRef.current;
    try {
      await loadFaceEngine(); // models first so the first frame is not wasted
      const video = videoRef.current;
      if (!video) throw new Error('Camera view is not ready.');
      streamRef.current = await startFrontCamera(video);
      if (run !== runRef.current) return;
      setPhase('capturing');
      await capture(run, video);
    } catch (e: any) {
      if (run === runRef.current) { setError(errText(e, 'Could not start face capture.')); stop(); setPhase('idle'); }
    }
  };

  const capture = async (run: number, video: HTMLVideoElement) => {
    const samples: FaceReading[] = [];
    let photo: Blob | null = null;
    let lastAt = 0;
    let prevCenter: { x: number; y: number } | null = null;

    while (run === runRef.current && samples.length < SAMPLES) {
      const scan = await scanFace(video);
      if (run !== runRef.current) return;
      if (scan.state === 'none') { setHint('No face found. Move into the frame.'); prevCenter = null; }
      else if (scan.state === 'multiple') { setHint('More than one face. Only the employee should be in view.'); prevCenter = null; }
      else {
        const r = scan.reading;
        const share = r.box.width / r.frameWidth;
        const center = { x: (r.box.x + r.box.width / 2) / r.frameWidth, y: (r.box.y + r.box.height / 2) / r.frameHeight };
        const steady = prevCenter != null && Math.hypot(center.x - prevCenter.x, center.y - prevCenter.y) < 0.05;
        prevCenter = center;
        if (share < MIN_FACE_SHARE) setHint('Come a little closer.');
        else if (r.score < MIN_SCORE) setHint('Face the camera in better light.');
        else if (Date.now() - lastAt < GAP_MS) setHint(PROMPTS[samples.length] ?? '');
        else if (!steady) setHint('Hold still…');
        else {
          if (samples.length === 0) photo = await snapshot(video);
          samples.push(r);
          lastAt = Date.now();
          setCaptured(samples.length);
          setHint(samples.length < SAMPLES ? PROMPTS[samples.length] : 'Got it. Saving…');
        }
      }
      await new Promise((res) => setTimeout(res, 250));
    }
    if (run !== runRef.current) return;

    stop();
    setPhase('saving');
    try {
      let photoUrl: string | undefined;
      if (photo) {
        try { photoUrl = (await uploadFile(new File([photo], 'face.jpg', { type: 'image/jpeg' }), 'FACE')).fileUrl; }
        catch { /* the photo is a nice-to-have; enrolment still works without it */ }
      }
      await attendanceApi.enrollFace(employeeId, {
        descriptors: samples.map((s) => s.descriptor),
        qualities: samples.map((s) => Math.round(s.score * 1000) / 1000),
        photoUrl,
      });
      toast.success('Face enrolled');
      load();
    } catch (e: any) {
      setError(errText(e, 'Could not save the face.'));
    } finally {
      setPhase('idle');
    }
  };

  const remove = async () => {
    if (!window.confirm('Remove this employee\'s face data? They will not be able to check in on the kiosk until enrolled again.')) return;
    try { await attendanceApi.removeFace(employeeId); toast.success('Face data removed'); load(); }
    catch (e: any) { toast.error(errText(e)); }
  };

  const active = phase !== 'idle';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><ScanFace className="h-4 w-4 text-primary" /> Face for kiosk check-in</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : status?.enrolled ? (
          <div className="flex items-center gap-3">
            {status.photoUrl
              ? <img src={resolveFileUrl(status.photoUrl)} alt="Enrolled face" className="h-14 w-14 rounded-lg object-cover" />
              : <CheckCircle2 className="h-6 w-6 text-emerald-600" />}
            <div>
              <p className="font-medium text-emerald-700">Enrolled · {status.samples} samples</p>
              <p className="text-xs text-muted-foreground">
                {status.enrolledAt ? new Date(status.enrolledAt).toLocaleString() : ''}{status.enrolledBy ? ` · by ${status.enrolledBy}` : ''}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">Not enrolled. The employee cannot check in on the office kiosk yet.</p>
        )}

        {/* The video stays mounted so the ref is ready when capture starts. */}
        <div className={active ? 'space-y-2' : 'hidden'}>
          <div className="relative mx-auto aspect-[4/3] w-full max-w-sm overflow-hidden rounded-xl bg-black">
            <video ref={videoRef} playsInline muted className="h-full w-full -scale-x-100 object-cover" />
            {phase === 'starting' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Starting camera…
              </div>
            )}
            {phase === 'saving' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Saving…
              </div>
            )}
          </div>
          <div className="mx-auto flex max-w-sm items-center justify-center gap-1.5">
            {PROMPTS.map((_, i) => (
              <span key={i} className={`h-2 w-8 rounded-full ${i < captured ? 'bg-emerald-500' : 'bg-muted'}`} />
            ))}
          </div>
          <p className="text-center text-sm font-medium">{hint || (phase === 'capturing' ? PROMPTS[0] : '')}</p>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {canEdit && (
          <div className="flex flex-wrap gap-2">
            {!active && (
              <Button size="sm" onClick={start}>
                {status?.enrolled ? <><RotateCcw className="h-4 w-4" /> Re-enrol face</> : <><Camera className="h-4 w-4" /> Enrol face</>}
              </Button>
            )}
            {active && phase !== 'saving' && (
              <Button size="sm" variant="outline" onClick={() => { stop(); setPhase('idle'); setHint(''); }}>Cancel</Button>
            )}
            {!active && status?.enrolled && (
              <Button size="sm" variant="ghost" className="text-red-600" onClick={remove}><Trash2 className="h-4 w-4" /> Remove</Button>
            )}
          </div>
        )}
        {!active && (
          <p className="text-xs text-muted-foreground">
            Takes about 10 seconds. The employee faces the camera while 5 samples are captured automatically. Only a numeric
            face signature and one reference photo are stored.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

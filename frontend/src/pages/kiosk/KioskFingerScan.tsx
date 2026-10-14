/**
 * One fingerprint check on the kiosk: waits for a finger on the external sensor (through the kiosk
 * app), takes a selfie from the front camera as audit evidence, and sends both to the server, which
 * identifies the employee and records the punch. The selfie is not matched, only stored.
 */
import { useEffect, useRef, useState } from 'react';
import { Fingerprint, X } from 'lucide-react';
import { kioskApi } from '@/lib/kioskApi';
import { snapshot, startFrontCamera, stopCamera } from '@/lib/faceEngine';
import { cancelFingerprint, captureFingerprint } from '@/lib/fingerprintBridge';
import type { ScanAction, ScanDone, ScanFail } from './KioskScan';

export default function KioskFingerScan({ action, onDone, onFail, onCancel, onSwitch }: {
  action: ScanAction;
  onDone: (d: ScanDone) => void;
  onFail: (f: ScanFail) => void;
  onCancel: () => void;
  /** Shown when the kiosk also accepts faces. */
  onSwitch?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hint, setHint] = useState('Place your finger on the sensor');
  const [sending, setSending] = useState(false);
  const doneRef = useRef(onDone);
  const failRef = useRef(onFail);
  doneRef.current = onDone;
  failRef.current = onFail;

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;

    const run = async () => {
      try {
        // Camera first (best effort): a selfie is only evidence, so the punch still works without one.
        try { if (videoRef.current) stream = await startFrontCamera(videoRef.current); } catch { stream = null; }
        if (cancelled) return;

        const capture = await captureFingerprint();
        if (cancelled) return;
        setSending(true); setHint('Checking…');
        const selfie = stream && videoRef.current ? await snapshot(videoRef.current, 0.8, 480) : null;
        stopCamera(stream); stream = null;
        try {
          const result = await kioskApi.punchFinger(action, capture, selfie);
          if (!cancelled) doneRef.current({ result, selfie });
        } catch (e: any) {
          if (cancelled) return;
          const status = e?.response?.status as number | undefined;
          failRef.current({
            status,
            message: e?.response?.data?.message || (status ? 'The server refused this check.' : 'Cannot reach the server. Check the internet and try again.'),
          });
        }
      } catch (e: any) {
        if (!cancelled) failRef.current({ message: e?.message || 'Could not read the fingerprint.' });
      }
    };
    run();
    return () => { cancelled = true; cancelFingerprint(); stopCamera(stream); };
  }, [action]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-emerald-950 text-white">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">{action === 'IN' ? 'Check In' : 'Check Out'}</span>
        <button onClick={onCancel} aria-label="Cancel" className="rounded-full bg-white/15 p-2"><X className="h-5 w-5" /></button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        <Fingerprint className={`h-32 w-32 ${sending ? 'animate-pulse text-emerald-300' : 'text-white/90'}`} />
        <p className="text-2xl font-bold">{hint}</p>
        {!sending && <p className="text-sm text-white/70">Press the finger flat and keep it still until it is read</p>}
        {/* The camera only takes the evidence selfie, so keep it small and out of the way. */}
        <video ref={videoRef} playsInline muted className="h-24 w-24 -scale-x-100 rounded-full object-cover opacity-80" />
      </div>

      {onSwitch && !sending && (
        <div className="px-4 pb-8 text-center">
          <button onClick={onSwitch} className="rounded-full bg-white/15 px-5 py-2 text-sm font-semibold">Use face instead</button>
        </div>
      )}
    </div>
  );
}

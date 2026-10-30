/**
 * Fallback when the face or fingerprint can't be read: the person types their employee ID or phone
 * number and the kiosk takes a photo. The server records it as a pending punch that an admin must
 * approve (they check the photo), so this never counts as attendance on its own.
 */
import { useEffect, useRef, useState } from 'react';
import { Loader2, X, Camera } from 'lucide-react';
import { kioskApi } from '@/lib/kioskApi';
import { attachWarmCamera, leaveCamera, snapshot } from '@/lib/faceEngine';
import type { ScanAction, ScanDone, ScanFail } from './KioskScan';

export default function KioskManual({ action, onDone, onFail, onCancel }: {
  action: ScanAction;
  onDone: (d: ScanDone) => void;
  onFail: (f: ScanFail) => void;
  onCancel: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [identifier, setIdentifier] = useState('');
  const [camOk, setCamOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const video = videoRef.current;
    if (video) {
      attachWarmCamera(video)
        .then((s) => { if (cancelled) leaveCamera(s, video); else { streamRef.current = s; setCamOk(true); } })
        .catch((e) => { if (!cancelled) setError(e?.message || 'Could not start the camera.'); });
    }
    return () => { cancelled = true; leaveCamera(streamRef.current, video); streamRef.current = null; };
  }, []);

  const submit = async () => {
    const video = videoRef.current;
    if (identifier.trim().length < 3) { setError('Enter your employee ID or phone number.'); return; }
    if (!video || !camOk) { setError('The camera is not ready.'); return; }
    setBusy(true); setError('');
    try {
      const selfie = await snapshot(video, 0.7, 480);
      if (!selfie) throw new Error('Could not take the photo. Try again.');
      const result = await kioskApi.punchManual(action, identifier.trim(), selfie);
      onDone({ result, selfie, manual: true });
    } catch (e: any) {
      const status = e?.response?.status as number | undefined;
      if (status === 401 || status === 403) { onFail({ status, message: e?.response?.data?.message || 'This kiosk must be paired again.' }); return; }
      setError(e?.response?.data?.message || e?.message || 'Could not send. Check the internet and try again.');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-emerald-950 text-white">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">{action === 'IN' ? 'Check In' : 'Check Out'} · ID + photo</span>
        <button onClick={onCancel} aria-label="Cancel" className="rounded-full bg-white/15 p-2"><X className="h-5 w-5" /></button>
      </div>

      <div className="flex flex-1 flex-col items-center gap-4 overflow-y-auto px-5 pb-6">
        <p className="text-center text-sm text-emerald-100">Type your employee ID or phone number, look at the camera and tap the button. An admin will approve it.</p>
        <input
          value={identifier} onChange={(e) => setIdentifier(e.target.value)}
          placeholder="Employee ID or phone number" autoComplete="off" autoCapitalize="characters"
          className="w-full max-w-sm rounded-xl bg-white px-4 py-3 text-center text-xl font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-emerald-400"
        />
        <div className="relative aspect-[3/4] w-full max-w-xs overflow-hidden rounded-2xl bg-black">
          <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full -scale-x-100 object-cover" />
        </div>
        {error && <p className="text-center text-sm font-semibold text-red-300">{error}</p>}
        <button onClick={submit} disabled={busy || !camOk}
          className="flex w-full max-w-sm items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-4 text-lg font-bold text-emerald-950 disabled:opacity-60">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />} Take photo &amp; send
        </button>
      </div>
    </div>
  );
}

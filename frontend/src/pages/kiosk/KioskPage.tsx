/**
 * Office kiosk screen (public route /kiosk). First visit: type the pairing code HR created. After
 * that the phone keeps its token and shows the kiosk home: a big Check In / Check Out choice. Tapping
 * one opens a face check (see KioskScan); the server identifies the person and records the punch,
 * and the result card shows who was recognised and what happened. The home screen pings the server
 * every 30 s so HR can see the kiosk is online and so a revoked token is noticed.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Tablet, LogIn, LogOut, CheckCircle2, AlertTriangle, XCircle, UserRound } from 'lucide-react';
import { kioskApi, kioskToken, KioskInfo, KioskPunchResult } from '@/lib/kioskApi';
import { keepCameraWarm, loadFaceEngine, releaseWarmCamera } from '@/lib/faceEngine';
import { fingerprintSensorAvailable } from '@/lib/fingerprintBridge';
import KioskScan, { ScanAction, ScanDone, ScanFail } from './KioskScan';
import KioskFingerScan from './KioskFingerScan';
import KioskManual from './KioskManual';

type Phase = 'loading' | 'unpaired' | 'ready';

const errText = (e: any, fallback: string) => e?.response?.data?.message || e?.message || fallback;

/** How long a result card stays up before the kiosk returns to the home screen. */
const RESULT_MS = 6000;

type View =
  | { kind: 'home' }
  | { kind: 'scan'; action: ScanAction; method: 'FACE' | 'FINGER' }
  | { kind: 'manual'; action: ScanAction }
  | { kind: 'result'; action: ScanAction; done: ScanDone }
  | { kind: 'error'; message: string; action?: ScanAction };

export default function KioskPage() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [kiosk, setKiosk] = useState<KioskInfo | null>(null);
  const [offline, setOffline] = useState(false);
  const [notice, setNotice] = useState('');
  const [view, setView] = useState<View>({ kind: 'home' });

  const unpair = useCallback((message: string) => {
    kioskToken.clear(); setKiosk(null); setView({ kind: 'home' });
    setNotice(message);
    setPhase('unpaired');
  }, []);

  const check = useCallback(async () => {
    if (!kioskToken.get()) { setPhase('unpaired'); return; }
    try {
      const info = await kioskApi.me();
      setKiosk(info); setOffline(false); setPhase('ready');
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 401 || status === 403) {
        unpair(errText(e, 'This kiosk was switched off or replaced. Pair it again.'));
      } else {
        setOffline(true); // network blip: stay on the home screen and retry
        setPhase((p) => (p === 'loading' ? 'ready' : p));
      }
    }
  }, [unpair]);

  useEffect(() => { check(); }, [check]);
  useEffect(() => {
    if (phase !== 'ready') return;
    const t = window.setInterval(check, 30000);
    return () => window.clearInterval(t);
  }, [phase, check]);

  // Warm up the face models while the kiosk sits idle so the first tap is instant.
  // The camera is kept running too (face kiosks only), so a tap does not wait for it to start.
  useEffect(() => {
    if (phase !== 'ready') return;
    loadFaceEngine().catch(() => {});
    if (kiosk?.verifyMode !== 'FINGER') keepCameraWarm().catch(() => {});
  }, [phase, kiosk?.verifyMode]);
  useEffect(() => () => releaseWarmCamera(), []);

  // Keep the screen awake; the browser drops the lock when the tab is hidden, so ask again on return.
  useEffect(() => {
    if (phase !== 'ready') return;
    let lock: { release: () => Promise<void> } | null = null;
    const ask = async () => {
      try { lock = await (navigator as any).wakeLock?.request('screen'); } catch { /* not supported / denied */ }
    };
    ask();
    const onVisible = () => { if (document.visibilityState === 'visible') ask(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { document.removeEventListener('visibilitychange', onVisible); lock?.release().catch(() => {}); };
  }, [phase]);

  // Result and error cards close themselves.
  useEffect(() => {
    if (view.kind !== 'result' && view.kind !== 'error') return;
    const failed = view.kind === 'error' || ['NOT_RECOGNISED', 'AMBIGUOUS', 'NOT_FOUND'].includes(view.done.result.outcome) || view.done.result.match === 'WEAK';
    const t = window.setTimeout(() => setView({ kind: 'home' }), failed ? RESULT_MS * 3 : RESULT_MS);
    return () => window.clearTimeout(t);
  }, [view]);

  const onFail = useCallback((f: ScanFail) => {
    if (f.status === 401 || f.status === 403) { unpair(f.message); return; }
    setView((v) => ({ kind: 'error', message: f.message, action: v.kind === 'scan' ? v.action : undefined }));
  }, [unpair]);

  if (phase === 'loading') {
    return <Shell><Loader2 className="h-8 w-8 animate-spin text-emerald-200" /></Shell>;
  }
  if (phase === 'unpaired') {
    return <Shell><PairForm notice={notice} onPaired={(info) => { setKiosk(info); setNotice(''); setPhase('ready'); }} /></Shell>;
  }
  return (
    <>
      <Shell>
        {view.kind === 'result' ? <ResultCard action={view.action} done={view.done} onClose={() => setView({ kind: 'home' })}
            onManual={() => setView({ kind: 'manual', action: view.action })} />
          : view.kind === 'error' ? <ErrorCard message={view.message} onClose={() => setView({ kind: 'home' })}
            onManual={view.action ? () => setView({ kind: 'manual', action: view.action! }) : undefined} />
          : <KioskHome kiosk={kiosk} offline={offline} onChoose={(action) => setView({ kind: 'scan', action, method: firstMethod(kiosk) })} />}
      </Shell>
      {view.kind === 'scan' && view.method === 'FACE' && (
        <KioskScan
          action={view.action}
          onCancel={() => setView({ kind: 'home' })}
          onFail={onFail}
          onDone={(done) => setView({ kind: 'result', action: view.action, done })}
          onSwitch={canSwitch(kiosk) ? () => setView({ kind: 'scan', action: view.action, method: 'FINGER' }) : undefined}
          onManual={() => setView({ kind: 'manual', action: view.action })}
        />
      )}
      {view.kind === 'scan' && view.method === 'FINGER' && (
        <KioskFingerScan
          action={view.action}
          onCancel={() => setView({ kind: 'home' })}
          onFail={onFail}
          onDone={(done) => setView({ kind: 'result', action: view.action, done })}
          onSwitch={kiosk?.verifyMode === 'EITHER' ? () => setView({ kind: 'scan', action: view.action, method: 'FACE' }) : undefined}
          onManual={() => setView({ kind: 'manual', action: view.action })}
        />
      )}
      {view.kind === 'manual' && (
        <KioskManual
          action={view.action}
          onCancel={() => setView({ kind: 'home' })}
          onFail={onFail}
          onDone={(done) => setView({ kind: 'result', action: view.action, done })}
        />
      )}
    </>
  );
}

/** Which check a tap starts: a FINGER-only kiosk uses the sensor, EITHER prefers it when it is connected. */
function firstMethod(kiosk: KioskInfo | null): 'FACE' | 'FINGER' {
  if (kiosk?.verifyMode === 'FINGER') return 'FINGER';
  if (kiosk?.verifyMode === 'EITHER' && fingerprintSensorAvailable()) return 'FINGER';
  return 'FACE';
}

/** The face screen offers "use fingerprint" only when the kiosk accepts it and the sensor is there. */
function canSwitch(kiosk: KioskInfo | null): boolean {
  return kiosk?.verifyMode === 'EITHER' && fingerprintSensorAvailable();
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-emerald-900 to-emerald-950 p-5 text-white">
      {children}
    </div>
  );
}

function PairForm({ onPaired, notice }: { onPaired: (k: KioskInfo) => void; notice: string }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.replace(/[\s-]/g, '').length < 8) { setError('Enter the 8-character code from HR.'); return; }
    setBusy(true); setError('');
    try {
      const { token, ...info } = await kioskApi.pair(code);
      kioskToken.set(token);
      onPaired(info);
    } catch (err: any) {
      setError(errText(err, 'Could not pair this phone.'));
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-6 text-slate-900 shadow-2xl">
      <div className="mb-4 flex items-center gap-2">
        <Tablet className="h-6 w-6 text-emerald-700" />
        <h1 className="text-lg font-bold">Set up this kiosk</h1>
      </div>
      <p className="mb-4 text-sm text-slate-600">
        In the CRM open <b>Workforce → Attendance → Setup</b>, add a kiosk, and type its pairing code here.
      </p>
      {notice && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</p>}
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="XXXX-XXXX"
        maxLength={9}
        autoFocus autoCapitalize="characters" autoComplete="off" spellCheck={false}
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-center font-mono text-2xl font-bold tracking-widest focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200"
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={busy}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 py-3 text-sm font-bold text-white disabled:opacity-60">
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} Pair this phone
      </button>
    </form>
  );
}

function KioskHome({ kiosk, offline, onChoose }: { kiosk: KioskInfo | null; offline: boolean; onChoose: (a: ScanAction) => void }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div className="w-full max-w-sm text-center">
      <p className="text-sm uppercase tracking-widest text-emerald-200">{kiosk?.officeLocationName ?? 'Office'}</p>
      <h1 className="mt-1 text-2xl font-bold">{kiosk?.name ?? 'Kiosk'}</h1>
      <p className="mt-6 font-mono text-5xl font-bold tabular-nums">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
      <p className="mt-1 text-sm text-emerald-100">{now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</p>

      <div className="mt-8 grid grid-cols-2 gap-3">
        <button onClick={() => onChoose('IN')}
          className="flex flex-col items-center gap-2 rounded-2xl bg-emerald-500 py-8 text-emerald-950 shadow-lg active:scale-[0.98]">
          <LogIn className="h-9 w-9" /><span className="text-lg font-bold">Check In</span>
        </button>
        <button onClick={() => onChoose('OUT')}
          className="flex flex-col items-center gap-2 rounded-2xl bg-white/90 py-8 text-emerald-950 shadow-lg active:scale-[0.98]">
          <LogOut className="h-9 w-9" /><span className="text-lg font-bold">Check Out</span>
        </button>
      </div>
      <p className="mt-4 text-xs text-emerald-200">{kiosk?.verifyMode === 'FINGER' ? 'Tap one, then place your finger on the sensor.' : 'Tap one, then look at the camera.'}</p>
      {offline && <p className="mt-3 rounded-lg bg-amber-400/20 px-3 py-2 text-xs text-amber-100">Can’t reach the server. Retrying…</p>}
    </div>
  );
}

function hm(t?: string | null): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const d = new Date(); d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function worked(mins?: number | null): string {
  if (mins == null) return '';
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}

function ResultCard({ action, done, onClose, onManual }: { action: ScanAction; done: ScanDone; onClose: () => void; onManual: () => void }) {
  const r: KioskPunchResult = done.result;
  const [photo, setPhoto] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);
  useEffect(() => {
    if (done.selfie) { urlRef.current = URL.createObjectURL(done.selfie); setPhoto(urlRef.current); }
    return () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); };
  }, [done.selfie]);

  const first = (r.name ?? '').split(' ')[0] || 'there';
  let tone: 'ok' | 'warn' | 'bad' = 'ok';
  let title = '';
  let detail = '';
  switch (r.outcome) {
    case 'CHECKED_IN': title = done.manual && r.needsApproval ? `Sent for approval, ${first}` : `Welcome, ${first}`; detail = `Checked in at ${hm(r.time)}`; break;
    case 'CHECKED_OUT': title = done.manual && r.needsApproval ? `Sent for approval, ${first}` : `Goodbye, ${first}`; detail = `Checked out at ${hm(r.time)}${r.minutesWorked != null ? ` · ${worked(r.minutesWorked)} this session` : ''}`; break;
    case 'ALREADY_IN': tone = 'warn'; title = `${first}, you're already checked in`; detail = `Since ${hm(r.time)}. Use Check Out when you leave.`; break;
    case 'NOT_IN': tone = 'warn'; title = `${first}, you're not checked in`; detail = 'Use Check In first.'; break;
    case 'TOO_SOON': tone = 'warn'; title = `${first}, you just checked in`; detail = `At ${hm(r.time)}. Wait a couple of minutes before checking out.`; break;
    case 'NOT_FOUND': tone = 'bad'; title = 'ID or phone not found'; detail = 'Check the number and try again, or ask HR.'; break;
    case 'AMBIGUOUS': tone = 'bad'; title = 'Could not tell who this is'; detail = 'Try again. If it keeps happening, ask HR.'; break;
    default: tone = 'bad'; title = 'Not recognised'; detail = 'Try again: face the camera in good light, or press your finger flat. If it keeps failing, ask HR to enrol you.'; break;
  }
  const Icon = tone === 'ok' ? CheckCircle2 : tone === 'warn' ? AlertTriangle : XCircle;
  const color = tone === 'ok' ? 'text-emerald-600' : tone === 'warn' ? 'text-amber-500' : 'text-red-600';

  return (
    <div role="button" tabIndex={0} onClick={onClose} className="w-full max-w-sm rounded-2xl bg-white p-6 text-center text-slate-900 shadow-2xl">
      {photo && tone !== 'bad'
        ? <img src={photo} alt="" className="mx-auto h-28 w-28 -scale-x-100 rounded-full object-cover ring-4 ring-emerald-100" />
        : <UserRound className="mx-auto h-16 w-16 text-slate-300" />}
      <Icon className={`mx-auto mt-4 h-10 w-10 ${color}`} />
      <p className="mt-2 text-xl font-bold">{title}</p>
      <p className="mt-1 text-sm text-slate-600">{detail}</p>
      {tone !== 'bad' && r.match === 'STRONG' && (
        <p className="mt-3 inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Strong match · no approval needed</p>
      )}
      {tone !== 'bad' && r.match === 'WEAK' && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <b>Weak match.</b> Recorded, but HR must approve this {action === 'IN' ? 'check-in' : 'check-out'}. Scan again within a minute and a clear match clears it.
        </p>
      )}
      {tone !== 'bad' && r.match === 'MANUAL_OK' && (
        <p className="mt-3 inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Photo matched your face · no approval needed</p>
      )}
      {tone !== 'bad' && r.match === 'MANUAL' && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Typed ID + photo, face not matched. HR will check the photo and approve this {action === 'IN' ? 'check-in' : 'check-out'}.</p>
      )}
      {r.employeeCode && <p className="mt-3 text-xs text-slate-400">{r.employeeCode}</p>}
      {tone === 'bad' && (
        <button onClick={(e) => { e.stopPropagation(); onManual(); }} className="mt-4 w-full rounded-xl bg-emerald-700 py-3 text-sm font-bold text-white">
          Use employee ID or phone + photo
        </button>
      )}
    </div>
  );
}

function ErrorCard({ message, onClose, onManual }: { message: string; onClose: () => void; onManual?: () => void }) {
  return (
    <div role="button" tabIndex={0} onClick={onClose} className="w-full max-w-sm rounded-2xl bg-white p-6 text-center text-slate-900 shadow-2xl">
      <XCircle className="mx-auto h-12 w-12 text-red-600" />
      <p className="mt-3 text-xl font-bold">Could not check you</p>
      <p className="mt-1 text-sm text-slate-600">{message}</p>
      {onManual && (
        <button onClick={(e) => { e.stopPropagation(); onManual(); }} className="mt-4 w-full rounded-xl bg-emerald-700 py-3 text-sm font-bold text-white">
          Use employee ID or phone + photo
        </button>
      )}
      <p className="mt-4 text-xs text-slate-400">Tap to go back</p>
    </div>
  );
}

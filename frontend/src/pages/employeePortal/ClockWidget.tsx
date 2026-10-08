import { useCallback, useEffect, useRef, useState } from 'react';
import { LogIn, LogOut, Coffee, Play, Loader2, TrendingUp, ArrowRight, MapPin, ShieldCheck, ShieldAlert, Fingerprint, X, Clock3 } from 'lucide-react';
import { employeePortalApi } from '@/api/employeePortalApi';
import { TimeStatus } from '@/types/employeePortal';
import { assert as webauthnAssert } from '@/lib/webauthn';
import { getBestPosition } from '@/lib/geo';
import { inr } from './_shared';
import { useDeviceBinding, PhoneStatusStrip, errMsg } from './phoneBinding';

/**
 * Self-service time-clock — the money-forward hero of the employee home screen.
 *
 * Leads with today's live earnings and a big HH:MM:SS worked-time timer that ticks every second
 * while the employee is clocked in and not on break. Earnings, hourly rate and the daily target
 * come from the server — the client only projects the running portion forward from the last sync
 * (re-syncing on every clock action) so the numbers "boost the mind" without drifting from payroll.
 */
export default function ClockWidget({ onChange }: { onChange?: () => void }) {
  const [status, setStatus] = useState<TimeStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  // Fingerprint-machine staff: a phone punch is a "field punch" — ask where they are first.
  const [fieldMode, setFieldMode] = useState<'in' | 'out' | null>(null);
  const [fieldNote, setFieldNote] = useState('');
  const [geoAccuracy, setGeoAccuracy] = useState<number | null>(null); // live best-fix accuracy while locating
  const [, forceTick] = useState(0);
  const tickRef = useRef<number | null>(null);
  // Wall-clock instant of the last server sync — the running timer/earnings project forward from here.
  const syncAtRef = useRef<number>(Date.now());

  const load = useCallback(() => {
    employeePortalApi.timeStatus().then((s) => { syncAtRef.current = Date.now(); setStatus(s); }).catch(() => setStatus(null));
  }, []);
  useEffect(() => { load(); }, [load]);

  // Phone binding — only loaded once the server says it's enforced for this employee.
  const bindingMode = status?.deviceBindingMode ?? 'OFF';
  const phone = useDeviceBinding(!!status && bindingMode !== 'OFF');
  // HARD mode: clock actions only work from the approved phone (server refuses otherwise).
  const phoneBlocked = bindingMode === 'HARD' && phone.phoneState !== 'ACTIVE' && phone.phoneState !== 'LOADING';

  const clockedIn = status?.clockedIn ?? false;
  const onBreak = status?.onBreak ?? false;
  const running = clockedIn && !onBreak;

  // Local 1s tick so the running clock + earnings feel live between server syncs.
  useEffect(() => {
    if (running) {
      tickRef.current = window.setInterval(() => forceTick((n) => n + 1), 1000);
      return () => { if (tickRef.current) window.clearInterval(tickRef.current); };
    }
  }, [running]);

  const act = async (label: string, fn: () => Promise<unknown>) => {
    setError(''); setBusy(label);
    try { await fn(); load(); phone.refresh(); onChange?.(); }
    catch (e: any) { setError(errMsg(e, 'Action failed')); load(); }
    finally { setBusy(null); }
  };

  const sessions = status?.sessions ?? [];
  const sessionCount = status?.sessionsToday ?? 0;
  const lastSession = sessions.length > 0 ? sessions[sessions.length - 1] : null;
  const isMachine = status?.attendanceMethod === 'MACHINE';
  const pendingHours = status?.todayPendingHours ?? 0;

  // Clock in with the device's best available location (samples GPS for a few seconds to converge)
  // plus, when the employee's method is office-device / either and a credential is registered, a
  // WebAuthn biometric assertion. Both are best-effort — a denied fix or cancelled biometric still
  // clocks in; the server flags it.
  const clockInWithGeo = async () => {
    setGeoAccuracy(null);
    const geo = await getBestPosition({ onProgress: (f) => setGeoAccuracy(Math.round(f.accuracy)) });
    const deviceInfo = typeof navigator !== 'undefined' ? navigator.userAgent?.slice(0, 250) : undefined;

    const method = status?.attendanceMethod ?? 'GEO';
    const wantsBiometric = (method === 'OFFICE_DEVICE' || method === 'ANY') && !!status?.biometricRegistered;
    let assertion;
    if (wantsBiometric) {
      try {
        const options = await employeePortalApi.webauthnAssertOptions();
        assertion = (await webauthnAssert(options)) ?? undefined;
      } catch {
        assertion = undefined; // fall through — server records it unverified / flagged
      }
    }
    // First phone: register it silently on the first clock-in (the server auto-approves it).
    if (phone.phoneState === 'NONE') {
      try { await phone.bind(); } catch { /* fall through — the punch is recorded and flagged */ }
    }
    // Sign the challenge last so it's fresh after the GPS/biometric steps.
    const device = phone.phoneState === 'OFF' ? undefined : await phone.proof();
    await employeePortalApi.clockIn({
      lat: geo?.lat, lng: geo?.lng,
      accuracyMeters: geo?.accuracy != null ? Math.round(geo.accuracy) : undefined,
      deviceInfo, assertion, device,
      note: isMachine ? fieldNote.trim() || undefined : undefined,
    });
  };

  // Machine staff clocking out on the phone share where they are (the admin sees it when approving).
  const clockOutWithDevice = async () => {
    let geo: Awaited<ReturnType<typeof getBestPosition>> | null = null;
    if (isMachine) geo = await getBestPosition({ onProgress: (f) => setGeoAccuracy(Math.round(f.accuracy)) });
    const device = phone.phoneState === 'OFF' ? undefined : await phone.proof();
    await employeePortalApi.clockOut({
      device,
      lat: geo?.lat, lng: geo?.lng,
      accuracyMeters: geo?.accuracy != null ? Math.round(geo.accuracy) : undefined,
      note: isMachine ? fieldNote.trim() || undefined : undefined,
    });
  };

  const runField = (mode: 'in' | 'out') => act(mode, async () => {
    await (mode === 'in' ? clockInWithGeo() : clockOutWithDevice());
    setFieldMode(null);
    setFieldNote('');
  });

  // Seconds worked so far today = server total (all sessions) + time elapsed since the last sync
  // while running. todayHours already sums closed + open sessions up to the sync instant.
  const elapsed = running ? Math.max(0, Math.floor((Date.now() - syncAtRef.current) / 1000)) : 0;
  const liveSeconds = Math.round((status?.todayHours ?? 0) * 3600) + elapsed;
  const rate = status?.hourlyRate ?? 0;
  const liveEarnings = (status?.todayEarnings ?? 0) + (running ? (elapsed / 3600) * rate : 0);

  const target = status?.dailyTargetEarnings ?? 0;
  const pct = target > 0 ? Math.min(100, Math.round((liveEarnings / target) * 100)) : 0;
  const remaining = Math.max(0, target - liveEarnings);

  return (
    <div className="overflow-hidden rounded-2xl border bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-700 text-white shadow-md">
      {/* Money hero */}
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-100/90">You've earned today</p>
            <p className="mt-0.5 text-4xl font-extrabold leading-none tabular-nums drop-shadow-sm">{inr(liveEarnings)}</p>
          </div>
          <span className={`mt-1 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            onBreak ? 'bg-amber-400/25 text-amber-50' : clockedIn ? 'bg-white/20 text-white' : 'bg-white/15 text-emerald-50'
          }`}>
            <span className={`h-2 w-2 rounded-full ${onBreak ? 'bg-amber-300' : clockedIn ? 'animate-pulse bg-emerald-200' : 'bg-emerald-100/70'}`} />
            {onBreak ? 'On break' : clockedIn ? 'Working' : sessionCount > 0 ? 'Clocked out' : 'Not started'}
          </span>
        </div>

        {/* Big live worked-time timer */}
        <div className="mt-3 flex items-baseline gap-2">
          <span className="font-mono text-3xl font-bold tabular-nums tracking-tight">{fmtHMS(liveSeconds)}</span>
          <span className="text-xs text-emerald-100/80">worked{status && status.todayOvertime > 0 ? ` · ${status.todayOvertime}h OT` : ''}</span>
        </div>
        {pendingHours > 0 && (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-100">
            <Clock3 className="h-3 w-3" /> +{pendingHours}h waiting for admin approval (not counted yet)
          </p>
        )}

        {/* Progress toward the day's target — the motivational bar */}
        {target > 0 && (
          <div className="mt-3">
            <div className="h-2 w-full overflow-hidden rounded-full bg-black/20">
              <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-yellow-200 transition-all duration-700" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1.5 flex items-center gap-1 text-[11px] text-emerald-50/90">
              <TrendingUp className="h-3 w-3" />
              {remaining > 0
                ? <>Earn <b className="text-white">{inr(remaining)}</b> more to hit today's <b className="text-white">{inr(target)}</b> target</>
                : <>🎉 You smashed today's <b className="text-white">{inr(target)}</b> target!</>}
            </p>
          </div>
        )}

        {/* Login / Logout times */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white/10 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-emerald-100/80">Log in time</p>
            <p className="text-sm font-bold tabular-nums">{fmtClock(status?.checkInTime)}</p>
          </div>
          <div className="rounded-xl bg-white/10 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-emerald-100/80">Log out time</p>
            <p className="text-sm font-bold tabular-nums">{clockedIn ? '—' : fmtClock(status?.checkOutTime)}</p>
          </div>
        </div>

        {error && <p className="mt-2 rounded-md bg-black/25 p-2 text-xs text-amber-100">{error}</p>}

        {/* Verification result of the latest session */}
        {lastSession?.approvalStatus === 'REJECTED' ? (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-500/25 px-3 py-2 text-[12px] text-red-50">
            <X className="mt-0.5 h-4 w-4 shrink-0 text-red-200" />
            <span><b>Not approved.</b> {lastSession.approvalNote || 'This punch won\'t be counted.'}</span>
          </div>
        ) : lastSession?.approvalStatus === 'APPROVED' ? (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-[12px] text-emerald-50">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-200" />
            <span>Approved by admin.</span>
          </div>
        ) : lastSession?.flagged ? (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-400/20 px-3 py-2 text-[12px] text-amber-50">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
            <span><b>Sent for approval.</b> {lastSession.flagReason || 'Attendance could not be auto-verified.'}</span>
          </div>
        ) : lastSession?.verified && lastSession.verificationMethod === 'MACHINE' ? (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-[12px] text-emerald-50">
            <Fingerprint className="h-4 w-4 shrink-0 text-emerald-200" />
            <span>Punched on the fingerprint machine.</span>
          </div>
        ) : lastSession?.verified && (lastSession.verificationMethod === 'GEO' || lastSession.verificationMethod === 'BIOMETRIC') ? (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-[12px] text-emerald-50">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-200" />
            <span>{lastSession.verificationMethod === 'BIOMETRIC' ? 'Biometric verified.' : 'Location verified.'}</span>
          </div>
        ) : !clockedIn && sessionCount === 0 && !isMachine ? (
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-emerald-100/80">
            <MapPin className="h-3 w-3" /> Your location is checked when you clock in.
          </p>
        ) : null}

        {isMachine && !fieldMode && (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-white/10 px-3 py-2 text-[12px] text-emerald-50">
            <Fingerprint className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200" />
            <span>
              {clockedIn && lastSession?.checkInSource === 'MACHINE'
                ? <>You're clocked in on the fingerprint machine — punch out there when you leave. Going to a site instead? Clock out here (needs approval).</>
                : <>In the office? <b>Punch on the fingerprint machine</b> — it shows here automatically. Working outside? Use a field punch below (an admin approves it).</>}
            </span>
          </div>
        )}

        {fieldMode && (
          <div className="mt-3 rounded-xl bg-white/15 p-3 text-[12px]">
            <p className="mb-1.5 font-semibold">{fieldMode === 'in' ? 'Field clock in' : 'Clock out from phone'} — needs admin approval</p>
            <input value={fieldNote} onChange={(e) => setFieldNote(e.target.value)} maxLength={200} autoFocus
              placeholder={fieldMode === 'in' ? 'Where are you? e.g. Site: Anna Nagar client' : 'Note (optional), e.g. Finished at site'}
              className="w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
            <p className="mt-1 text-emerald-50/80">Your location is shared with the admin.</p>
            <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
              <button onClick={() => runField(fieldMode)} disabled={!!busy || phoneBlocked || (fieldMode === 'in' && !fieldNote.trim())}
                className="flex items-center justify-center gap-2 rounded-lg bg-white py-2.5 text-sm font-bold text-emerald-700 disabled:opacity-60">
                {busy === fieldMode
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Locating…{geoAccuracy != null ? ` ±${geoAccuracy}m` : ''}</>
                  : fieldMode === 'in' ? <><LogIn className="h-4 w-4" /> Send field clock in</> : <><LogOut className="h-4 w-4" /> Send clock out</>}
              </button>
              <button onClick={() => { setFieldMode(null); setFieldNote(''); }} disabled={!!busy}
                className="rounded-lg bg-black/20 px-3 text-sm font-semibold text-white">Cancel</button>
            </div>
          </div>
        )}

        <PhoneStatusStrip binding={phone} />

        {/* Actions */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {!clockedIn && !fieldMode && (
            <button onClick={() => (isMachine ? setFieldMode('in') : act('in', clockInWithGeo))} disabled={!!busy || phoneBlocked}
              className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-bold text-emerald-700 shadow-sm active:scale-[0.99] disabled:opacity-60">
              {busy === 'in'
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Locating…{geoAccuracy != null ? ` ±${geoAccuracy}m` : ''}</>
                : <><LogIn className="h-4 w-4" /> {isMachine ? 'Field clock in' : sessionCount > 0 ? 'Clock In Again' : 'Clock In'}</>}
            </button>
          )}
          {clockedIn && !onBreak && !fieldMode && (
            <button onClick={() => act('break', () => employeePortalApi.startBreak())} disabled={!!busy}
              className="flex items-center justify-center gap-2 rounded-xl bg-amber-400 py-3 text-sm font-bold text-amber-950 active:scale-[0.99] disabled:opacity-60">
              {busy === 'break' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coffee className="h-4 w-4" />} Take Break
            </button>
          )}
          {clockedIn && onBreak && !fieldMode && (
            <button onClick={() => act('resume', () => employeePortalApi.endBreak())} disabled={!!busy}
              className="flex items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-bold text-emerald-700 active:scale-[0.99] disabled:opacity-60">
              {busy === 'resume' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} End Break
            </button>
          )}
          {clockedIn && !fieldMode && (
            <button onClick={() => (isMachine ? setFieldMode('out') : act('out', clockOutWithDevice))} disabled={!!busy || phoneBlocked}
              className="flex items-center justify-center gap-2 rounded-xl bg-black/30 py-3 text-sm font-bold text-white active:scale-[0.99] disabled:opacity-60">
              {busy === 'out' ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />} Clock Out
            </button>
          )}
        </div>
      </div>

      {/* Earnings footer + today's sessions — on a light panel for readability */}
      <div className="rounded-t-2xl bg-card p-3 text-foreground">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div><p className="text-sm font-bold tabular-nums">{inr(status?.weekEarnings)}</p><p className="text-[10px] uppercase text-muted-foreground">This week</p></div>
          <div><p className="text-sm font-bold tabular-nums">{inr(status?.monthEarnings)}</p><p className="text-[10px] uppercase text-muted-foreground">This month</p></div>
          <div><p className="text-sm font-bold tabular-nums">{rate ? `${inr(rate)}` : '—'}</p><p className="text-[10px] uppercase text-muted-foreground">Per hour</p></div>
        </div>

        {sessions.length > 0 && (
          <div className="mt-3 border-t pt-2">
            <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Today's sessions ({sessionCount})
            </p>
            <div className="space-y-1">
              {sessions.map((s, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-muted/50 px-2.5 py-1.5 text-xs">
                  <span className="flex items-center gap-1.5 font-medium tabular-nums">
                    {fmtClock(s.checkInTime)}
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    {s.running
                      ? <span className={s.onBreak ? 'text-amber-600' : 'text-emerald-600'}>{s.onBreak ? 'on break' : 'now'}</span>
                      : fmtClock(s.checkOutTime)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {s.breakMinutes > 0 && <span className="text-[11px] text-muted-foreground">{s.breakMinutes}m break</span>}
                    {s.checkInSource === 'MACHINE' && <Fingerprint className="h-3.5 w-3.5 text-emerald-600" aria-label="Fingerprint machine" />}
                    {s.approvalStatus === 'PENDING' && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Waiting</span>}
                    {s.approvalStatus === 'APPROVED' && <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">Approved</span>}
                    {s.approvalStatus === 'REJECTED' && (
                      <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700" title={s.approvalNote ?? undefined}>Rejected</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Total seconds → HH:MM:SS (zero-padded). */
function fmtHMS(total: number): string {
  const s = Math.max(0, total);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

/** Server time string ("HH:mm:ss") → "HH:mm" for display; null → em-dash. */
function fmtClock(t: string | null | undefined): string {
  if (!t) return '—';
  return t.length >= 5 ? t.slice(0, 5) : t;
}

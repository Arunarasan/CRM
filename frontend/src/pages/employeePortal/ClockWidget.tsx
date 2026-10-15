import { useCallback, useEffect, useRef, useState } from 'react';
import { LogIn, LogOut, Coffee, Play, Loader2, TrendingUp, ArrowRight, MapPin, ShieldCheck, ShieldAlert, X, Clock3, ChevronDown } from 'lucide-react';
import { employeePortalApi } from '@/api/employeePortalApi';
import { TimeStatus } from '@/types/employeePortal';
import { assert as webauthnAssert } from '@/lib/webauthn';
import { getBestPosition } from '@/lib/geo';
import { inr } from './_shared';
import { getCurrentUser } from '@/lib/currentUser';
import { useDeviceBinding, PhoneStatusStrip, errMsg } from './phoneBinding';
import { useT } from '@/i18n';

/**
 * Self-service time-clock — the money-forward hero of the employee home screen.
 *
 * Leads with today's live earnings and a big HH:MM:SS worked-time timer that ticks every second
 * while the employee is clocked in and not on break. Earnings, hourly rate and the daily target
 * come from the server — the client only projects the running portion forward from the last sync
 * (re-syncing on every clock action) so the numbers "boost the mind" without drifting from payroll.
 */
export default function ClockWidget({ onChange }: { onChange?: () => void }) {
  const { t } = useT();
  // Seed from the last known server status (same user, same day) so reopening the app shows the
  // running timer/earnings immediately instead of flashing 00:00:00 / ₹0 / "Clock In" until the
  // network answers. The server response then replaces it.
  const cached = useRef(readCache()).current;
  const [status, setStatus] = useState<TimeStatus | null>(cached?.status ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [geoAccuracy, setGeoAccuracy] = useState<number | null>(null); // live best-fix accuracy while locating
  const [, forceTick] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const tickRef = useRef<number | null>(null);
  // Wall-clock instant of the last server sync — the running timer/earnings project forward from here.
  const syncAtRef = useRef<number>(cached?.at ?? Date.now());

  const load = useCallback(() => {
    const sent = Date.now();
    employeePortalApi.timeStatus()
      .then((s) => {
        // The server computed the figures about halfway through the round trip, so anchor there —
        // otherwise every sync would lose the network latency from the running timer.
        const now = Date.now();
        syncAtRef.current = now - Math.round((now - sent) / 2);
        setStatus(s); writeCache(s, syncAtRef.current);
      })
      .catch(() => { /* keep the last known status — a failed refresh must never look like a reset */ });
  }, []);
  useEffect(() => { load(); }, [load]);

  // Re-sync whenever the app comes back to the foreground (PWA resume, tab switch).
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => { document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('focus', onVisible); };
  }, [load]);

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
    catch (e: any) { setError(errMsg(e, t('pw.clock.actionFailed'))); load(); }
    finally { setBusy(null); }
  };

  const sessions = status?.sessions ?? [];
  const sessionCount = status?.sessionsToday ?? 0;
  const lastSession = sessions.length > 0 ? sessions[sessions.length - 1] : null;
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
    });
  };

  const clockOutWithDevice = async () => {
    const device = phone.phoneState === 'OFF' ? undefined : await phone.proof();
    await employeePortalApi.clockOut({ device });
  };

  // Seconds worked so far today = server total (all sessions) + time elapsed since the last sync
  // while running. todayHours already sums closed + open sessions up to the sync instant.
  const elapsed = running ? Math.max(0, Math.floor((Date.now() - syncAtRef.current) / 1000)) : 0;
  const liveSeconds = Math.round((status?.todayHours ?? 0) * 3600) + elapsed;
  const rate = status?.hourlyRate ?? 0;
  const liveEarnings = (status?.todayEarnings ?? 0) + (running ? (elapsed / 3600) * rate : 0);

  const target = status?.dailyTargetEarnings ?? 0;
  const pct = target > 0 ? Math.min(100, Math.round((liveEarnings / target) * 100)) : 0;
  const remaining = Math.max(0, target - liveEarnings);

  const statusLabel = onBreak ? t('pw.clock.onBreak') : clockedIn ? t('pw.clock.working') : sessionCount > 0 ? t('pw.clock.clockedOut') : t('pw.clock.notStarted');
  const needsAttention = lastSession?.approvalStatus === 'REJECTED' || (lastSession?.flagged && lastSession.approvalStatus !== 'APPROVED');

  return (
    <div className="overflow-hidden rounded-2xl border bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-700 text-white shadow-md">
      <div className="p-4">
        {/* Status + live timer */}
        <div className="flex items-center justify-between gap-3">
          <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            onBreak ? 'bg-amber-400/25 text-amber-50' : clockedIn ? 'bg-white/20 text-white' : 'bg-white/15 text-emerald-50'
          }`}>
            <span className={`h-2 w-2 rounded-full ${onBreak ? 'bg-amber-300' : clockedIn ? 'animate-pulse bg-emerald-200' : 'bg-emerald-100/70'}`} />
            {statusLabel}
          </span>
          <span className="font-mono text-2xl font-bold tabular-nums tracking-tight">{fmtHMS(liveSeconds)}</span>
        </div>

        {/* Earned today — the one number that matters */}
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-100/90">{t('pw.clock.earnedToday')}</p>
            <p className="mt-0.5 text-3xl font-extrabold leading-none tabular-nums">{inr(liveEarnings)}</p>
          </div>
          {status?.checkInTime && (
            <p className="text-right text-[11px] text-emerald-100/85">
              {t('pw.clock.logIn')}<br /><b className="text-sm tabular-nums text-white">{fmtClock(status.checkInTime)}</b>
            </p>
          )}
        </div>

        {target > 0 && (
          <div className="mt-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/20">
              <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-yellow-200 transition-all duration-700" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1.5 flex items-center gap-1 text-[11px] text-emerald-50/90">
              <TrendingUp className="h-3 w-3" />
              {remaining > 0
                ? <b className="font-semibold text-white">{t('pw.clock.earnMore', { amount: inr(remaining), target: inr(target) })}</b>
                : <b className="font-semibold text-white">{t('pw.clock.smashed', { target: inr(target) })}</b>}
            </p>
          </div>
        )}

        {error && <p className="mt-3 rounded-md bg-black/25 p-2 text-xs text-amber-100">{error}</p>}

        {/* Only what needs attention stays on the card; routine verification is under Details */}
        {lastSession?.approvalStatus === 'REJECTED' ? (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-500/25 px-3 py-2 text-[12px] text-red-50">
            <X className="mt-0.5 h-4 w-4 shrink-0 text-red-200" />
            <span><b>{t('pw.clock.notApproved')}</b> {lastSession.approvalNote || t('pw.clock.notCounted')}</span>
          </div>
        ) : needsAttention ? (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-400/20 px-3 py-2 text-[12px] text-amber-50">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
            <span><b>{t('pw.clock.sentForApproval')}</b> {lastSession?.flagReason || t('pw.clock.notAutoVerified')}</span>
          </div>
        ) : null}

        <PhoneStatusStrip binding={phone} />

        {/* Actions */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {!clockedIn && (
            <button onClick={() => act('in', clockInWithGeo)} disabled={!!busy || phoneBlocked || !status}
              className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-bold text-emerald-700 shadow-sm active:scale-[0.99] disabled:opacity-60">
              {busy === 'in'
                ? <><Loader2 className="h-4 w-4 animate-spin" /> {t('pw.clock.locating')}{geoAccuracy != null ? ` ±${geoAccuracy}m` : ''}</>
                : <><LogIn className="h-4 w-4" /> {sessionCount > 0 ? t('pw.clock.clockInAgain') : t('pw.clock.clockIn')}</>}
            </button>
          )}
          {clockedIn && !onBreak && (
            <button onClick={() => act('break', () => employeePortalApi.startBreak())} disabled={!!busy}
              className="flex items-center justify-center gap-2 rounded-xl bg-amber-400 py-3 text-sm font-bold text-amber-950 active:scale-[0.99] disabled:opacity-60">
              {busy === 'break' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coffee className="h-4 w-4" />} {t('pw.clock.takeBreak')}
            </button>
          )}
          {clockedIn && onBreak && (
            <button onClick={() => act('resume', () => employeePortalApi.endBreak())} disabled={!!busy}
              className="flex items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-bold text-emerald-700 active:scale-[0.99] disabled:opacity-60">
              {busy === 'resume' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} {t('pw.clock.endBreak')}
            </button>
          )}
          {clockedIn && (
            <button onClick={() => act('out', clockOutWithDevice)} disabled={!!busy || phoneBlocked}
              className="flex items-center justify-center gap-2 rounded-xl bg-black/30 py-3 text-sm font-bold text-white active:scale-[0.99] disabled:opacity-60">
              {busy === 'out' ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />} {t('pw.clock.clockOut')}
            </button>
          )}
        </div>
      </div>

      {/* Details toggle + panel — on a light surface for readability */}
      <div className="bg-card text-foreground">
        <button
          onClick={() => setShowDetails((o) => !o)}
          aria-expanded={showDetails}
          className="flex w-full items-center justify-between px-4 py-3 text-[13px] font-semibold text-[#4B524E] active:bg-muted/50"
        >
          <span className="flex items-center gap-2">
            {t('pw.clock.details')}
            {pendingHours > 0 && <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700"><Clock3 className="h-3 w-3" />{t('pw.clock.pendingApproval', { h: pendingHours })}</span>}
          </span>
          <ChevronDown className={`h-4 w-4 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
        </button>
        {showDetails && (
          <div className="border-t px-3 pb-3 pt-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-muted/50 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('pw.clock.logIn')}</p>
                <p className="text-sm font-bold tabular-nums">{fmtClock(status?.checkInTime)}</p>
              </div>
              <div className="rounded-xl bg-muted/50 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('pw.clock.logOut')}</p>
                <p className="text-sm font-bold tabular-nums">{clockedIn ? '—' : fmtClock(status?.checkOutTime)}</p>
              </div>
            </div>
            {status && status.todayOvertime > 0 && (
              <p className="mt-2 text-[12px] text-muted-foreground">{t('pw.clock.otHours', { h: status.todayOvertime })}</p>
            )}
            {!needsAttention && (
              <p className="mt-2 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                {lastSession?.approvalStatus === 'APPROVED' || lastSession?.verified
                  ? <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  : <MapPin className="h-3.5 w-3.5" />}
                {lastSession?.approvalStatus === 'APPROVED'
                  ? t('pw.clock.approvedByAdmin')
                  : lastSession?.verified && (lastSession.verificationMethod === 'GEO' || lastSession.verificationMethod === 'BIOMETRIC')
                    ? (lastSession.verificationMethod === 'BIOMETRIC' ? t('pw.clock.biometricVerified') : t('pw.clock.locationVerified'))
                    : t('pw.clock.locationChecked')}
              </p>
            )}
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div><p className="text-sm font-bold tabular-nums">{inr(status?.weekEarnings)}</p><p className="text-[10px] uppercase text-muted-foreground">{t('pw.clock.thisWeek')}</p></div>
              <div><p className="text-sm font-bold tabular-nums">{inr(status?.monthEarnings)}</p><p className="text-[10px] uppercase text-muted-foreground">{t('pw.clock.thisMonth')}</p></div>
              <div><p className="text-sm font-bold tabular-nums">{rate ? `${inr(rate)}` : '—'}</p><p className="text-[10px] uppercase text-muted-foreground">{t('pw.clock.perHour')}</p></div>
            </div>
            {sessions.length > 0 && (
              <div className="mt-3 border-t pt-2">
                <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('pw.clock.todaysSessions', { count: sessionCount })}
                </p>
                <div className="space-y-1">
                  {sessions.map((s, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-muted/50 px-2.5 py-1.5 text-xs">
                      <span className="flex items-center gap-1.5 font-medium tabular-nums">
                        {fmtClock(s.checkInTime)}
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        {s.running
                          ? <span className={s.onBreak ? 'text-amber-600' : 'text-emerald-600'}>{s.onBreak ? t('pw.clock.onBreak') : t('pw.clock.now')}</span>
                          : fmtClock(s.checkOutTime)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        {s.breakMinutes > 0 && <span className="text-[11px] text-muted-foreground">{t('pw.clock.breakMin', { m: s.breakMinutes })}</span>}
                        {s.approvalStatus === 'PENDING' && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">{t('pw.clock.waiting')}</span>}
                        {s.approvalStatus === 'APPROVED' && <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">{t('pw.clock.approved')}</span>}
                        {s.approvalStatus === 'REJECTED' && (
                          <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700" title={s.approvalNote ?? undefined}>{t('pw.clock.rejected')}</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const CACHE_KEY = 'clockStatusCache';

function cacheOwner(): string {
  return getCurrentUser().name;
}

/** Last server status for this user, only if saved today (a stale day would show wrong totals). */
function readCache(): { status: TimeStatus; at: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (c.owner !== cacheOwner() || new Date(c.at).toDateString() !== new Date().toDateString()) return null;
    return { status: c.status, at: c.at };
  } catch { return null; }
}

function writeCache(status: TimeStatus, at: number) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ owner: cacheOwner(), at, status })); } catch { /* ignore */ }
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

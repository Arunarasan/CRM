import { useEffect, useState } from 'react';
import { Loader2, Save, KeyRound, Moon, Sun, Globe, BellRing, Clock, CheckCircle2, XCircle, Check, Fingerprint, Trash2, Plus } from 'lucide-react';
import { employeePortalApi } from '@/api/employeePortalApi';
import { ProfileChangeRequest } from '@/types/employeePortal';
import ImageCaptureField from '@/components/ImageCaptureField';
import { PortalHeader } from './_shared';
import { register as webauthnRegister, platformAuthenticatorAvailable, webauthnSupported, secureContextOk, describeWebauthnError } from '@/lib/webauthn';
import { Theme, getTheme, setTheme, getNotifPrefs, setNotifPrefs, NotifPrefs } from '@/lib/theme';
import { useT, Lang } from '@/i18n';

const NOTIF_KEYS = ['newTask', 'materialApproved', 'manpowerApproved', 'attendanceReminder', 'projectUpdate'] as const;

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? 'bg-primary' : 'bg-muted-foreground/30'}`} role="switch" aria-checked={on}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
    </label>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="px-4 pb-1 pt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</h3>;
}

type Cred = { id: number; deviceLabel: string; lastUsedAt: string | null; createdAt: string | null };

/**
 * Device-biometric enrolment for attendance. Registers this phone/tablet's fingerprint (or face /
 * Windows Hello) as a WebAuthn credential so office-device clock-ins verify without a password.
 */
function BiometricSection() {
  const [creds, setCreds] = useState<Cred[]>([]);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [method, setMethod] = useState<string>('GEO');
  const [requested, setRequested] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  const load = () => employeePortalApi.webauthnCredentials().then(setCreds).catch(() => setCreds([]));
  const loadStatus = () => employeePortalApi.timeStatus().then((s) => {
    setMethod(s.attendanceMethod ?? 'GEO');
    setRequested(s.attendanceMethodRequested ?? null);
  }).catch(() => {});
  useEffect(() => { load(); loadStatus(); platformAuthenticatorAvailable().then(setAvailable); }, []);

  const requestBiometric = async () => {
    setMsg(''); setErr(''); setSwitching(true);
    try {
      const s = await employeePortalApi.requestBiometricAttendance();
      setRequested(s.attendanceMethodRequested ?? 'ANY');
      setMsg('Requested. An admin will approve biometric attendance for you.');
    } catch (e: any) { setErr(e?.message || 'Could not send the request.'); }
    finally { setSwitching(false); }
  };

  const cancelRequest = async () => {
    setMsg(''); setErr(''); setSwitching(true);
    try { const s = await employeePortalApi.cancelMethodRequest(); setRequested(s.attendanceMethodRequested ?? null); }
    catch (e: any) { setErr(e?.message || 'Could not cancel.'); }
    finally { setSwitching(false); }
  };

  const biometricActive = method === 'OFFICE_DEVICE' || method === 'ANY';

  const registerDevice = async () => {
    setMsg(''); setErr('');
    if (!secureContextOk()) { setErr(describeWebauthnError({})); return; }
    setBusy(true);
    try {
      const options = await employeePortalApi.webauthnRegisterOptions();
      const att = await webauthnRegister(options);
      const label = (typeof navigator !== 'undefined' && /iPhone|iPad|Android|Mobile/.test(navigator.userAgent))
        ? 'My phone' : 'This device';
      await employeePortalApi.webauthnRegisterVerify({ ...att, deviceLabel: label });
      setMsg('Device registered. You can now clock in with your fingerprint.');
      load();
    } catch (e: any) {
      // Server-side failure carries a message; browser DOMExceptions get friendly guidance.
      setErr(e?.response?.data?.message || describeWebauthnError(e));
    } finally {
      setBusy(false);
    }
  };

  const removeCred = async (id: number) => {
    if (!confirm('Remove this device?')) return;
    try { await employeePortalApi.webauthnDeleteCredential(id); setCreds((c) => c.filter((x) => x.id !== id)); }
    catch (e: any) { setErr(e?.message || 'Could not remove device.'); }
  };

  if (!webauthnSupported()) return null;
  const insecure = !secureContextOk();

  return (
    <div className="mx-3 flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm">
      {/* Attendance mode — request a switch to biometric (admin-approved) */}
      <div className="rounded-lg border bg-muted/30 p-3">
        <p className="text-xs font-medium">
          Attendance mode: <span className="font-semibold">{biometricActive ? 'Biometric enabled' : 'Location (geo-fence)'}</span>
        </p>
        {biometricActive ? (
          <p className="mt-1 text-[11px] text-emerald-600">You can clock in with your fingerprint on a registered device.</p>
        ) : requested ? (
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[11px] text-amber-600">Requested — awaiting admin approval.</span>
            <button onClick={cancelRequest} disabled={switching} className="text-[11px] font-medium text-muted-foreground underline disabled:opacity-60">Cancel</button>
          </div>
        ) : (
          <button onClick={requestBiometric} disabled={switching}
            className="mt-2 flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary active:scale-[0.99] disabled:opacity-60">
            {switching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />} Switch to biometric attendance
          </button>
        )}
      </div>

      <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <Fingerprint className="h-4 w-4 text-primary" />
        Register your fingerprint / face on this device to verify office clock-ins.
      </p>

      {creds.length > 0 && (
        <ul className="flex flex-col divide-y rounded-lg border">
          {creds.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="flex items-center gap-2"><Fingerprint className="h-4 w-4 text-emerald-600" /> {c.deviceLabel}</span>
              <button onClick={() => removeCred(c.id)} className="rounded p-1 text-muted-foreground hover:text-destructive" title="Remove">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {insecure && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Biometric needs a secure (HTTPS) connection. Open the portal at its https:// address (not an IP) to register.
        </p>
      )}
      {!insecure && available === false && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          This device has no fingerprint / face unlock set up, so biometric clock-in isn't available here.
        </p>
      )}
      {err && <p className="text-xs text-destructive">{err}</p>}
      {msg && <p className="text-xs text-emerald-600">{msg}</p>}

      <button onClick={registerDevice} disabled={busy || insecure || available === false}
        className="flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground active:scale-[0.99] disabled:opacity-60">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Register this device
      </button>
    </div>
  );
}

export default function Settings() {
  const { t, lang, setLang, languages } = useT();

  const [form, setForm] = useState({ phone: '', emergencyContactName: '', emergencyContactPhone: '', profilePhotoUrl: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [requests, setRequests] = useState<ProfileChangeRequest[]>([]);

  const loadRequests = () => employeePortalApi.profileChangeRequests().then(setRequests).catch(() => setRequests([]));
  const pendingProfile = requests.find((r) => r.changeType === 'PROFILE' && r.status === 'PENDING');
  const lastProfileDecision = requests.find((r) => r.changeType === 'PROFILE' && r.status !== 'PENDING');

  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState('');
  const [pwErr, setPwErr] = useState('');

  const [theme, setThemeState] = useState<Theme>(getTheme());
  const [notif, setNotif] = useState<NotifPrefs>(getNotifPrefs());

  const toggleTheme = () => { const next: Theme = theme === 'dark' ? 'light' : 'dark'; setThemeState(next); setTheme(next); };
  const toggleNotif = (key: string) => { const next = { ...notif, [key]: !notif[key] }; setNotif(next); setNotifPrefs(next); };

  useEffect(() => {
    employeePortalApi.profile().then((d) => {
      setForm({
        phone: d.phone ?? '',
        emergencyContactName: d.emergencyContactName ?? '',
        emergencyContactPhone: d.emergencyContactPhone ?? '',
        profilePhotoUrl: d.profilePhotoUrl ?? '',
      });
    }).catch(() => {});
    loadRequests();
  }, []);

  const saveProfile = async () => {
    setProfileMsg(''); setSavingProfile(true);
    try {
      await employeePortalApi.submitProfileChange(form);
      setProfileMsg(t('portal.submitted'));
      await loadRequests();
    }
    catch (e: any) { setProfileMsg(e?.response?.data?.message || e?.message || t('portal.submissionFailed')); }
    finally { setSavingProfile(false); }
  };

  const savePw = async () => {
    setPwMsg(''); setPwErr('');
    if (pw.newPassword !== pw.confirm) { setPwErr(t('portal.passwordMismatch')); return; }
    if (pw.newPassword.length < 6) { setPwErr(t('portal.passwordTooShort')); return; }
    setSavingPw(true);
    try {
      await employeePortalApi.changePassword(pw.currentPassword, pw.newPassword);
      setPwMsg(t('portal.passwordUpdated'));
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (e: any) { setPwErr(e?.message || t('portal.passwordFailed')); }
    finally { setSavingPw(false); }
  };

  return (
    <div className="flex flex-col pb-8">
      <PortalHeader title={t('portal.settingsTitle')} />

      <SectionTitle>{t('portal.editableDetails')}</SectionTitle>
      <div className="mx-3 flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm">
        <p className="text-[11px] text-muted-foreground">{t('portal.editableHint')}</p>

        {pendingProfile && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <Clock className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t('portal.pending')}</span>
          </div>
        )}
        {!pendingProfile && lastProfileDecision && (
          lastProfileDecision.status === 'APPROVED' ? (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{t('portal.lastApproved')}</span>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{t('portal.lastRejected')}{lastProfileDecision.reviewRemarks ? ` ${t('portal.reason')}: ${lastProfileDecision.reviewRemarks}` : ''}</span>
            </div>
          )
        )}

        <Field label={t('portal.mobileNumber')} value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} placeholder={t('common.phone')} />
        <Field label={t('portal.emergencyName')} value={form.emergencyContactName} onChange={(v) => setForm((f) => ({ ...f, emergencyContactName: v }))} />
        <Field label={t('portal.emergencyPhone')} value={form.emergencyContactPhone} onChange={(v) => setForm((f) => ({ ...f, emergencyContactPhone: v }))} />
        <ImageCaptureField
          module="EMPLOYEE"
          label={t('portal.profilePhoto')}
          allowEdit
          value={form.profilePhotoUrl}
          onChange={({ url }) => setForm((f) => ({ ...f, profilePhotoUrl: url }))}
        />
        {profileMsg && <p className="text-xs text-emerald-600">{profileMsg}</p>}
        <button onClick={saveProfile} disabled={savingProfile}
          className="flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground active:scale-[0.99] disabled:opacity-60">
          {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {t('portal.submitForApproval')}
        </button>
      </div>

      <SectionTitle>{t('portal.preferences')}</SectionTitle>
      <div className="mx-3 flex flex-col gap-1 rounded-xl border bg-card p-2 shadow-sm">
        {/* Dark mode */}
        <div className="flex items-center gap-3 px-2 py-2.5">
          {theme === 'dark' ? <Moon className="h-5 w-5 text-emerald-500" /> : <Sun className="h-5 w-5 text-amber-500" />}
          <span className="flex-1 text-sm font-medium">{t('portal.darkMode')}</span>
          <Toggle on={theme === 'dark'} onClick={toggleTheme} />
        </div>
        {/* Language */}
        <div className="border-t px-2 py-2.5">
          <div className="mb-2 flex items-center gap-3">
            <Globe className="h-5 w-5 text-emerald-600" />
            <span className="flex-1 text-sm font-medium">{t('portal.language')}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {languages.map((l) => (
              <button
                key={l.code}
                onClick={() => setLang(l.code as Lang)}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  lang === l.code ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-card text-muted-foreground'
                }`}
              >
                <span>{l.label}</span>
                {lang === l.code && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <SectionTitle>{t('portal.notifications')}</SectionTitle>
      <div className="mx-3 flex flex-col divide-y rounded-xl border bg-card px-2 shadow-sm">
        {NOTIF_KEYS.map((key) => (
          <div key={key} className="flex items-center gap-3 px-2 py-2.5">
            <BellRing className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 text-sm">{t(`portal.notif.${key}`)}</span>
            <Toggle on={!!notif[key]} onClick={() => toggleNotif(key)} />
          </div>
        ))}
      </div>

      <SectionTitle>Device biometric</SectionTitle>
      <BiometricSection />

      <SectionTitle>{t('portal.changePassword')}</SectionTitle>
      <div className="mx-3 flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">{t('portal.currentPassword')}</span>
          <input type="password" value={pw.currentPassword} onChange={(e) => setPw((s) => ({ ...s, currentPassword: e.target.value }))} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">{t('portal.newPassword')}</span>
          <input type="password" value={pw.newPassword} onChange={(e) => setPw((s) => ({ ...s, newPassword: e.target.value }))} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">{t('portal.confirmPassword')}</span>
          <input type="password" value={pw.confirm} onChange={(e) => setPw((s) => ({ ...s, confirm: e.target.value }))} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
        </label>
        {pwErr && <p className="text-xs text-destructive">{pwErr}</p>}
        {pwMsg && <p className="text-xs text-emerald-600">{pwMsg}</p>}
        <button onClick={savePw} disabled={savingPw}
          className="flex items-center justify-center gap-2 rounded-lg bg-slate-800 py-2.5 text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-60">
          {savingPw ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} {t('portal.updatePassword')}
        </button>
      </div>
    </div>
  );
}

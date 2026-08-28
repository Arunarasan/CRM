import { useEffect, useState } from 'react';
import { Loader2, Save, KeyRound, Moon, Sun, Globe, BellRing } from 'lucide-react';
import { employeePortalApi } from '@/api/employeePortalApi';
import { PortalHeader } from './_shared';
import {
  Theme, getTheme, setTheme, getLanguage, setLanguage,
  getNotifPrefs, setNotifPrefs, NotifPrefs,
} from '@/lib/theme';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'te', label: 'తెలుగు' },
];

const NOTIF_LABELS: { key: string; label: string }[] = [
  { key: 'newTask', label: 'New task assigned' },
  { key: 'materialApproved', label: 'Material approved' },
  { key: 'manpowerApproved', label: 'Manpower approved' },
  { key: 'attendanceReminder', label: 'Attendance reminder' },
  { key: 'projectUpdate', label: 'Project update' },
];

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

export default function Settings() {
  const [form, setForm] = useState({ phone: '', emergencyContactName: '', emergencyContactPhone: '', profilePhotoUrl: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState('');
  const [pwErr, setPwErr] = useState('');

  const [theme, setThemeState] = useState<Theme>(getTheme());
  const [lang, setLangState] = useState(getLanguage());
  const [notif, setNotif] = useState<NotifPrefs>(getNotifPrefs());

  const toggleTheme = () => { const next: Theme = theme === 'dark' ? 'light' : 'dark'; setThemeState(next); setTheme(next); };
  const chooseLang = (code: string) => { setLangState(code); setLanguage(code); };
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
  }, []);

  const saveProfile = async () => {
    setProfileMsg(''); setSavingProfile(true);
    try { await employeePortalApi.updateProfile(form); setProfileMsg('Profile updated.'); }
    catch (e: any) { setProfileMsg(e?.message || 'Update failed.'); }
    finally { setSavingProfile(false); }
  };

  const savePw = async () => {
    setPwMsg(''); setPwErr('');
    if (pw.newPassword !== pw.confirm) { setPwErr('New passwords do not match.'); return; }
    if (pw.newPassword.length < 6) { setPwErr('New password must be at least 6 characters.'); return; }
    setSavingPw(true);
    try {
      await employeePortalApi.changePassword(pw.currentPassword, pw.newPassword);
      setPwMsg('Password updated.');
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (e: any) { setPwErr(e?.message || 'Could not change password.'); }
    finally { setSavingPw(false); }
  };

  return (
    <div className="flex flex-col">
      <PortalHeader title="Settings" />

      <h3 className="px-4 pb-1 pt-3 text-xs font-semibold uppercase text-muted-foreground">Editable Details</h3>
      <div className="mx-3 flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm">
        <p className="text-[11px] text-muted-foreground">Employee ID, salary, department and designation are managed by HR and cannot be changed here.</p>
        <Field label="Mobile Number" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} placeholder="Phone" />
        <Field label="Emergency Contact Name" value={form.emergencyContactName} onChange={(v) => setForm((f) => ({ ...f, emergencyContactName: v }))} />
        <Field label="Emergency Contact Phone" value={form.emergencyContactPhone} onChange={(v) => setForm((f) => ({ ...f, emergencyContactPhone: v }))} />
        <Field label="Profile Photo URL" value={form.profilePhotoUrl} onChange={(v) => setForm((f) => ({ ...f, profilePhotoUrl: v }))} placeholder="https://…" />
        {profileMsg && <p className="text-xs text-emerald-600">{profileMsg}</p>}
        <button onClick={saveProfile} disabled={savingProfile}
          className="flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground active:scale-[0.99] disabled:opacity-60">
          {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Changes
        </button>
      </div>

      <h3 className="px-4 pb-1 pt-5 text-xs font-semibold uppercase text-muted-foreground">Preferences</h3>
      <div className="mx-3 flex flex-col gap-1 rounded-xl border bg-card p-2 shadow-sm">
        {/* Dark mode */}
        <div className="flex items-center gap-3 px-2 py-2.5">
          {theme === 'dark' ? <Moon className="h-5 w-5 text-emerald-500" /> : <Sun className="h-5 w-5 text-amber-500" />}
          <span className="flex-1 text-sm font-medium">Dark Mode</span>
          <Toggle on={theme === 'dark'} onClick={toggleTheme} />
        </div>
        {/* Language */}
        <div className="border-t px-2 py-2.5">
          <div className="mb-2 flex items-center gap-3">
            <Globe className="h-5 w-5 text-emerald-600" />
            <span className="flex-1 text-sm font-medium">Language</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map((l) => (
              <button key={l.code} onClick={() => chooseLang(l.code)} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${lang === l.code ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'}`}>
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <h3 className="px-4 pb-1 pt-5 text-xs font-semibold uppercase text-muted-foreground">Notifications</h3>
      <div className="mx-3 flex flex-col divide-y rounded-xl border bg-card px-2 shadow-sm">
        {NOTIF_LABELS.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-3 px-2 py-2.5">
            <BellRing className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 text-sm">{label}</span>
            <Toggle on={!!notif[key]} onClick={() => toggleNotif(key)} />
          </div>
        ))}
      </div>

      <h3 className="px-4 pb-1 pt-5 text-xs font-semibold uppercase text-muted-foreground">Change Password</h3>
      <div className="mx-3 mb-8 flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Current Password</span>
          <input type="password" value={pw.currentPassword} onChange={(e) => setPw((s) => ({ ...s, currentPassword: e.target.value }))} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">New Password</span>
          <input type="password" value={pw.newPassword} onChange={(e) => setPw((s) => ({ ...s, newPassword: e.target.value }))} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Confirm New Password</span>
          <input type="password" value={pw.confirm} onChange={(e) => setPw((s) => ({ ...s, confirm: e.target.value }))} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
        </label>
        {pwErr && <p className="text-xs text-destructive">{pwErr}</p>}
        {pwMsg && <p className="text-xs text-emerald-600">{pwMsg}</p>}
        <button onClick={savePw} disabled={savingPw}
          className="flex items-center justify-center gap-2 rounded-lg bg-slate-800 py-2.5 text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-60">
          {savingPw ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Update Password
        </button>
      </div>
    </div>
  );
}

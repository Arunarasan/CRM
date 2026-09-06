import { useEffect, useState, ReactNode } from 'react';
import {
  Building2, SlidersHorizontal, BellRing, UsersRound, ShieldCheck,
  Save, Loader2, KeyRound, Moon, Sun, Globe, Check,
} from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { useT, Lang } from '@/i18n';
import { Theme, getTheme, setTheme } from '@/lib/theme';
import { settingsApi as siteSettingsApi } from '@/api/websiteAdminApi';
import { smartAssignmentApi } from '@/api/smartAssignmentApi';
import { settingsApi } from '@/api/settingsApi';
import type { AssignmentSettings } from '@/types/assignment';

/* ------------------------------- primitives ------------------------------- */

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="switch"
      aria-checked={on}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? 'bg-primary' : 'bg-muted-foreground/30'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

function Card({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {desc && <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function TextField({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none"
      />
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number | string; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none"
      />
    </label>
  );
}

function ToggleRow({ label, desc, on, onToggle }: { label: string; desc?: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
      </div>
      <Toggle on={on} onClick={onToggle} />
    </div>
  );
}

function SaveBar({ saving, onSave, disabled }: { saving: boolean; onSave: () => void; disabled?: boolean }) {
  const { t } = useT();
  return (
    <div className="mt-5 flex justify-end">
      <button
        onClick={onSave}
        disabled={saving || disabled}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition active:scale-[0.99] disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {saving ? t('common.saving') : t('common.saveChanges')}
      </button>
    </div>
  );
}

/* --------------------------------- tabs ---------------------------------- */

type TabKey = 'company' | 'preferences' | 'notifications' | 'assignment' | 'security';

/* ------------------------------ Company tab ------------------------------ */
// Reuses the website site_settings store (brand.* / contact.*), plus a company.gst key.
const COMPANY_KEYS = {
  businessName: 'brand.name',
  tagline: 'brand.tagline',
  contactPhone: 'contact.phone',
  contactEmail: 'contact.email',
  address: 'contact.address',
  gst: 'company.gst',
  serviceWarrantyMonths: 'warranty.service_months',
  productWarrantyMonths: 'warranty.product_months',
} as const;

function CompanyTab() {
  const { t } = useT();
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    siteSettingsApi.list()
      .then((rows) => {
        const map: Record<string, string> = {};
        rows.forEach((r) => { map[r.key] = r.value ?? ''; });
        setValues(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const set = (key: string, v: string) => setValues((s) => ({ ...s, [key]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const payload = Object.values(COMPANY_KEYS).map((key) => ({ key, value: values[key] ?? '' }));
      await siteSettingsApi.saveAll(payload);
      toast.success(t('settings.savedToast'));
    } catch {
      toast.error(t('settings.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <Card title={t('settings.company.title')} desc={t('settings.company.desc')}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label={t('settings.company.businessName')} value={values[COMPANY_KEYS.businessName] ?? ''} onChange={(v) => set(COMPANY_KEYS.businessName, v)} />
        <TextField label={t('settings.company.tagline')} value={values[COMPANY_KEYS.tagline] ?? ''} onChange={(v) => set(COMPANY_KEYS.tagline, v)} />
        <TextField label={t('settings.company.contactPhone')} type="tel" value={values[COMPANY_KEYS.contactPhone] ?? ''} onChange={(v) => set(COMPANY_KEYS.contactPhone, v)} />
        <TextField label={t('settings.company.contactEmail')} type="email" value={values[COMPANY_KEYS.contactEmail] ?? ''} onChange={(v) => set(COMPANY_KEYS.contactEmail, v)} />
        <TextField label={t('settings.company.gst')} value={values[COMPANY_KEYS.gst] ?? ''} onChange={(v) => set(COMPANY_KEYS.gst, v)} />
        <TextField label="Default service warranty (months)" type="number" value={values[COMPANY_KEYS.serviceWarrantyMonths] ?? ''} onChange={(v) => set(COMPANY_KEYS.serviceWarrantyMonths, v)} />
        <TextField label="Default product warranty (months)" type="number" value={values[COMPANY_KEYS.productWarrantyMonths] ?? ''} onChange={(v) => set(COMPANY_KEYS.productWarrantyMonths, v)} />
        <div className="sm:col-span-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">{t('settings.company.address')}</span>
            <textarea
              value={values[COMPANY_KEYS.address] ?? ''}
              onChange={(e) => set(COMPANY_KEYS.address, e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none"
            />
          </label>
        </div>
      </div>
      <SaveBar saving={saving} onSave={save} />
    </Card>
  );
}

/* ---------------------------- Preferences tab ---------------------------- */
function PreferencesTab() {
  const { t, lang, setLang, languages } = useT();
  const [theme, setThemeState] = useState<Theme>(getTheme());

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setThemeState(next);
    setTheme(next);
  };

  return (
    <Card title={t('settings.preferences.title')} desc={t('settings.preferences.desc')}>
      <div className="flex items-center justify-between gap-4 border-b border-border py-3">
        <div className="flex items-center gap-3">
          {theme === 'dark' ? <Moon className="h-5 w-5 text-primary" /> : <Sun className="h-5 w-5 text-gold" />}
          <div>
            <p className="text-sm font-medium text-foreground">{t('settings.preferences.darkMode')}</p>
            <p className="text-xs text-muted-foreground">{t('settings.preferences.darkModeDesc')}</p>
          </div>
        </div>
        <Toggle on={theme === 'dark'} onClick={toggleTheme} />
      </div>

      <div className="pt-4">
        <div className="mb-2 flex items-center gap-3">
          <Globe className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">{t('settings.preferences.language')}</p>
            <p className="text-xs text-muted-foreground">{t('settings.preferences.languageDesc')}</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {languages.map((l) => (
            <button
              key={l.code}
              onClick={() => setLang(l.code as Lang)}
              className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                lang === l.code
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border bg-background text-muted-foreground hover:border-primary/40'
              }`}
            >
              <span>{l.label}</span>
              {lang === l.code && <Check className="h-4 w-4 text-primary" />}
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}

/* --------------------------- Notifications tab --------------------------- */
function NotificationsTab() {
  const { t } = useT();
  const [s, setS] = useState({ emailEnabled: true, smsEnabled: false, whatsappEnabled: false, inAppEnabled: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsApi.getNotificationSettings()
      .then((d) => setS({
        emailEnabled: !!d.emailEnabled, smsEnabled: !!d.smsEnabled,
        whatsappEnabled: !!d.whatsappEnabled, inAppEnabled: !!d.inAppEnabled,
      }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await settingsApi.updateNotificationSettings(s);
      toast.success(t('settings.savedToast'));
    } catch {
      toast.error(t('settings.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <Card title={t('settings.notifications.title')} desc={t('settings.notifications.desc')}>
      <div className="divide-y divide-border">
        <ToggleRow label={t('settings.notifications.email')} desc={t('settings.notifications.emailDesc')} on={s.emailEnabled} onToggle={() => setS((v) => ({ ...v, emailEnabled: !v.emailEnabled }))} />
        <ToggleRow label={t('settings.notifications.sms')} desc={t('settings.notifications.smsDesc')} on={s.smsEnabled} onToggle={() => setS((v) => ({ ...v, smsEnabled: !v.smsEnabled }))} />
        <ToggleRow label={t('settings.notifications.whatsapp')} desc={t('settings.notifications.whatsappDesc')} on={s.whatsappEnabled} onToggle={() => setS((v) => ({ ...v, whatsappEnabled: !v.whatsappEnabled }))} />
        <ToggleRow label={t('settings.notifications.inApp')} desc={t('settings.notifications.inAppDesc')} on={s.inAppEnabled} onToggle={() => setS((v) => ({ ...v, inAppEnabled: !v.inAppEnabled }))} />
      </div>
      <SaveBar saving={saving} onSave={save} />
    </Card>
  );
}

/* ---------------------------- Assignment tab ----------------------------- */
function AssignmentTab() {
  const { t } = useT();
  const [s, setS] = useState<AssignmentSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { smartAssignmentApi.getSettings().then(setS).catch(() => setS(null)); }, []);

  const patch = (p: Partial<AssignmentSettings>) => setS((prev) => (prev ? { ...prev, ...p } : prev));

  const save = async () => {
    if (!s) return;
    setSaving(true);
    try {
      await smartAssignmentApi.updateSettings(s);
      toast.success(t('settings.savedToast'));
    } catch {
      toast.error(t('settings.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (!s) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <Card title={t('settings.assignment.title')} desc={t('settings.assignment.desc')}>
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField label={t('settings.assignment.maxTasksPerDay')} value={s.maxTasksPerDay ?? 0} onChange={(v) => patch({ maxTasksPerDay: v })} />
        <NumberField label={t('settings.assignment.maxWorkingHours')} value={s.maxWorkingHours ?? 0} onChange={(v) => patch({ maxWorkingHours: v })} />
        <NumberField label={t('settings.assignment.maxOvertimeHours')} value={s.maxOvertimeHours ?? 0} onChange={(v) => patch({ maxOvertimeHours: v })} />
        <NumberField label={t('settings.assignment.minSuitability')} value={s.minSuitabilityScore ?? 0} onChange={(v) => patch({ minSuitabilityScore: v })} />
      </div>
      <div className="mt-4 divide-y divide-border border-t border-border">
        <ToggleRow label={t('settings.assignment.autoBalance')} desc={t('settings.assignment.autoBalanceDesc')} on={!!s.autoBalanceEnabled} onToggle={() => patch({ autoBalanceEnabled: !s.autoBalanceEnabled })} />
        <ToggleRow label={t('settings.assignment.allowOvertime')} desc={t('settings.assignment.allowOvertimeDesc')} on={!!s.allowOvertime} onToggle={() => patch({ allowOvertime: !s.allowOvertime })} />
        <ToggleRow label={t('settings.assignment.mandatorySkill')} desc={t('settings.assignment.mandatorySkillDesc')} on={!!s.mandatorySkillMatching} onToggle={() => patch({ mandatorySkillMatching: !s.mandatorySkillMatching })} />
      </div>
      <SaveBar saving={saving} onSave={save} />
    </Card>
  );
}

/* ----------------------------- Security tab ------------------------------ */
function SecurityTab() {
  const { t } = useT();
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (pw.newPassword !== pw.confirm) { toast.error(t('settings.security.passwordMismatch')); return; }
    if (pw.newPassword.length < 6) { toast.error(t('settings.security.passwordTooShort')); return; }
    setSaving(true);
    try {
      await settingsApi.changeOwnPassword(pw.currentPassword, pw.newPassword);
      toast.success(t('settings.security.passwordUpdated'));
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || t('settings.security.passwordFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title={t('settings.security.title')} desc={t('settings.security.desc')}>
      <div className="grid max-w-md gap-4">
        <TextField label={t('settings.security.currentPassword')} type="password" value={pw.currentPassword} onChange={(v) => setPw((s) => ({ ...s, currentPassword: v }))} />
        <TextField label={t('settings.security.newPassword')} type="password" value={pw.newPassword} onChange={(v) => setPw((s) => ({ ...s, newPassword: v }))} />
        <TextField label={t('settings.security.confirmPassword')} type="password" value={pw.confirm} onChange={(v) => setPw((s) => ({ ...s, confirm: v }))} />
      </div>
      <div className="mt-5">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition active:scale-[0.99] disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          {t('settings.security.updatePassword')}
        </button>
      </div>
    </Card>
  );
}

/* --------------------------------- page ---------------------------------- */
export default function Settings() {
  const { t } = useT();
  const [tab, setTab] = useState<TabKey>('company');

  const TABS: { key: TabKey; labelKey: string; icon: typeof Building2 }[] = [
    { key: 'company', labelKey: 'settings.tabs.company', icon: Building2 },
    { key: 'preferences', labelKey: 'settings.tabs.preferences', icon: SlidersHorizontal },
    { key: 'notifications', labelKey: 'settings.tabs.notifications', icon: BellRing },
    { key: 'assignment', labelKey: 'settings.tabs.assignment', icon: UsersRound },
    { key: 'security', labelKey: 'settings.tabs.security', icon: ShieldCheck },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{t('settings.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('settings.subtitle')}</p>
      </header>

      {/* Tab strip — horizontally scrollable on phones */}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-border bg-muted/40 p-1">
        {TABS.map(({ key, labelKey, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4" />
            {t(labelKey)}
          </button>
        ))}
      </div>

      {tab === 'company' && <CompanyTab />}
      {tab === 'preferences' && <PreferencesTab />}
      {tab === 'notifications' && <NotificationsTab />}
      {tab === 'assignment' && <AssignmentTab />}
      {tab === 'security' && <SecurityTab />}
    </div>
  );
}

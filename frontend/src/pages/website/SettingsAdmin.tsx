import { useEffect, useMemo, useState } from 'react';
import { Loader2, Save, Building2, Phone, Share2, Settings as SettingsIcon } from 'lucide-react';
import { settingsApi, SiteSetting } from '@/api/websiteAdminApi';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';

const GROUP_META: Record<string, { icon: typeof Building2; description: string }> = {
  Brand: { icon: Building2, description: 'Your business name and tagline, shown across the site.' },
  Contact: { icon: Phone, description: 'How customers reach you — shown in the footer and contact page.' },
  Social: { icon: Share2, description: 'Links to your social profiles, shown in the footer.' },
};

/**
 * Site settings editor — brand, contact and social values that used to be hardcoded in the website.
 * Loads every setting, groups them for a friendly form, and saves all key/values in one call.
 * Edits are live on the public site on its next fetch (it overlays these over its defaults).
 */
export default function SettingsAdmin() {
  const [settings, setSettings] = useState<SiteSetting[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    settingsApi.list()
      .then((rows) => {
        setSettings(rows);
        const v: Record<string, string> = {};
        rows.forEach((s) => { v[s.key] = s.value ?? ''; });
        setValues(v);
      })
      .catch(() => toast.error('Could not load settings.'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const groups = useMemo(() => {
    const g: Record<string, SiteSetting[]> = {};
    settings.forEach((s) => { (g[s.group || 'General'] ||= []).push(s); });
    return g;
  }, [settings]);

  const dirty = useMemo(
    () => settings.some((s) => (s.value ?? '') !== (values[s.key] ?? '')),
    [settings, values],
  );

  const save = async () => {
    setSaving(true);
    try {
      const payload = settings.map((s) => ({ key: s.key, value: values[s.key] ?? '' }));
      await settingsApi.saveAll(payload);
      setSettings((prev) => prev.map((s) => ({ ...s, value: values[s.key] ?? '' })));
      toast.success('Settings saved. Live on the site on its next load.');
    } catch (e: any) {
      toast.error(e?.message || 'Could not save settings.');
    } finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading settings…
      </div>
    );
  }

  if (settings.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-white py-14 text-center text-sm text-muted-foreground">
        No settings found. Restart the backend once so defaults seed, then refresh.
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6 pb-4">
      <p className="text-sm text-muted-foreground">
        Your business details, shown across the public website. Changes go live on the site’s next load.
      </p>
      {Object.entries(groups).map(([group, rows]) => {
        const meta = GROUP_META[group] ?? { icon: SettingsIcon, description: '' };
        const Icon = meta.icon;
        return (
          <section key={group} className="rounded-xl border bg-white shadow-sm">
            <div className="flex items-start gap-3 border-b px-5 py-3.5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">{group}</h2>
                {meta.description && <p className="text-xs text-muted-foreground">{meta.description}</p>}
              </div>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {rows.map((s) => (
                <label key={s.key} className={s.inputType === 'textarea' ? 'sm:col-span-2 block' : 'block'}>
                  <span className="mb-1 block text-xs font-medium text-slate-600">{s.label || s.key}</span>
                  {s.inputType === 'textarea' ? (
                    <textarea
                      value={values[s.key] ?? ''}
                      onChange={(e) => setValues((v) => ({ ...v, [s.key]: e.target.value }))}
                      rows={2}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  ) : (
                    <input
                      type={s.inputType === 'tel' || s.inputType === 'email' || s.inputType === 'url' ? s.inputType : 'text'}
                      value={values[s.key] ?? ''}
                      onChange={(e) => setValues((v) => ({ ...v, [s.key]: e.target.value }))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  )}
                </label>
              ))}
            </div>
          </section>
        );
      })}

      <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t bg-slate-50/80 py-3 backdrop-blur">
        {dirty && <span className="text-xs text-amber-600">Unsaved changes</span>}
        <Button onClick={save} disabled={saving || !dirty}>
          {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
          Save settings
        </Button>
      </div>
    </div>
  );
}

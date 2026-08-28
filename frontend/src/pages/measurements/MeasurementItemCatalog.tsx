import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Plus, Trash2, Pencil, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { measurementCatalogApi, CatalogItem } from '@/api/measurementCatalogApi';
import { useGoBack } from '@/hooks/useGoBack';

const UNITS = ['sqft', 'rft', 'nos', 'lot'];
const EMPTY: CatalogItem = { name: '', itemType: '', defaultUnit: 'sqft', defaultMaterial: '', active: true, orderIndex: 0 };

/**
 * Admin-only master for standard measurement items. Employees pick from these when capturing a site
 * measurement, so item name / category / unit / material stay consistent into the BOQ.
 */
export default function MeasurementItemCatalog() {
  const goBack = useGoBack('/measurements');
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<CatalogItem>({ ...EMPTY });
  const [editId, setEditId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    measurementCatalogApi.listAll().then(setItems).catch(() => setItems([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const set = (k: keyof CatalogItem, v: any) => setForm((p) => ({ ...p, [k]: v }));
  const resetForm = () => { setForm({ ...EMPTY }); setEditId(null); };

  const save = async () => {
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      if (editId) await measurementCatalogApi.update(editId, form);
      else await measurementCatalogApi.create(form);
      resetForm(); load();
    } finally { setBusy(false); }
  };

  const edit = (it: CatalogItem) => { setForm({ ...it }); setEditId(it.id ?? null); };
  const remove = async (it: CatalogItem) => {
    if (!it.id || !confirm(`Remove "${it.name}" from the catalog?`)) return;
    await measurementCatalogApi.remove(it.id); load();
  };
  const toggleActive = async (it: CatalogItem) => {
    if (!it.id) return;
    await measurementCatalogApi.update(it.id, { ...it, active: !it.active }); load();
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={goBack} title="Back"><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className="text-xl font-bold">Measurement Item Catalog</h1>
          <p className="text-sm text-muted-foreground">Standard items employees pick from when capturing a measurement.</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{editId ? 'Edit item' : 'Add item'}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium">Name</label>
              <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Wall Painting"
                className="w-full rounded-md border px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium">Category / type</label>
              <input value={form.itemType ?? ''} onChange={(e) => set('itemType', e.target.value)} placeholder="e.g. Wall"
                className="w-full rounded-md border px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium">Default unit</label>
              <select value={form.defaultUnit ?? ''} onChange={(e) => set('defaultUnit', e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm">
                {UNITS.map((u) => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium">Default material</label>
              <input value={form.defaultMaterial ?? ''} onChange={(e) => set('defaultMaterial', e.target.value)} placeholder="optional"
                className="w-full rounded-md border px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button onClick={save} disabled={busy || !form.name.trim()}>
              {editId ? <><Check className="h-4 w-4 mr-1" /> Update</> : <><Plus className="h-4 w-4 mr-1" /> Add</>}
            </Button>
            {editId && <Button variant="outline" onClick={resetForm}><X className="h-4 w-4 mr-1" /> Cancel</Button>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Catalog ({items.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No items yet — add one above.</p>
          ) : (
            <div className="divide-y">
              {items.map((it) => (
                <div key={it.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className={`text-sm font-medium ${it.active ? '' : 'line-through text-muted-foreground'}`}>{it.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[it.itemType, it.defaultUnit, it.defaultMaterial].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggleActive(it)} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${it.active ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                      {it.active ? 'Active' : 'Inactive'}
                    </button>
                    <Button variant="ghost" size="icon" onClick={() => edit(it)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => remove(it)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

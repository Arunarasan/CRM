import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';

interface CrudApi<T> {
  list: () => Promise<T[]>;
  create: (body: T) => Promise<T>;
  update: (id: number, body: T) => Promise<T>;
  remove: (id: number) => Promise<unknown>;
  toggle: (id: number) => Promise<T>;
}

interface Base { id?: number; active?: boolean }

/**
 * Shared list + dialog-form scaffold for every Website/CMS entity. Handles loading, the Add/Edit
 * dialog, save (create vs update), soft-delete, and the active toggle; each page just supplies how
 * to render a row and the form fields. Optimistic toasts match the CRM's usability conventions.
 */
export default function ResourceManager<T extends Base>({
  singular, api, emptyDraft, renderRow, renderForm, validate, wide, rowTitle,
}: {
  singular: string;
  api: CrudApi<T>;
  emptyDraft: T;
  renderRow: (item: T) => React.ReactNode;
  renderForm: (draft: T, patch: (p: Partial<T>) => void) => React.ReactNode;
  validate?: (draft: T) => string | null;
  wide?: boolean;
  rowTitle: (item: T) => string;
}) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<T>(emptyDraft);
  const [editId, setEditId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.list().then(setItems).catch(() => setItems([])).finally(() => setLoading(false));
  }, [api]);
  useEffect(() => { load(); }, [load]);

  const patch = (p: Partial<T>) => setDraft((d) => ({ ...d, ...p }));

  const openCreate = () => { setDraft({ ...emptyDraft }); setEditId(null); setOpen(true); };
  const openEdit = (item: T) => { setDraft({ ...item }); setEditId(item.id ?? null); setOpen(true); };

  const save = async () => {
    const err = validate?.(draft);
    if (err) { toast.error(err); return; }
    setBusy(true);
    try {
      if (editId) await api.update(editId, draft);
      else await api.create(draft);
      toast.success(`${singular} ${editId ? 'updated' : 'created'}`);
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.message || `Could not save ${singular.toLowerCase()}`);
    } finally { setBusy(false); }
  };

  const remove = async (item: T) => {
    if (!item.id || !confirm(`Remove "${rowTitle(item)}"? It will disappear from the website.`)) return;
    try { await api.remove(item.id); toast.success(`${singular} removed`); load(); }
    catch (e: any) { toast.error(e?.message || 'Could not remove'); }
  };

  const toggle = async (item: T) => {
    if (!item.id) return;
    try { await api.toggle(item.id); load(); }
    catch (e: any) { toast.error(e?.message || 'Could not update'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{items.length} item{items.length === 1 ? '' : 's'}</p>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Add {singular}</Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-white py-12 text-center">
          <p className="text-sm text-muted-foreground">No {singular.toLowerCase()}s yet.</p>
          <Button variant="outline" className="mt-3" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Add the first one</Button>
        </div>
      ) : (
        <div className="rounded-lg border bg-white divide-y">
          {items.map((item) => (
            <div key={item.id} className={`flex items-center justify-between gap-3 p-3 ${item.active === false ? 'opacity-60' : ''}`}>
              <div className="min-w-0 flex-1">{renderRow(item)}</div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => toggle(item)}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${item.active === false ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-700'}`}
                  title={item.active === false ? 'Hidden from site — click to publish' : 'Live on site — click to hide'}
                >
                  {item.active === false ? 'Hidden' : 'Live'}
                </button>
                <Button variant="ghost" size="icon" onClick={() => openEdit(item)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => remove(item)} title="Delete"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        {/* Fixed header + footer, only the body scrolls (and the two-column forms are short enough
            that it usually doesn't) — so the Save/Cancel bar never scrolls out of reach. */}
        <DialogContent className={`flex max-h-[90vh] flex-col gap-0 p-0 ${wide ? 'sm:max-w-5xl' : 'sm:max-w-lg'}`}>
          <DialogHeader className="shrink-0 border-b px-5 py-3.5 text-left">
            <DialogTitle>{editId ? `Edit ${singular}` : `Add ${singular}`}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {renderForm(draft, patch)}
          </div>
          <DialogFooter className="shrink-0 gap-2 border-t bg-slate-50/70 px-5 py-3">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={save} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editId ? 'Save changes' : `Create ${singular}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

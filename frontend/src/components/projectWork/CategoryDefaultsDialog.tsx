import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { inventoryApi } from '@/api/inventoryApi';
import { toast } from '@/components/ui/toast';
import { InventoryCategory } from '@/types/inventory';
import { WorkStepType } from '@/types/projectWork';
import { STEP_ICON } from './ExecutionBoard';
import { INPUT, PRIMARY, errMsg } from './workUi';

const STEPS: { type: WorkStepType; label: string }[] = [
  { type: 'MATERIAL', label: 'Material' },
  { type: 'MANUFACTURE', label: 'Manufacture' },
  { type: 'STITCHING', label: 'Stitching' },
  { type: 'DELIVERY', label: 'Delivery to site' },
];

/**
 * Per inventory category: which work steps its products go through on a project, and the installation
 * checklist its category gets. Used when new projects are set up (blank = guessed from the name).
 */
export default function CategoryDefaultsDialog({ open, onOpenChange, suggest }: {
  open: boolean; onOpenChange: (o: boolean) => void; suggest?: string[];
}) {
  const [cats, setCats] = useState<InventoryCategory[]>([]);
  const [selId, setSelId] = useState<number | null>(null);
  const [steps, setSteps] = useState<WorkStepType[]>([]);
  const [install, setInstall] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    inventoryApi.getCategories().then((list) => {
      setCats(list);
      const first = list.find((c) => suggest?.some((s) => s.toLowerCase() === c.name.toLowerCase())) || list[0];
      if (first) pick(first);
    }).catch(() => setCats([]));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (c: InventoryCategory) => {
    setSelId(c.id);
    setSteps((c.workSteps || '').split(',').map((s) => s.trim()).filter(Boolean) as WorkStepType[]);
    setInstall(c.installSteps || '');
  };
  const sel = cats.find((c) => c.id === selId) || null;

  // Categories used on this project first.
  const ordered = useMemo(() => {
    const used = new Set((suggest || []).map((s) => s.toLowerCase()));
    return [...cats].sort((a, b) => Number(used.has(b.name.toLowerCase())) - Number(used.has(a.name.toLowerCase())) || a.name.localeCompare(b.name));
  }, [cats, suggest]);

  // Project categories that aren't in the inventory catalogue yet — one tap adds them.
  const missing = (suggest || []).filter((n) => n && !cats.some((c) => c.name.toLowerCase() === n.toLowerCase()));
  const addCategory = async (name: string) => {
    try {
      const created = await inventoryApi.createCategory({ name });
      setCats((cs) => [...cs, created]);
      pick(created);
    } catch (e) {
      toast.error(errMsg(e, 'Could not add the category'));
    }
  };

  const save = async () => {
    if (!sel) return;
    setBusy(true);
    try {
      const ordSteps = STEPS.map((s) => s.type).filter((t) => steps.includes(t));
      const saved = await inventoryApi.updateCategory(sel.id, {
        name: sel.name, description: sel.description, code: sel.code, parent: sel.parent ?? null,
        workSteps: ordSteps.join(','), installSteps: install.trim(),
      });
      setCats((cs) => cs.map((c) => (c.id === saved.id ? { ...c, ...saved } : c)));
      toast.success(`${sel.name} defaults saved — used for new projects`);
    } catch (e) {
      toast.error(errMsg(e, 'Could not save'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Category work defaults</DialogTitle></DialogHeader>
        <p className="-mt-1 text-[12.5px] text-[#6B7169]">
          Set what each category's products go through and its installation checklist. Leave blank to let the system guess from the name.
        </p>
        <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
          <ul className="max-h-[50vh] overflow-y-auto rounded-xl border border-[#EDE6D8]">
            {ordered.map((c) => (
              <li key={c.id}>
                <button onClick={() => pick(c)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-[13px] ${c.id === selId ? 'bg-[#EFF5F0] font-semibold text-[#0A573B]' : 'text-[#33392F]'}`}>
                  <span className="truncate">{c.name}</span>
                  {(c.workSteps || c.installSteps) && <span className="h-1.5 w-1.5 rounded-full bg-[#0A573B]" />}
                </button>
              </li>
            ))}
            {missing.map((n) => (
              <li key={`new-${n}`}>
                <button onClick={() => addCategory(n)} className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-[13px] text-[#9B6B32]">
                  + {n} <span className="text-[11px] text-[#9A9E96]">(add)</span>
                </button>
              </li>
            ))}
            {!ordered.length && !missing.length && <li className="p-3 text-[12.5px] text-[#9A9E96]">No inventory categories yet.</li>}
          </ul>
          {sel ? (
            <div className="flex flex-col gap-3">
              <div>
                <p className="mb-1.5 text-[12px] font-semibold text-[#5E655D]">Steps for {sel.name} products</p>
                <div className="flex flex-wrap gap-1.5">
                  {STEPS.map((s) => {
                    const on = steps.includes(s.type);
                    const Icon = STEP_ICON[s.type];
                    return (
                      <button key={s.type} onClick={() => setSteps((cur) => on ? cur.filter((t) => t !== s.type) : [...cur, s.type])}
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-medium ring-1 ${on ? 'bg-[#0A573B] text-white ring-[#0A573B]' : 'bg-white text-[#6B7169] ring-[#DDE2DE]'}`}>
                        <Icon className="h-3.5 w-3.5" /> {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-[12px] font-semibold text-[#5E655D]">Installation checklist (one step per line)</p>
                <textarea value={install} onChange={(e) => setInstall(e.target.value)} rows={6}
                  placeholder={'e.g.\nMark & fix brackets\nFix rods / tracks\nHang curtains & set pleats\nFinal check & clean up'} className={INPUT} />
              </div>
              <button onClick={save} disabled={busy} className={`${PRIMARY} self-start`}>Save defaults</button>
              <p className="text-[11.5px] text-[#9A9E96]">Changes apply to projects set up from now on; existing products keep their steps.</p>
            </div>
          ) : <p className="text-[13px] text-[#9A9E96]">Pick a category.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

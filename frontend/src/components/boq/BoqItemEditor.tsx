import { useState } from 'react';
import { ChevronDown, Trash2, Plus, Package, HardHat } from 'lucide-react';
import { boqApi } from '@/api/boqApi';
import type { BoqItem } from '@/types/boq';

/**
 * One BOQ line with its FULL detail — materials (with wastage %) and labour (with contractor) — the
 * same things the desktop BOQ admin edits, in a compact expandable card for the employee flow. After
 * any change it calls onChanged so the parent reloads the BOQ (backend recomputes item + grand totals).
 */

const inr = (n?: number) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const UNITS = ['sqft', 'nos', 'running ft', 'kg', 'litre', 'set'];

export default function BoqItemEditor({ boqId, item, editable, onChanged }: {
  boqId: number; item: BoqItem; editable: boolean; onChanged: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mat, setMat] = useState({ materialName: '', quantity: '1', unit: 'nos', wastePercent: '0', sellingRate: '' });
  const [lab, setLab] = useState({ workType: '', quantity: '1', rate: '', contractorName: '' });

  const run = async (fn: () => Promise<any>) => { setBusy(true); try { await fn(); await onChanged(); } finally { setBusy(false); } };
  const editQty = (q: string) => { const n = parseFloat(q); if (!isNaN(n)) run(() => boqApi.updateItem(boqId, item.id!, { quantity: n })); };

  const addMaterial = () => {
    if (!mat.materialName.trim()) return;
    run(() => boqApi.addMaterial(boqId, item.id!, {
      materialName: mat.materialName.trim(), quantity: parseFloat(mat.quantity) || 0, unit: mat.unit,
      wastePercent: parseFloat(mat.wastePercent) || 0, sellingRate: parseFloat(mat.sellingRate) || 0,
      costPrice: parseFloat(mat.sellingRate) || 0,
    })).then(() => setMat({ materialName: '', quantity: '1', unit: 'nos', wastePercent: '0', sellingRate: '' }));
  };
  const addLabour = () => {
    if (!lab.workType.trim() && !lab.rate) return;
    run(() => boqApi.addLabour(boqId, item.id!, {
      workType: lab.workType.trim() || 'Labour', quantity: parseFloat(lab.quantity) || 1,
      rate: parseFloat(lab.rate) || 0, contractorName: lab.contractorName.trim() || undefined,
    })).then(() => setLab({ workType: '', quantity: '1', rate: '', contractorName: '' }));
  };

  const mats = item.materials || [];
  const labs = item.labours || [];

  return (
    <div className="border-b last:border-0">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-3 py-2 text-left">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{item.itemName}</p>
          <p className="text-[11px] text-muted-foreground">
            {item.quantity ?? ''} {item.unit} · {inr(item.amount)}
            {(mats.length > 0 || labs.length > 0) && <span> · {mats.length}m {labs.length}l</span>}
          </p>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="space-y-3 border-t bg-muted/20 px-3 py-3">
          {/* Item qty */}
          {editable && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Quantity</span>
              <input inputMode="decimal" defaultValue={item.quantity ?? ''} onBlur={(e) => editQty(e.target.value)}
                className="w-16 rounded-md border bg-background px-2 py-1 text-center" />
              <span className="text-muted-foreground">{item.unit}</span>
              <button type="button" onClick={() => run(() => boqApi.deleteItem(boqId, item.id!))} className="ml-auto flex items-center gap-1 text-destructive"><Trash2 className="h-3.5 w-3.5" /> Remove item</button>
            </div>
          )}

          {/* Materials */}
          <div>
            <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase text-muted-foreground"><Package className="h-3 w-3" /> Materials</p>
            {mats.map((m) => (
              <div key={m.id} className="flex items-center gap-2 rounded-md bg-background px-2 py-1.5 text-xs">
                <span className="min-w-0 flex-1 truncate">{m.materialName}</span>
                <span className="text-muted-foreground">{m.finalQuantity ?? m.quantity} {m.unit}{m.wastePercent ? ` · +${m.wastePercent}%` : ''}</span>
                <span className="font-medium">{inr(m.amount)}</span>
                {editable && <button type="button" onClick={() => run(() => boqApi.deleteMaterial(boqId, item.id!, m.id!))} className="text-destructive"><Trash2 className="h-3 w-3" /></button>}
              </div>
            ))}
            {editable && (
              <div className="mt-1 space-y-1.5 rounded-md border border-dashed p-2">
                <input value={mat.materialName} onChange={(e) => setMat({ ...mat, materialName: e.target.value })} placeholder="Material name (e.g. BWP Ply 18mm)" className="w-full rounded-md border bg-background px-2 py-1.5 text-xs" />
                <div className="grid grid-cols-4 gap-1.5">
                  <Num label="Qty" v={mat.quantity} on={(x) => setMat({ ...mat, quantity: x })} />
                  <div>
                    <span className="block text-center text-[9px] text-muted-foreground">Unit</span>
                    <select value={mat.unit} onChange={(e) => setMat({ ...mat, unit: e.target.value })} className="w-full rounded-md border bg-background px-1 py-1 text-center text-xs">{UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select>
                  </div>
                  <Num label="Waste %" v={mat.wastePercent} on={(x) => setMat({ ...mat, wastePercent: x })} />
                  <Num label="Rate ₹" v={mat.sellingRate} on={(x) => setMat({ ...mat, sellingRate: x })} />
                </div>
                <button type="button" onClick={addMaterial} disabled={busy || !mat.materialName.trim()} className="flex w-full items-center justify-center gap-1 rounded-md bg-primary/10 py-1.5 text-xs font-medium text-primary disabled:opacity-50"><Plus className="h-3 w-3" /> Add material</button>
              </div>
            )}
          </div>

          {/* Labour + contractor */}
          <div>
            <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase text-muted-foreground"><HardHat className="h-3 w-3" /> Labour / Contractor</p>
            {labs.map((l) => (
              <div key={l.id} className="flex items-center gap-2 rounded-md bg-background px-2 py-1.5 text-xs">
                <span className="min-w-0 flex-1 truncate">{l.workType}{l.contractorName ? ` · ${l.contractorName}` : ''}</span>
                <span className="text-muted-foreground">{l.quantity} × {inr(l.rate)}</span>
                <span className="font-medium">{inr(l.amount)}</span>
                {editable && <button type="button" onClick={() => run(() => boqApi.deleteLabour(boqId, item.id!, l.id!))} className="text-destructive"><Trash2 className="h-3 w-3" /></button>}
              </div>
            ))}
            {editable && (
              <div className="mt-1 space-y-1.5 rounded-md border border-dashed p-2">
                <div className="grid grid-cols-2 gap-1.5">
                  <input value={lab.workType} onChange={(e) => setLab({ ...lab, workType: e.target.value })} placeholder="Work (Carpentry…)" className="rounded-md border bg-background px-2 py-1.5 text-xs" />
                  <input value={lab.contractorName} onChange={(e) => setLab({ ...lab, contractorName: e.target.value })} placeholder="Contractor (optional)" className="rounded-md border bg-background px-2 py-1.5 text-xs" />
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <Num label="Qty" v={lab.quantity} on={(x) => setLab({ ...lab, quantity: x })} />
                  <Num label="Rate ₹" v={lab.rate} on={(x) => setLab({ ...lab, rate: x })} />
                  <button type="button" onClick={addLabour} disabled={busy || (!lab.workType.trim() && !lab.rate)} className="mt-3 flex items-center justify-center gap-1 rounded-md bg-primary/10 text-xs font-medium text-primary disabled:opacity-50"><Plus className="h-3 w-3" /> Add</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Num({ label, v, on }: { label: string; v: string; on: (v: string) => void }) {
  return (
    <div>
      <span className="block text-center text-[9px] text-muted-foreground">{label}</span>
      <input inputMode="decimal" value={v} onChange={(e) => on(e.target.value)} className="w-full rounded-md border bg-background px-1 py-1 text-center text-xs" />
    </div>
  );
}

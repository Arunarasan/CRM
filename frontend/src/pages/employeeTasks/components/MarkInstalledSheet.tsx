import { BaseInput } from '@/components/ui/input';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Package } from 'lucide-react';
import { employeeTaskApi } from '@/api/employeeTaskApi';
import ImageCaptureField from '@/components/ImageCaptureField';
import type { InstallOrderInfo } from '@/types/employeeTask';

const PAY_METHODS = [
  { v: 'CASH', label: 'Cash' },
  { v: 'UPI', label: 'UPI' },
  { v: 'CARD', label: 'Card' },
  { v: 'BANK_TRANSFER', label: 'Bank' },
];

const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const STATUS_WORD: Record<string, string> = { ORDER: 'Order', PROCESS: 'Process', COMPLETED: 'Completed', DELIVERED: 'Installed' };

/** The stitched orders this installation task installs — shown on the task so the installer knows when to go. */
export function InstallOrderCard({ info }: { info: InstallOrderInfo }) {
  const due = Number(info.balanceDue ?? 0);
  return (
    <div className="rounded-2xl border border-[#E4DECF] bg-white p-3.5">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-[#2B302D]">
        <Package className="h-4 w-4 text-[#9B6B32]" /> Order to install{info.invoiceNumber ? ` · Bill ${info.invoiceNumber}` : ''}
      </div>
      <ul className="mt-2 space-y-1.5">
        {info.orders.map((o) => (
          <li key={o.id} className="flex items-center gap-2 text-[13px]">
            <span className="font-mono font-bold text-[#2B302D]">{o.code}</span>
            <span className="text-[#8A8F86]">{o.itemCount} item{o.itemCount === 1 ? '' : 's'}</span>
            <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium ${
              o.status === 'COMPLETED' || o.status === 'DELIVERED' ? 'bg-[#E6F2EC] text-[#0A573B]' : 'bg-[#F3EFE6] text-[#7A6A4F]'}`}>
              {STATUS_WORD[o.status] ?? o.status}
            </span>
          </li>
        ))}
      </ul>
      <p className={`mt-2.5 rounded-lg px-2.5 py-2 text-[12px] ${info.installed ? 'bg-[#E6F2EC] text-[#0A573B]'
        : info.ready ? 'bg-[#E6F2EC] text-[#0A573B]' : 'bg-[#FFF6E5] text-[#8A5A12]'}`}>
        {info.installed ? 'Installed — done.'
          : info.ready ? 'Ready — take it from the shop, install it, then tap Mark Installed.'
          : 'Still being stitched — you will get a notification when it is Completed.'}
      </p>
      {!info.installed && (
        <p className="mt-1.5 text-[12px] text-[#4B524E]">
          {due > 0 ? <>Collect <b className="text-[#8A5A12]">{inr(due)}</b> from the customer.</> : 'Bill fully paid.'}
        </p>
      )}
    </div>
  );
}

/**
 * Installer on site: collect what is still owed (installers may take payment), then mark the orders
 * installed — that hands them over and closes this task. The full balance must be collected; leaving
 * money due needs a manager.
 */
export default function MarkInstalledSheet({ taskId, info, open, onOpenChange, onDone }: {
  taskId: number; info: InstallOrderInfo; open: boolean; onOpenChange: (open: boolean) => void; onDone: () => void;
}) {
  const due = Number(info.balanceDue ?? 0);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('CASH');
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (open) { setAmount(due > 0 ? String(due) : ''); setError(''); } }, [open, due]);

  const paying = Math.max(0, Number(amount) || 0);
  const left = Math.max(0, Math.round((due - paying) * 100) / 100);

  const save = async () => {
    setError('');
    if (paying > due + 0.001) { setError(`Only ${inr(due)} is due.`); return; }
    if (left > 0) { setError(`Collect the full ${inr(due)} to finish, or ask a manager.`); return; }
    setSaving(true);
    try {
      await employeeTaskApi.markInstalled(taskId, {
        payments: paying > 0 ? [{ method, amount: paying }] : [],
        deliveredTo: to.trim() || undefined,
        note: note.trim() || undefined,
        photoUrl: photo || undefined,
      });
      onOpenChange(false);
      onDone();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Could not mark it installed.');
    } finally {
      setSaving(false);
    }
  };

  const field = 'w-full rounded-xl border border-[#DDE2DE] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0A573B]';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#0A573B]">
            <CheckCircle2 className="h-5 w-5" /> Mark installed
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <p className="text-[13px] text-[#4B524E]">{info.orders.map((o) => o.code).join(', ')}</p>
          {due > 0 ? (
            <div className="rounded-xl border border-[#F0DDB4] bg-[#FFF8EA] p-3">
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] font-medium text-[#8A5A12]">Balance due</span>
                <span className="text-lg font-black text-[#8A5A12]">{inr(due)}</span>
              </div>
              <Label className="mt-2 block">Collected now</Label>
              <div className="relative mt-1.5">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#8A8F86]">₹</span>
                <BaseInput type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${field} pl-7`} />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PAY_METHODS.map((m) => (
                  <button key={m.v} type="button" onClick={() => setMethod(m.v)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${method === m.v ? 'border-[#0A573B] bg-[#0A573B] text-white' : 'border-[#DDE2DE] bg-white text-[#4B524E]'}`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="rounded-xl bg-[#E6F2EC] px-3 py-2 text-[13px] font-medium text-[#0A573B]">Bill fully paid</p>
          )}
          <div>
            <Label>Installed for (optional)</Label>
            <BaseInput value={to} onChange={(e) => setTo(e.target.value)} className={`${field} mt-1.5`} placeholder="Customer name" />
          </div>
          <div>
            <Label>Note (optional)</Label>
            <BaseInput value={note} onChange={(e) => setNote(e.target.value)} className={`${field} mt-1.5`} placeholder="Anything to note" />
          </div>
          <ImageCaptureField module="BUNDLE" value={photo} onChange={(r) => setPhoto(r.url)} label="Installed photo (optional)" allowEdit />
          {error && <p className="rounded-md bg-destructive/15 p-2 text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="flex-1 border-[#D7DED8]">Cancel</Button>
          <Button onClick={save} disabled={saving} className="flex-1 bg-[#0A573B] text-white hover:bg-[#06452F]">
            {saving ? 'Saving…' : paying > 0 ? `Collect ${inr(paying)} & finish` : 'Mark installed'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

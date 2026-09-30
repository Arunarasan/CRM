import { BaseInput } from '@/components/ui/input';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Wallet } from 'lucide-react';
import { employeeTaskApi } from '@/api/employeeTaskApi';

const PAY_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card'];

/**
 * Record an amount the customer paid, collected on the project execution task. It's saved as a
 * pending entry the admin verifies — the employee just enters the value and it awaits approval.
 */
export default function CollectPaymentSheet({ taskId, open, onOpenChange, onSaved }: {
  taskId: number; open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setError('');
    if (!amount.trim() || Number(amount) <= 0) { setError('Enter the amount collected.'); return; }
    setSaving(true);
    try {
      await employeeTaskApi.collectPayment(taskId, { amount: amount.trim(), method, note: note.trim() || undefined });
      setAmount(''); setNote('');
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Could not record the payment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#0A573B]">
            <Wallet className="h-5 w-5" /> Record payment collected
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <Label>Amount the customer paid</Label>
            <div className="mt-1.5 flex gap-2">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#8A8F86]">₹</span>
                <BaseInput type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-xl border border-[#DDE2DE] bg-white py-2.5 pl-7 pr-3 text-sm outline-none focus:border-[#0A573B]" placeholder="0" />
              </div>
              <select value={method} onChange={(e) => setMethod(e.target.value)}
                className="rounded-xl border border-[#DDE2DE] bg-white px-2 text-sm outline-none focus:border-[#0A573B]">
                {PAY_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div>
            <Label>Note (optional)</Label>
            <BaseInput value={note} onChange={(e) => setNote(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[#DDE2DE] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0A573B]" placeholder="Reference, remark…" />
          </div>
          <p className="text-[11.5px] text-[#8A8F86]">This stays pending until an admin verifies and confirms it.</p>
          {error && <p className="rounded-md bg-destructive/15 p-2 text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="flex-1 border-[#D7DED8]">Cancel</Button>
          <Button onClick={save} disabled={saving} className="flex-1 bg-[#0A573B] text-white hover:bg-[#06452F]">
            {saving ? 'Saving…' : 'Record payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

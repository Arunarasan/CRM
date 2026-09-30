import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CheckCircle2 } from 'lucide-react';
import { employeeTaskApi } from '@/api/employeeTaskApi';
import { ProgressMediaItem } from '@/types/employeeTask';
import { runOrQueue } from '@/hooks/useOfflineQueue';
import MediaCapture from './MediaCapture';

/**
 * One-tap completion confirmation. Everything here is optional — the employee can just
 * confirm. If they add a closing note or photo we record it as a final progress update
 * (existing /progress endpoint) before completing (existing /complete endpoint); no new
 * backend behaviour, no extra screen.
 */
const PAY_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card'];

export default function CompleteSheet({ taskId, open, onOpenChange, onDone, execution }: {
  taskId: number; open: boolean; onOpenChange: (open: boolean) => void; onDone: () => void;
  /** Project execution task: ask how much the customer paid and submit for admin approval. */
  execution?: boolean;
}) {
  const [note, setNote] = useState('');
  const [media, setMedia] = useState<ProgressMediaItem[]>([]);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const confirm = async () => {
    setError('');
    setSaving(true);
    try {
      // Execution task: record the amount the customer paid first (goes to admin for verification).
      if (execution && amount.trim() && Number(amount) > 0) {
        await employeeTaskApi.collectPayment(taskId, { amount: amount.trim(), method });
      }
      if (note.trim() || media.length) {
        await employeeTaskApi.addProgress(taskId, {
          progressPercent: 100,
          remarks: note.trim() || undefined,
          media: media.length ? media : undefined,
        });
      }
      await runOrQueue({
        method: 'post',
        url: `/employee-tasks/${taskId}/complete`,
        payload: note.trim() ? { remarks: note.trim() } : undefined,
        description: 'Complete task',
      });
      setNote(''); setMedia([]); setAmount('');
      onOpenChange(false);
      onDone();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Could not complete the task.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#0A573B]">
            <CheckCircle2 className="h-5 w-5" /> Complete task
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <p className="text-[13px] text-[#5E655D]">
            {execution
              ? 'Record how much the customer paid, then submit. An admin verifies the amount and approves — the project is marked 100% complete only after approval.'
              : 'Add a closing note or photo if useful — both are optional.'}
          </p>
          {execution && (
            <div className="rounded-xl border border-[#EFE9DC] bg-[#FBFAF6] p-3">
              <Label>How much did the customer pay?</Label>
              <div className="mt-1.5 flex gap-2">
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#8A8F86]">₹</span>
                  <input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-xl border border-[#DDE2DE] bg-white py-2.5 pl-7 pr-3 text-sm outline-none focus:border-[#0A573B]" placeholder="0" />
                </div>
                <select value={method} onChange={(e) => setMethod(e.target.value)}
                  className="rounded-xl border border-[#DDE2DE] bg-white px-2 text-sm outline-none focus:border-[#0A573B]">
                  {PAY_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <p className="mt-1.5 text-[11.5px] text-[#8A8F86]">Leave blank if nothing was collected. It stays pending until an admin verifies it.</p>
            </div>
          )}
          {error && <p className="rounded-md bg-destructive/15 p-2 text-xs text-destructive">{error}</p>}
          <div>
            <Label>Completion note</Label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
              className="mt-1.5 w-full rounded-xl border border-[#DDE2DE] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0A573B]" placeholder="What was done?" />
          </div>
          <div>
            <Label>Photo / attachment</Label>
            <div className="mt-1.5"><MediaCapture media={media} onChange={setMedia} /></div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="flex-1 border-[#D7DED8]">Cancel</Button>
          <Button onClick={confirm} disabled={saving} className="flex-1 bg-[#0A573B] text-white hover:bg-[#06452F]">
            {saving ? 'Submitting…' : execution ? 'Submit for approval' : 'Mark completed'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

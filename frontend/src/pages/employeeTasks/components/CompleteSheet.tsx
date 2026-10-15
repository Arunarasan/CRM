import { BaseInput } from '@/components/ui/input';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CheckCircle2 } from 'lucide-react';
import { employeeTaskApi } from '@/api/employeeTaskApi';
import { ProgressMediaItem } from '@/types/employeeTask';
import { runOrQueue } from '@/hooks/useOfflineQueue';
import MediaCapture from './MediaCapture';
import { useT, useTr } from '@/i18n';

/**
 * One-tap completion confirmation. Everything here is optional — the employee can just
 * confirm. If they add a closing note or photo we record it as a final progress update
 * (existing /progress endpoint) before completing (existing /complete endpoint); no new
 * backend behaviour, no extra screen.
 */
const PAY_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card'];

export default function CompleteSheet({ taskId, open, onOpenChange, onDone, execution, due }: {
  taskId: number; open: boolean; onOpenChange: (open: boolean) => void; onDone: () => void;
  /** Project execution task: ask how much the customer paid and submit for admin approval. */
  execution?: boolean;
  /** Amount the customer still has to pay — shown above the payment box. */
  due?: number | null;
}) {
  const { t } = useT();
  const tr = useTr();
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
        description: t('pw.cs.title'),
      });
      setNote(''); setMedia([]); setAmount('');
      onOpenChange(false);
      onDone();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || t('pw.cs.failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#0A573B]">
            <CheckCircle2 className="h-5 w-5" /> {t('pw.cs.title')}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <p className="text-[13px] text-[#5E655D]">
            {execution
              ? t('pw.cs.execIntro')
              : t('pw.cs.intro')}
          </p>
          {execution && due != null && (
            <div className="flex items-center justify-between rounded-xl border border-[#F0DDB8] bg-[#FDF6E7] px-3.5 py-3">
              <span className="text-[13px] font-medium text-[#7A5A22]">{tr('pw.cs.dueNow', 'Customer needs to pay')}</span>
              <span className="text-lg font-bold text-[#7A5A22]">₹{Math.max(0, due).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            </div>
          )}
          {execution && (
            <div className="rounded-xl border border-[#EFE9DC] bg-[#FBFAF6] p-3">
              <Label>{t('pw.cs.howMuch')}</Label>
              <div className="mt-1.5 flex gap-2">
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#8A8F86]">₹</span>
                  <BaseInput type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-xl border border-[#DDE2DE] bg-white py-2.5 pl-7 pr-3 text-sm outline-none focus:border-[#0A573B]" placeholder="0" />
                </div>
                <select value={method} onChange={(e) => setMethod(e.target.value)}
                  className="rounded-xl border border-[#DDE2DE] bg-white px-2 text-sm outline-none focus:border-[#0A573B]">
                  {PAY_METHODS.map((m) => <option key={m} value={m}>{t(`pw.pay.${m}`)}</option>)}
                </select>
              </div>
              <p className="mt-1.5 text-[11.5px] text-[#8A8F86]">{t('pw.cs.blankNote')}</p>
            </div>
          )}
          {error && <p className="rounded-md bg-destructive/15 p-2 text-xs text-destructive">{error}</p>}
          <div>
            <Label>{t('pw.cs.noteLabel')}</Label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
              className="mt-1.5 w-full rounded-xl border border-[#DDE2DE] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0A573B]" placeholder={t('pw.cs.notePh')} />
          </div>
          <div>
            <Label>{t('pw.cs.attach')}</Label>
            <div className="mt-1.5"><MediaCapture media={media} onChange={setMedia} /></div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="flex-1 border-[#D7DED8]">{t('pw.cancel')}</Button>
          <Button onClick={confirm} disabled={saving} className="flex-1 bg-[#0A573B] text-white hover:bg-[#06452F]">
            {saving ? t('pw.cs.submitting') : execution ? t('pw.cs.submitApproval') : t('pw.cs.markCompleted')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

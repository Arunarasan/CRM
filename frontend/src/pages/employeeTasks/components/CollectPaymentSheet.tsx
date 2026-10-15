import { BaseInput } from '@/components/ui/input';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Wallet, X } from 'lucide-react';
import { employeeTaskApi } from '@/api/employeeTaskApi';
import { resolveFileUrl } from '@/lib/uploadFile';
import PhotoPickButtons from './PhotoPickButtons';
import { useT } from '@/i18n';

const PAY_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card'];
// Modes that leave a reference number to quote (UPI txn id, cheque / transfer number).
const NEEDS_REF = ['UPI', 'Bank Transfer', 'Cheque', 'Card'];

/**
 * Record an amount the customer paid, collected on the project execution task. It's saved as a
 * pending entry the admin verifies — the employee just enters the value and it awaits approval.
 */
export default function CollectPaymentSheet({ taskId, open, onOpenChange, onSaved }: {
  taskId: number; open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => void;
}) {
  const { t } = useT();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [note, setNote] = useState('');
  const [reference, setReference] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const uploadReceipt = async (files: File[]) => {
    if (!files[0]) return;
    setUploading(true); setError('');
    try { setReceiptUrl((await employeeTaskApi.uploadFile(files[0], 'PAYMENT')).fileUrl); }
    catch { setError(t('pw.common.photoFailed')); }
    finally { setUploading(false); }
  };

  const save = async () => {
    setError('');
    if (!amount.trim() || Number(amount) <= 0) { setError(t('pw.cp.enterAmount')); return; }
    setSaving(true);
    try {
      await employeeTaskApi.collectPayment(taskId, {
        amount: amount.trim(), method, note: note.trim() || undefined,
        reference: reference.trim() || undefined, receiptUrl: receiptUrl || undefined,
      });
      setAmount(''); setNote(''); setReference(''); setReceiptUrl('');
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || t('pw.cp.failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#0A573B]">
            <Wallet className="h-5 w-5" /> {t('pw.cp.title')}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <Label>{t('pw.cp.amount')}</Label>
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
          </div>
          {NEEDS_REF.includes(method) && (
            <div>
              <Label>{method === 'Cheque' ? t('pw.cp.chequeNo') : t('pw.cp.txnNo')}</Label>
              <BaseInput value={reference} onChange={(e) => setReference(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[#DDE2DE] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0A573B]" placeholder={t('pw.cp.refPh')} />
            </div>
          )}
          <div>
            <Label>{t('pw.cp.noteOpt')}</Label>
            <BaseInput value={note} onChange={(e) => setNote(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[#DDE2DE] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0A573B]" placeholder={t('pw.cp.notePh')} />
          </div>
          <div>
            <Label>{t('pw.cp.receipt')}</Label>
            {receiptUrl ? (
              <div className="relative mt-1.5 h-20 w-20">
                <img src={resolveFileUrl(receiptUrl)} alt={t('pw.cp.receiptAlt')} className="h-full w-full rounded-lg border object-cover" />
                <button type="button" onClick={() => setReceiptUrl('')} aria-label={t('pw.common.removePhoto')}
                  className="absolute -right-1.5 -top-1.5 rounded-full bg-black/70 p-1 text-white"><X className="h-3 w-3" /></button>
              </div>
            ) : (
              <div className="mt-1.5"><PhotoPickButtons onPicked={uploadReceipt} busy={uploading} /></div>
            )}
          </div>
          <p className="text-[11.5px] text-[#8A8F86]">{t('pw.cp.pendingNote')}</p>
          {error && <p className="rounded-md bg-destructive/15 p-2 text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="flex-1 border-[#D7DED8]">{t('pw.cancel')}</Button>
          <Button onClick={save} disabled={saving || uploading} className="flex-1 bg-[#0A573B] text-white hover:bg-[#06452F]">
            {saving ? t('pw.prog.saving') : t('pw.cp.record')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

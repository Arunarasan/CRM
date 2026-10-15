import { useState } from 'react';
import { Ban, Clock, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toast';
import { useTr } from '@/i18n';

export interface PendingCancel { id: number; reasonCode: string; reason: string; targetType: string; requesterName: string }

const REASONS = [
  { code: 'CUSTOMER_CANCELLED', label: 'Customer cancelled' },
  { code: 'OTHER_ISSUE', label: 'Other issue' },
];

/**
 * "Cancel" on any task: the employee says why (customer cancelled / other issue). It goes to an admin;
 * once approved the lead is marked Lost, the project is cancelled, or the task itself is cancelled.
 */
export default function CancelTaskButton({ taskId, canRequest, pending, targetType, onChanged }: {
  taskId: number; canRequest: boolean; pending?: PendingCancel | null;
  /** What approval will do: LEAD (mark Lost), PROJECT (cancel project) or TASK. */
  targetType: 'LEAD' | 'PROJECT' | 'TASK'; onChanged: () => void;
}) {
  const tr = useTr();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('CUSTOMER_CANCELLED');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const what = targetType === 'LEAD' ? tr('pw.cancel.lead', 'mark the lead as Lost')
    : targetType === 'PROJECT' ? tr('pw.cancel.project', 'cancel the project')
    : tr('pw.cancel.task', 'cancel this task');

  if (pending) {
    return (
      <div className="flex items-start gap-2 rounded-2xl border border-[#F0DDB8] bg-[#FDF6E7] p-3.5 text-[13px] text-[#7A5A22]">
        <Clock className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{tr('pw.cancel.waiting', 'Cancel request sent - waiting for admin approval.')}</span>
      </div>
    );
  }
  if (!canRequest) return null;

  const submit = async () => {
    if (!reason.trim()) return;
    setSaving(true);
    try {
      await api.post(`/employee-portal/tasks/${taskId}/cancel-request`, { reasonCode: code, reason: reason.trim() });
      toast.success(tr('pw.cancel.sent', 'Sent to admin for approval.'));
      setOpen(false); setReason('');
      onChanged();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || tr('pw.cancel.failed', 'Could not send the request.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#E9C4C0] bg-white py-3 text-[14px] font-semibold text-[#B94B45] active:scale-[0.99]">
        <Ban className="h-4 w-4" /> {tr('pw.cancel.button', 'Cancel task')}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-[#B94B45]">{tr('pw.cancel.title', 'Request cancellation')}</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4">
            <p className="text-[13px] text-[#5E655D]">
              {tr('pw.cancel.intro', 'An admin must approve this. If approved, it will')} <b>{what}</b>.
            </p>
            <div>
              <Label>{tr('pw.cancel.why', 'Why?')}</Label>
              <select value={code} onChange={(e) => setCode(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[#DDE2DE] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0A573B]">
                {REASONS.map((r) => <option key={r.code} value={r.code}>{tr(`pw.cancel.${r.code}`, r.label)}</option>)}
              </select>
            </div>
            <div>
              <Label>{tr('pw.cancel.what', 'What happened?')}</Label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4}
                className="mt-1.5 w-full rounded-xl border border-[#DDE2DE] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0A573B]"
                placeholder={tr('pw.cancel.ph', 'Tell the admin what the customer said or what went wrong')} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving} className="flex-1">{tr('pw.team.close', 'Close')}</Button>
            <Button onClick={submit} disabled={saving || !reason.trim()} className="flex-1 bg-[#B94B45] text-white hover:bg-[#9E3A35]">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : tr('pw.cancel.submit', 'Send for approval')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { BaseInput } from '@/components/ui/input';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Rocket } from 'lucide-react';
import type { LeadProjectStatus } from '@/api/boqApi';
import { employeeTaskApi } from '@/api/employeeTaskApi';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/toast';

const METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card'];

/**
 * Closes the deal from the BOQ & Quotation task: approve the lead's quotation and convert it to a
 * project. An advance is optional — entering it records the first project payment; leaving it blank
 * just approves & converts. Both employees and admins can do this (server enforces).
 */
export default function ConvertProjectSheet({ leadId, leadProject, open, onOpenChange, onDone }: {
  leadId: number;
  /** The lead's existing project: this quote then updates it (same project, new quote no.) — no new one. */
  leadProject?: LeadProjectStatus | null;
  open: boolean; onOpenChange: (open: boolean) => void; onDone: () => void;
}) {
  const update = !!leadProject;
  const { hasAuthority, isAdmin } = useAuth();
  // Admins / project managers apply the update at once; anyone else's goes to an admin for approval.
  const needsApproval = update && !(isAdmin || hasAuthority('ROLE_PROJECT_MANAGER'));
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const confirm = async () => {
    setSaving(true); setError('');
    try {
      await employeeTaskApi.convertProject(leadId, {
        advanceAmount: amount.trim() || undefined,
        advancePaymentMethod: amount.trim() ? method : undefined,
      });
      setAmount('');
      if (needsApproval) toast.success('Sent to admin for approval');
      onOpenChange(false);
      onDone();
    } catch (e: any) {
      setError(e?.response?.data?.message || (update ? 'Could not update the project.' : 'Could not create the project.'));
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#0A573B]">
            <Rocket className="h-5 w-5" /> {update ? 'Update Project' : 'Create Project'}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {update ? (
            <>
              <p className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  This lead already has project <span className="font-semibold">{leadProject!.projectCode}</span>.
                  No new project is created — this quote replaces its quotation.
                </span>
              </p>
              <div className="rounded-md border p-2 text-sm">
                <div className="flex justify-between gap-2"><span className="text-[#7A817C]">Current quote</span>
                  <span>{leadProject!.quotationNumber || '—'} · {inr(leadProject!.contractValue)}</span></div>
                <div className="flex justify-between gap-2 font-semibold"><span>This quote</span>
                  <span>{inr(leadProject!.sheetTotal)}</span></div>
              </div>
              <p className="text-xs text-[#5B625E]">
                {needsApproval
                  ? 'This goes to an admin for approval. Once approved, the project\'s items, work and payment plan follow the new quote. An advance you record waits for approval on Payments.'
                  : 'The project\'s items, work and payment plan follow the new quote. Record an advance now if the customer has paid one.'}
              </p>
            </>
          ) : (
            <p className="text-sm text-[#5B625E]">
              This approves the quotation and turns it into a project. Record an advance now if the
              customer has paid one — otherwise leave it blank to just confirm the project.
            </p>
          )}
          <div>
            <Label>Advance received (optional)</Label>
            <BaseInput inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="₹ amount" className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
          </div>
          {amount.trim() && (
            <div>
              <Label>Payment method</Label>
              <select value={method} onChange={(e) => setMethod(e.target.value)}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm">
                {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          )}
          {error && <p className="rounded-md bg-[#FBE2E0] p-2 text-xs text-[#B94B45]">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="flex-1">Cancel</Button>
          <Button onClick={confirm} disabled={saving} className="flex-1 bg-[#0A573B] hover:bg-[#0A573B]/90">
            {saving ? (update ? 'Sending…' : 'Creating…')
              : needsApproval ? 'Send for Approval' : update ? 'Update Project' : 'Create Project'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const inr = (v?: number | null) => `₹${Number(v ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Rocket } from 'lucide-react';
import { employeeTaskApi } from '@/api/employeeTaskApi';

const METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card'];

/**
 * Closes the deal from the BOQ & Quotation task: approve the lead's quotation and convert it to a
 * project. An advance is optional — entering it records the first project payment; leaving it blank
 * just approves & converts. Both employees and admins can do this (server enforces).
 */
export default function ConvertProjectSheet({ leadId, open, onOpenChange, onDone }: {
  leadId: number; open: boolean; onOpenChange: (open: boolean) => void; onDone: () => void;
}) {
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
      onOpenChange(false);
      onDone();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not create the project.');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#0A573B]">
            <Rocket className="h-5 w-5" /> Create Project
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-[#5B625E]">
            This approves the quotation and turns it into a project. Record an advance now if the
            customer has paid one — otherwise leave it blank to just confirm the project.
          </p>
          <div>
            <Label>Advance received (optional)</Label>
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)}
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
            {saving ? 'Creating…' : 'Create Project'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { BaseInput } from '@/components/ui/input';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Rocket, Send, X } from 'lucide-react';
import type { LeadProjectStatus } from '@/api/boqApi';
import { employeeTaskApi } from '@/api/employeeTaskApi';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/toast';
import { projectRequestApi } from '@/api/projectRequestApi';
import { resolveFileUrl } from '@/lib/uploadFile';
import PhotoPickButtons from './PhotoPickButtons';

const METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card'];

/**
 * Closes the deal from the employee portal's quote page. A new project is never created here: the
 * customer's advance (optional — amount, method, reference, receipt photo) is collected and SENT to an
 * admin, who creates the project on approval (lead page → Sales Journey → Quote). This holds for anyone
 * using the portal, admins included — admins create projects directly from the lead page instead.
 * A lead that already has a project gets "Update Project" (quote change) as before.
 */
export default function ConvertProjectSheet({ leadId, leadProject, open, onOpenChange, onDone, onRequested }: {
  leadId: number;
  /** The lead's existing project: this quote then updates it (same project, new quote no.) — no new one. */
  leadProject?: LeadProjectStatus | null;
  open: boolean; onOpenChange: (open: boolean) => void; onDone: () => void;
  /** A field employee's request was sent (the page stays, showing it waits for an admin). */
  onRequested?: () => void;
}) {
  const update = !!leadProject;
  const { hasAuthority, isAdmin } = useAuth();
  // Every new project from the employee portal waits for an admin to approve it.
  const sendForApproval = !update;
  const [reference, setReference] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [note, setNote] = useState('');
  const [uploading, setUploading] = useState(false);
  // Admins / project managers apply the update at once; anyone else's goes to an admin for approval.
  const needsApproval = update && !(isAdmin || hasAuthority('ROLE_PROJECT_MANAGER'));
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const uploadProof = async (files: File[]) => {
    if (!files[0]) return;
    setUploading(true); setError('');
    try { setProofUrl((await employeeTaskApi.uploadFile(files[0], 'PAYMENT')).fileUrl); }
    catch { setError('Photo upload failed. Try again.'); }
    finally { setUploading(false); }
  };

  const confirm = async () => {
    setSaving(true); setError('');
    try {
      if (sendForApproval) {
        if (amount.trim() && !(Number(amount.replace(/,/g, '')) > 0)) { setError('Enter a valid advance amount, or leave it blank.'); return; }
        await projectRequestApi.send(leadId, {
          advanceAmount: amount.trim() || undefined,
          paymentMethod: amount.trim() ? method : undefined,
          referenceNumber: amount.trim() ? reference.trim() || undefined : undefined,
          proofUrl: proofUrl || undefined,
          note: note.trim() || undefined,
        });
        setAmount(''); setReference(''); setProofUrl(''); setNote('');
        toast.success('Sent to admin for approval');
        onOpenChange(false);
        (onRequested ?? onDone)();
        return;
      }
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
            {sendForApproval ? <Send className="h-5 w-5" /> : <Rocket className="h-5 w-5" />}
            {update ? 'Update Project' : sendForApproval ? 'Send for Approval' : 'Create Project'}
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
          ) : sendForApproval ? (
            <p className="text-sm text-[#5B625E]">
              The customer agreed to this quote. It goes to an admin, who creates the project after checking it.
              If the customer paid an advance, record it here — it's added to the project's payments on approval.
            </p>
          ) : (
            <p className="text-sm text-[#5B625E]">
              This approves the quotation and turns it into a project. Record an advance now if the
              customer has paid one — otherwise leave it blank to just confirm the project.
            </p>
          )}
          <div>
            <Label>{sendForApproval ? 'Advance from customer ₹ (optional)' : 'Advance received (optional)'}</Label>
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
          {sendForApproval && amount.trim() && (
            <div>
              <Label>UPI / transaction reference (optional)</Label>
              <BaseInput value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. UTR 4321…"
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
            </div>
          )}
          {sendForApproval && (
            <>
              <div>
                <Label>Receipt / payment screenshot (optional)</Label>
                {proofUrl ? (
                  <div className="relative mt-1 h-24 w-24">
                    <img src={resolveFileUrl(proofUrl)} alt="Payment proof" className="h-full w-full rounded-md border object-cover" />
                    <button type="button" onClick={() => setProofUrl('')} aria-label="Remove photo"
                      className="absolute -right-1.5 -top-1.5 rounded-full bg-black/70 p-1 text-white"><X className="h-3 w-3" /></button>
                  </div>
                ) : (
                  <div className="mt-1"><PhotoPickButtons onPicked={uploadProof} busy={uploading} /></div>
                )}
              </div>
              <div>
                <Label>Note for the admin (optional)</Label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
                  placeholder="e.g. Balance after installation; customer wants start next week"
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
              </div>
            </>
          )}
          {error && <p className="rounded-md bg-[#FBE2E0] p-2 text-xs text-[#B94B45]">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="flex-1">Cancel</Button>
          <Button onClick={confirm} disabled={saving || uploading} className="flex-1 bg-[#0A573B] hover:bg-[#0A573B]/90">
            {saving ? (update || sendForApproval ? 'Sending…' : 'Creating…')
              : needsApproval || sendForApproval ? 'Send for Approval' : update ? 'Update Project' : 'Create Project'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const inr = (v?: number | null) => `₹${Number(v ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

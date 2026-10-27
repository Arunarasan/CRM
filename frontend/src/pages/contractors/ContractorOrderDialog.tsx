import { useEffect, useState } from "react";
import { contractorApi } from "@/api/contractorApi";
import { bundleApi, type Bundle } from "@/api/bundleApi";
import { assignmentLookups, type ProjectOption } from "@/api/smartAssignmentApi";
import type { ContractorOrderRow } from "@/types/contractor";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SearchableSelect from "@/components/ui/searchable-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Give (or edit) an order: a job on a project with the amount agreed to pay the contractor. */
export default function ContractorOrderDialog({
  open, onClose, contractorId, contractorName, existing, onDone,
}: {
  open: boolean;
  onClose: () => void;
  contractorId: number;
  contractorName: string;
  existing?: ContractorOrderRow;
  onDone: () => void;
}) {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [project, setProject] = useState(existing?.projectId != null ? String(existing.projectId) : "");
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [bundle, setBundle] = useState(existing?.bundleId != null ? String(existing.bundleId) : "");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [amount, setAmount] = useState(existing ? String(existing.amount) : "");
  const [date, setDate] = useState(existing?.orderDate ?? new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => { assignmentLookups.projects().then(setProjects).catch(() => {}); }, []);
  useEffect(() => { bundleApi.search({ size: 200 }).then((r) => setBundles(r.content ?? [])).catch(() => {}); }, []);

  const submit = async () => {
    const amt = Number(amount);
    if (!title.trim()) { toast.error("Describe the job."); return; }
    if (!(amt > 0)) { toast.error("Enter the amount agreed for this order."); return; }
    setBusy(true);
    try {
      const body = { projectId: project ? Number(project) : undefined, bundleId: bundle ? Number(bundle) : undefined, title: title.trim(), amount: amt, orderDate: date, notes: notes || undefined };
      if (existing) await contractorApi.updateOrder(existing.id, body);
      else await contractorApi.createOrder(contractorId, body);
      toast.success(existing ? "Order updated" : `Order given to ${contractorName}`);
      onDone();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? e?.response?.data?.error ?? "Could not save the order.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit order" : `Give order to ${contractorName}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Project <span className="text-xs font-normal text-slate-400">(optional)</span></Label>
            <SearchableSelect
              value={project}
              onChange={setProject}
              placeholder="No project — general work"
              options={[{ value: "", label: "No project — general work" },
                ...projects.map((p) => ({ value: String(p.id), label: p.projectName }))]}
            />
          </div>
          <div>
            <Label>Order <span className="text-xs font-normal text-slate-400">(optional)</span></Label>
            <SearchableSelect
              value={bundle}
              onChange={setBundle}
              placeholder="No order"
              options={[{ value: "", label: "No order" },
                ...bundles.map((b) => ({ value: String(b.id), label: b.code, hint: b.customerName ?? undefined }))]}
            />
          </div>
          <div>
            <Label>Job / what he will do</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Wardrobe carpentry — master bedroom" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Amount to pay him (₹)</Label>
              <Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <Label>Order date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button onClick={submit} disabled={busy}>{busy ? "Saving…" : existing ? "Save order" : "Give order"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

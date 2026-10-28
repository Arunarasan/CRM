import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { leadApi, type LeadManager } from "./leadApi";
import type { UserSummary } from "./constants";
import { selectClass } from "./fields";

/** Admin names the lead manager: the one employee who edits the quote and converts without approval. */
export default function LeadManagerDialog({
  open, onOpenChange, leadId, users, currentUserId, onChanged,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; leadId: number; users: UserSummary[];
  currentUserId?: number | null; onChanged: (m: LeadManager) => void;
}) {
  const [userId, setUserId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setUserId(currentUserId ? String(currentUserId) : ""); }, [open, currentUserId]);

  const save = (id: number | null) => {
    setSaving(true);
    leadApi.setLeadManager(leadId, id)
      .then((res) => { toast.success(id ? "Lead manager set" : "Lead manager removed"); onOpenChange(false); onChanged(res.data); })
      .catch((err) => toast.error(err?.response?.data?.message || "Couldn't change the lead manager."))
      .finally(() => setSaving(false));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Lead manager</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            The lead manager can build and edit this lead&apos;s quote and create the project without admin approval.
            Other employees can no longer edit the quote. Admins always can.
          </p>
          <select className={selectClass} value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">Select employee...</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
          </select>
          <div className="flex justify-between gap-2 pt-2 border-t">
            <Button type="button" variant="outline" disabled={saving || !currentUserId} onClick={() => save(null)}>Remove manager</Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="button" disabled={saving || !userId || userId === String(currentUserId ?? "")} onClick={() => save(Number(userId))}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

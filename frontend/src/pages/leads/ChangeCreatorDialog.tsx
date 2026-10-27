import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { leadApi } from "./leadApi";
import type { UserSummary, LeadCreator } from "./constants";
import { selectClass } from "./fields";

export default
function ChangeCreatorDialog({
  open, onOpenChange, leadId, users, currentUserId, onChanged,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; leadId: number; users: UserSummary[];
  currentUserId?: number; onChanged: (c: LeadCreator) => void;
}) {
  const [userId, setUserId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setUserId(currentUserId ? String(currentUserId) : ""); }, [open, currentUserId]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setSaving(true);
    leadApi.changeCreatedBy(leadId, Number(userId))
      .then((res) => { toast.success("Lead by updated"); onOpenChange(false); onChanged(res.data); })
      .catch((err) => toast.error(err?.response?.data?.message || "Couldn't change who created this lead."))
      .finally(() => setSaving(false));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Change Lead By</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-slate-500">Credit this lead to a different employee. The change is recorded on the timeline.</p>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Employee</label>
            <select className={selectClass} required value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Select employee...</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !userId || userId === String(currentUserId ?? "")}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

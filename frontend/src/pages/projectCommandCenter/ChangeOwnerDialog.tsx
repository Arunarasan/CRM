import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import api from "@/lib/api";
import { selectClass } from "@/pages/leads/fields";
import type { UserSummary } from "@/pages/leads/constants";

/**
 * Project "Owner" = the Project Manager. The team endpoint sets the PM and Assistant Manager together
 * (a null clears a slot), so the current assistant is always sent back unchanged.
 */
export default function ChangeOwnerDialog({
  open, onOpenChange, projectId, users, ownerId, assistantId, onChanged,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; projectId: number; users: UserSummary[];
  ownerId?: number; assistantId?: number; onChanged: () => void;
}) {
  const [owner, setOwner] = useState("");
  const [assistant, setAssistant] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setOwner(ownerId ? String(ownerId) : "");
    setAssistant(assistantId ? String(assistantId) : "");
  }, [open, ownerId, assistantId]);

  const unchanged = owner === String(ownerId ?? "") && assistant === String(assistantId ?? "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (owner && owner === assistant) { toast.error("Owner and assistant must be different people."); return; }
    setSaving(true);
    api.put(`/projects/${projectId}/team`, {
      projectManagerId: owner ? Number(owner) : null,
      assistantManagerId: assistant ? Number(assistant) : null,
    })
      .then(() => { toast.success("Project owner updated"); onOpenChange(false); onChanged(); })
      .catch((err) => toast.error(err?.response?.data?.message || "Couldn't update the project owner."))
      .finally(() => setSaving(false));
  };

  const options = (
    <>
      <option value="">Not assigned</option>
      {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Project Owner</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-slate-500">The owner is the Project Manager. They are added to the project's execution task.</p>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Owner (Project Manager)</label>
            <select className={selectClass} value={owner} onChange={(e) => setOwner(e.target.value)}>{options}</select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Assistant Manager</label>
            <select className={selectClass} value={assistant} onChange={(e) => setAssistant(e.target.value)}>{options}</select>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || unchanged}>{saving ? "Saving..." : "Save"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

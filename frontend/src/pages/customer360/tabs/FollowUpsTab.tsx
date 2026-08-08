import { useState } from "react";
import { CalendarClock, Check, RotateCcw, X, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import EmptyState from "../components/EmptyState";
import { usePagedTab } from "../usePagedTab";
import customer360Api from "@/lib/customer360Api";
import type { CustomerFollowUp, FollowUpBucket } from "@/types/customer360";

const BUCKETS: { key: FollowUpBucket; label: string }[] = [
  { key: "OVERDUE", label: "Overdue" },
  { key: "TODAY", label: "Today's Follow-ups" },
  { key: "UPCOMING", label: "Upcoming" },
  { key: "COMPLETED", label: "Completed" },
  { key: "CANCELLED", label: "Cancelled" },
];

const PRIORITY_VARIANT: Record<string, "destructive" | "warning" | "secondary"> = {
  HIGH: "destructive",
  MEDIUM: "warning",
  LOW: "secondary",
};

export default function FollowUpsTab({ customerId }: { customerId: string }) {
  const { items, isLoading, reload } = usePagedTab<CustomerFollowUp>(
    (_page, size) => customer360Api.getFollowUps(customerId, undefined, 0, size),
    [customerId],
    100
  );
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [rescheduling, setRescheduling] = useState<CustomerFollowUp | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [newFollowUp, setNewFollowUp] = useState({ purpose: "", priority: "MEDIUM", followupDate: "", method: "Call", notes: "" });

  const grouped = BUCKETS.map((b) => ({ ...b, items: items.filter((f) => f.bucket === b.key) }));

  const addFollowUp = () => {
    customer360Api.addFollowUp(customerId, newFollowUp).then(() => {
      setIsAddOpen(false);
      setNewFollowUp({ purpose: "", priority: "MEDIUM", followupDate: "", method: "Call", notes: "" });
      reload();
    });
  };

  const complete = (f: CustomerFollowUp) => {
    const notes = window.prompt("Completion notes (optional):") || undefined;
    customer360Api.completeFollowUp(customerId, f.id, notes).then(reload);
  };

  const cancel = (f: CustomerFollowUp) => {
    const reason = window.prompt("Reason for cancelling (optional):") || undefined;
    customer360Api.cancelFollowUp(customerId, f.id, reason).then(reload);
  };

  const submitReschedule = () => {
    if (!rescheduling || !rescheduleDate) return;
    customer360Api.rescheduleFollowUp(customerId, rescheduling.id, rescheduleDate).then(() => {
      setRescheduling(null);
      setRescheduleDate("");
      reload();
    });
  };

  if (isLoading) {
    return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setIsAddOpen(true)}><Plus className="w-4 h-4" /> Add Follow-up</Button>
      </div>

      {items.length === 0 ? (
        <Card><CardContent className="pt-6"><EmptyState icon={CalendarClock} title="No follow-ups scheduled" description="Add a follow-up to keep this relationship on track." /></CardContent></Card>
      ) : (
        grouped.filter((g) => g.items.length > 0).map((group) => (
          <Card key={group.key}>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{group.label} ({group.items.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {group.items.map((f) => (
                <div key={f.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-muted/40 rounded-lg p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{f.purpose || "Follow-up"}</span>
                      {f.priority && <Badge variant={PRIORITY_VARIANT[f.priority] || "secondary"}>{f.priority}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {f.followupDate ? new Date(f.followupDate).toLocaleDateString() : ""} {f.followupTime || ""} · {f.method || "—"} · {f.assignedEmployeeName || "Unassigned"}
                    </div>
                    {f.completionNotes && <div className="text-xs mt-1 italic">{f.completionNotes}</div>}
                  </div>
                  {group.key !== "COMPLETED" && group.key !== "CANCELLED" && (
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => complete(f)}><Check className="w-3.5 h-3.5" /> Complete</Button>
                      <Button size="sm" variant="outline" onClick={() => { setRescheduling(f); setRescheduleDate(f.followupDate); }}><RotateCcw className="w-3.5 h-3.5" /> Reschedule</Button>
                      <Button size="sm" variant="outline" onClick={() => cancel(f)}><X className="w-3.5 h-3.5" /> Cancel</Button>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader><DialogTitle>Add Follow-up</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Purpose</Label><Input value={newFollowUp.purpose} onChange={(e) => setNewFollowUp({ ...newFollowUp, purpose: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Priority</Label>
                <select className="w-full h-9 rounded-md border border-input px-3 text-sm" value={newFollowUp.priority} onChange={(e) => setNewFollowUp({ ...newFollowUp, priority: e.target.value })}>
                  <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option>
                </select>
              </div>
              <div className="space-y-1"><Label>Follow-up Date</Label><Input type="date" value={newFollowUp.followupDate} onChange={(e) => setNewFollowUp({ ...newFollowUp, followupDate: e.target.value })} /></div>
            </div>
            <div className="space-y-1"><Label>Method</Label><Input value={newFollowUp.method} onChange={(e) => setNewFollowUp({ ...newFollowUp, method: e.target.value })} /></div>
            <div className="space-y-1"><Label>Notes</Label><textarea className="w-full min-h-[70px] rounded-md border border-input px-3 py-2 text-sm" value={newFollowUp.notes} onChange={(e) => setNewFollowUp({ ...newFollowUp, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button onClick={addFollowUp} disabled={!newFollowUp.followupDate}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rescheduling} onOpenChange={(open) => !open && setRescheduling(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>Reschedule Follow-up</DialogTitle></DialogHeader>
          <div className="space-y-1"><Label>New Date</Label><Input type="date" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduling(null)}>Cancel</Button>
            <Button onClick={submitReschedule} disabled={!rescheduleDate}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

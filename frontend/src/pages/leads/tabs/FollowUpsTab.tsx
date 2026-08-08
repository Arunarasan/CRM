import { useState } from "react";
import { PhoneCall, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import EmptyState from "@/pages/customer360/components/EmptyState";
import { leadApi } from "../leadApi";
import { COMMUNICATION_TYPES, PRIORITIES, PRIORITY_STYLES, formatDate } from "../constants";
import { CheckboxField, SelectField, TextAreaField, TextField } from "../fields";
import { ListSkeleton, useLeadList } from "./shared";

const EMPTY = {
  followupDate: new Date().toISOString().slice(0, 10),
  followupTime: "",
  method: "Phone Call",
  notes: "",
  customerResponse: "",
  outcome: "",
  priority: "Medium",
  nextFollowupDate: "",
  nextFollowupTime: "",
  reminderEnabled: true,
};

export default function FollowUpsTab({ leadId, onChanged }: { leadId: string; onChanged: () => void }) {
  const { items, loading, reload } = useLeadList<any>(() => leadApi.getFollowups(leadId), [leadId]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  const set = (key: string) => (value: any) => setForm((f: any) => ({ ...f, [key]: value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form };
    ["followupTime", "nextFollowupDate", "nextFollowupTime"].forEach((k) => { if (!payload[k]) delete payload[k]; });
    leadApi.addFollowup(leadId, payload)
      .then(() => { setOpen(false); setForm({ ...EMPTY }); reload(); onChanged(); })
      .catch(console.error)
      .finally(() => setSaving(false));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Follow-up History</CardTitle>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Log Follow-up</Button>
      </CardHeader>
      <CardContent>
        {loading ? <ListSkeleton /> : items.length === 0 ? (
          <EmptyState icon={PhoneCall} title="No follow-ups yet" description="Log every customer conversation so the history is never lost." />
        ) : (
          <div className="space-y-3">
            {items.map((f) => (
              <div key={f.id} className="border rounded-lg p-4 bg-muted/30">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <span>{formatDate(f.followupDate)}{f.followupTime ? ` · ${f.followupTime}` : ""}</span>
                    <span className="text-xs px-2 py-0.5 bg-background border rounded-full">{f.method || "—"}</span>
                    {f.priority && (
                      <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full font-bold ${PRIORITY_STYLES[f.priority] || ""}`}>{f.priority}</span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">by {f.performedBy?.name || "—"}</span>
                </div>
                {f.notes && <p className="text-sm mt-2"><span className="text-muted-foreground">Discussion:</span> {f.notes}</p>}
                {f.customerResponse && <p className="text-sm mt-1"><span className="text-muted-foreground">Customer response:</span> {f.customerResponse}</p>}
                <div className="flex flex-wrap gap-4 mt-2 text-xs text-muted-foreground">
                  {f.outcome && <span>Outcome: <span className="text-foreground font-medium">{f.outcome}</span></span>}
                  {f.nextFollowupDate && <span>Next follow-up: <span className="text-foreground font-medium">{formatDate(f.nextFollowupDate)}{f.nextFollowupTime ? ` ${f.nextFollowupTime}` : ""}</span></span>}
                  {f.status && <span>Status: {f.status}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Log Follow-up</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <TextField label="Date" type="date" required value={form.followupDate} onChange={set("followupDate")} />
              <TextField label="Time" type="time" value={form.followupTime} onChange={set("followupTime")} />
              <SelectField label="Method" value={form.method} onChange={set("method")} options={COMMUNICATION_TYPES} allowEmpty={false} />
              <SelectField label="Priority" value={form.priority} onChange={set("priority")} options={PRIORITIES} allowEmpty={false} />
            </div>
            <TextAreaField label="Discussion" value={form.notes} onChange={set("notes")} />
            <TextAreaField label="Customer Response" value={form.customerResponse} onChange={set("customerResponse")} />
            <TextField label="Outcome" value={form.outcome} onChange={set("outcome")} placeholder="e.g. Interested, Call back later" />
            <div className="grid grid-cols-2 gap-4">
              <TextField label="Next Follow-up Date" type="date" value={form.nextFollowupDate} onChange={set("nextFollowupDate")} />
              <TextField label="Next Follow-up Time" type="time" value={form.nextFollowupTime} onChange={set("nextFollowupTime")} />
            </div>
            <CheckboxField label="Create a reminder for the next follow-up" checked={form.reminderEnabled} onChange={set("reminderEnabled")} />
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Follow-up"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

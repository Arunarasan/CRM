import { useState } from "react";
import { MessageSquare, Plus, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import EmptyState from "@/pages/customer360/components/EmptyState";
import { leadApi } from "../leadApi";
import { COMMUNICATION_TYPES, formatDate } from "../constants";
import { SelectField, TextAreaField, TextField } from "../fields";
import { ListSkeleton, useLeadList } from "./shared";

const TYPE_ICONS: Record<string, string> = {
  "Phone Call": "📞", "WhatsApp": "💬", "Email": "✉️", "Meeting": "🤝",
  "Office Visit": "🏢", "Site Visit": "📍", "SMS": "📱", "Video Call": "🎥",
};

const EMPTY = {
  communicationType: "Phone Call",
  direction: "Outgoing",
  communicationDate: new Date().toISOString().slice(0, 10),
  communicationTime: "",
  summary: "",
  detailedNotes: "",
  attachmentUrl: "",
};

export default function CommunicationsTab({ leadId, onChanged }: { leadId: string; onChanged: () => void }) {
  const { items, loading, reload } = useLeadList<any>(() => leadApi.getCommunications(leadId), [leadId]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  const set = (key: string) => (value: any) => setForm((f: any) => ({ ...f, [key]: value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form };
    if (!payload.communicationTime) delete payload.communicationTime;
    if (!payload.attachmentUrl) delete payload.attachmentUrl;
    leadApi.addCommunication(leadId, payload)
      .then(() => { setOpen(false); setForm({ ...EMPTY }); reload(); onChanged(); })
      .catch(console.error)
      .finally(() => setSaving(false));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Communication Timeline</CardTitle>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Log Communication</Button>
      </CardHeader>
      <CardContent>
        {loading ? <ListSkeleton /> : items.length === 0 ? (
          <EmptyState icon={MessageSquare} title="No communications logged" description="Calls, WhatsApp, emails, meetings and site visits will appear here as a timeline." />
        ) : (
          <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-1 before:bottom-1 before:w-px before:bg-border">
            {items.map((c) => (
              <div key={c.id} className="relative">
                <span className="absolute -left-6 top-1 h-4 w-4 rounded-full bg-background border-2 border-primary flex items-center justify-center text-[8px]" />
                <div className="border rounded-lg p-3 bg-muted/30">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium">
                      {TYPE_ICONS[c.communicationType] || "•"} {c.communicationType}
                      {c.direction && <span className="ml-2 text-xs px-1.5 py-0.5 bg-background border rounded-full">{c.direction}</span>}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(c.communicationDate)}{c.communicationTime ? ` · ${c.communicationTime}` : ""} · {c.performedBy?.name || "—"}
                    </span>
                  </div>
                  {c.summary && <p className="text-sm mt-1 font-medium">{c.summary}</p>}
                  {c.detailedNotes && <p className="text-sm mt-1 text-muted-foreground whitespace-pre-wrap">{c.detailedNotes}</p>}
                  {c.attachmentUrl && (
                    <a href={c.attachmentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2">
                      <Paperclip className="h-3 w-3" /> Attachment
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Log Communication</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <SelectField label="Type" value={form.communicationType} onChange={set("communicationType")} options={COMMUNICATION_TYPES} allowEmpty={false} />
              <SelectField label="Direction" value={form.direction} onChange={set("direction")} options={["Outgoing", "Incoming"]} allowEmpty={false} />
              <TextField label="Date" type="date" required value={form.communicationDate} onChange={set("communicationDate")} />
              <TextField label="Time" type="time" value={form.communicationTime} onChange={set("communicationTime")} />
            </div>
            <TextField label="Summary" value={form.summary} onChange={set("summary")} placeholder="One-line summary" />
            <TextAreaField label="Detailed Notes" value={form.detailedNotes} onChange={set("detailedNotes")} />
            <TextField label="Attachment URL" value={form.attachmentUrl} onChange={set("attachmentUrl")} placeholder="Link to recording, screenshot, email..." />
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

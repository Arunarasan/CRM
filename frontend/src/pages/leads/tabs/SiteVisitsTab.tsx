import { useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import EmptyState from "@/pages/customer360/components/EmptyState";
import { leadApi } from "../leadApi";
import { formatDate, statusStyle } from "../constants";
import { SelectField, TextAreaField, TextField } from "../fields";
import { ListSkeleton, useLeadList } from "./shared";

const EMPTY = {
  visitType: "Initial Visit",
  scheduledDate: new Date().toISOString().slice(0, 10),
  priority: "Medium",
  visitNotes: "",
  locationAddress: "",
};

export default function SiteVisitsTab({ leadId, onChanged }: { leadId: string; onChanged: () => void }) {
  const { items, loading, reload } = useLeadList<any>(() => leadApi.getSiteVisits(leadId), [leadId]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  const set = (key: string) => (value: any) => setForm((f: any) => ({ ...f, [key]: value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    leadApi.scheduleSiteVisit(leadId, form)
      .then(() => { setOpen(false); setForm({ ...EMPTY }); reload(); onChanged(); })
      .catch(console.error)
      .finally(() => setSaving(false));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Site Visits</CardTitle>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Schedule Visit</Button>
      </CardHeader>
      <CardContent>
        {loading ? <ListSkeleton /> : items.length === 0 ? (
          <EmptyState icon={MapPin} title="No site visits" description="Schedule a site visit to inspect the property and capture requirements." />
        ) : (
          <div className="space-y-3">
            {items.map((v) => (
              <div key={v.id} className="border rounded-lg p-4 flex flex-wrap items-center justify-between gap-3 bg-muted/30">
                <div>
                  <div className="flex items-center gap-2">
                    <Link to={`/site-visits/${v.id}`} className="font-medium text-sm text-primary hover:underline">{v.visitNumber}</Link>
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${statusStyle(v.status)}`}>{v.status}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {v.visitType || "Visit"} · {formatDate(v.scheduledDate)}
                    {v.locationAddress ? ` · ${v.locationAddress}` : ""}
                  </div>
                  {v.visitNotes && <p className="text-sm mt-1">{v.visitNotes}</p>}
                </div>
                <Link to={`/site-visits/${v.id}`}>
                  <Button variant="outline" size="sm">Open</Button>
                </Link>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Schedule Site Visit</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <SelectField label="Purpose" value={form.visitType} onChange={set("visitType")}
                options={["Initial Visit", "Measurement", "Design Discussion", "Final Inspection", "Follow-up Visit"]} allowEmpty={false} />
              <TextField label="Visit Date" type="date" required value={form.scheduledDate} onChange={set("scheduledDate")} />
              <SelectField label="Priority" value={form.priority} onChange={set("priority")} options={["Low", "Medium", "High", "Urgent"]} allowEmpty={false} />
            </div>
            <TextAreaField label="Location Address" rows={2} value={form.locationAddress} onChange={set("locationAddress")} placeholder="Defaults to the lead's site address" />
            <TextAreaField label="Remarks" value={form.visitNotes} onChange={set("visitNotes")} />
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Scheduling..." : "Schedule"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

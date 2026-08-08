import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GitBranch, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { measurementApi } from "@/api/measurementApi";
import { STATUS_STYLES, type Measurement, type MeasurementHistoryEntry } from "@/types/measurement";
import { TextAreaField } from "../../leads/fields";
import { ListSkeleton } from "../../leads/tabs/shared";
import EmptyState from "../../customer360/components/EmptyState";
import { formatDateTime, useMeasurementSubResource } from "../helpers";

export default function RevisionsTab({ measurementId, canWrite, isLatestRevision, onChanged }: {
  measurementId: number; canWrite: boolean; isLatestRevision: boolean; onChanged: () => void;
}) {
  const { items: family, loading, reload } = useMeasurementSubResource<Measurement>(
    () => measurementApi.getRevisionFamily(measurementId), [measurementId]);
  const { items: history } = useMeasurementSubResource<MeasurementHistoryEntry>(
    () => measurementApi.getRevisionHistory(measurementId), [measurementId]);
  const [formOpen, setFormOpen] = useState(false);

  if (loading) return <ListSkeleton rows={3} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground">{family.length} revision{family.length === 1 ? "" : "s"}</h3>
        {canWrite && isLatestRevision && (
          <Button size="sm" onClick={() => setFormOpen(true)}><Plus className="h-4 w-4 mr-2" /> Create Revision</Button>
        )}
      </div>

      {family.length === 0 ? (
        <EmptyState icon={GitBranch} title="No revisions" description="This is the only version of this measurement." />
      ) : (
        <div className="border rounded-xl divide-y bg-card">
          {family.map((m) => (
            <Link key={m.id} to={`/measurements/${m.id}`}
              className={`flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50 transition-colors ${m.id === measurementId ? "bg-muted/40" : ""}`}>
              <div>
                <div className="text-sm font-medium">
                  {m.measurementNumber} <span className="text-xs text-muted-foreground">· revision {m.revisionNumber}</span>
                  {m.id === measurementId && <span className="ml-2 text-xs text-primary font-semibold">(viewing)</span>}
                </div>
                <div className="text-xs text-muted-foreground">{m.measurementType} · {formatDateTime(m.createdAt)}</div>
              </div>
              <Badge className={STATUS_STYLES[m.status || ""] || ""}>{m.status}</Badge>
            </Link>
          ))}
        </div>
      )}

      {history.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Revision History</h4>
          <div className="space-y-3">
            {history.map((h) => (
              <div key={h.id} className="border rounded-xl p-3 bg-card text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Version {h.versionNumber}</span>
                  <span className="text-xs text-muted-foreground">{h.changedBy} · {formatDateTime(h.changedAt)}</span>
                </div>
                {h.changeReason && <p className="text-xs text-muted-foreground mt-1">{h.changeReason}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <CreateRevisionDialog open={formOpen} onOpenChange={setFormOpen} measurementId={measurementId}
        onSaved={() => { reload(); onChanged(); }} />
    </div>
  );
}

function CreateRevisionDialog({ open, onOpenChange, measurementId, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; measurementId: number; onSaved: () => void;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    measurementApi.createRevision(measurementId, reason || undefined)
      .then((created) => { onOpenChange(false); setReason(""); onSaved(); navigate(`/measurements/${created.id}`); })
      .catch(console.error)
      .finally(() => setSaving(false));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Create Revision</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This clones all rooms and items into a new revision for site rechecks or customer-requested changes.
          </p>
          <TextAreaField label="Reason" value={reason} onChange={setReason} placeholder="e.g. Customer requested wardrobe resize" />
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Creating..." : "Create Revision"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

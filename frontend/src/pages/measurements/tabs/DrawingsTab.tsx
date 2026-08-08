import { useState } from "react";
import { FileText, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { measurementApi } from "@/api/measurementApi";
import { DRAWING_TYPES, type MeasurementDrawing } from "@/types/measurement";
import { SelectField, TextAreaField, TextField } from "../../leads/fields";
import { ListSkeleton } from "../../leads/tabs/shared";
import EmptyState from "../../customer360/components/EmptyState";
import { formatDate, useMeasurementSubResource } from "../helpers";
import FileUploadField from "@/components/FileUploadField";
import { resolveFileUrl } from "@/lib/uploadFile";

export default function DrawingsTab({ measurementId, canWrite, onChanged }: {
  measurementId: number; canWrite: boolean; onChanged: () => void;
}) {
  const { items: drawings, loading, reload } = useMeasurementSubResource<MeasurementDrawing>(
    () => measurementApi.getDrawings(measurementId), [measurementId]);
  const [formOpen, setFormOpen] = useState(false);

  const refresh = () => { reload(); onChanged(); };

  const remove = (d: MeasurementDrawing) => {
    if (!d.id || !confirm(`Remove drawing "${d.fileName}"?`)) return;
    measurementApi.deleteDrawing(measurementId, d.id).then(refresh).catch(console.error);
  };

  if (loading) return <ListSkeleton rows={3} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground">{drawings.length} drawing{drawings.length === 1 ? "" : "s"}</h3>
        {canWrite && (
          <Button size="sm" onClick={() => setFormOpen(true)}><Plus className="h-4 w-4 mr-2" /> Upload Drawing</Button>
        )}
      </div>

      {drawings.length === 0 ? (
        <EmptyState icon={FileText} title="No drawings uploaded"
          description="Floor plans, CAD files, sketches and blueprints for this measurement will appear here." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {drawings.map((d) => (
            <div key={d.id} className="border rounded-xl p-4 bg-card space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">{d.drawingType || "Drawing"}</div>
                  <a href={resolveFileUrl(d.filePath)} target="_blank" rel="noreferrer" className="font-medium text-sm text-primary hover:underline truncate block">
                    {d.fileName}
                  </a>
                </div>
                {canWrite && (
                  <button type="button" onClick={() => remove(d)} className="text-destructive hover:opacity-70 shrink-0">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              {d.description && <p className="text-xs text-muted-foreground line-clamp-2">{d.description}</p>}
              <div className="text-[11px] text-muted-foreground flex justify-between">
                <span>{d.uploadedBy?.name || "—"}</span>
                <span>{formatDate(d.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <DrawingFormDialog open={formOpen} onOpenChange={setFormOpen} measurementId={measurementId} onSaved={refresh} />
    </div>
  );
}

function DrawingFormDialog({ open, onOpenChange, measurementId, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; measurementId: number; onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<MeasurementDrawing>>({ drawingType: DRAWING_TYPES[0] });
  const [saving, setSaving] = useState(false);

  const set = (key: keyof MeasurementDrawing) => (value: any) => setForm((f) => ({ ...f, [key]: value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fileName || !form.filePath) return;
    setSaving(true);
    measurementApi.addDrawing(measurementId, form as MeasurementDrawing)
      .then(() => { onOpenChange(false); setForm({ drawingType: DRAWING_TYPES[0] }); onSaved(); })
      .catch(console.error)
      .finally(() => setSaving(false));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Upload Drawing</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <SelectField label="Drawing Type" value={form.drawingType} onChange={set("drawingType")} options={DRAWING_TYPES} allowEmpty={false} />
          <FileUploadField
            label="File"
            required
            module="MEASUREMENT"
            accept="application/pdf,image/*,.dwg,.dxf,.doc,.docx"
            value={form.filePath}
            onChange={({ url, fileName }) => setForm((f) => ({
              ...f,
              filePath: url,
              fileName: fileName || (url ? f.fileName : ""),
            }))}
          />
          <TextField label="File Name" required value={form.fileName} onChange={set("fileName")} placeholder="floor-plan-v1.pdf" />
          <TextAreaField label="Description" value={form.description} onChange={set("description")} />
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !form.fileName || !form.filePath}>{saving ? "Uploading..." : "Upload"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

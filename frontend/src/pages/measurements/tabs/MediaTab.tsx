import { useState } from "react";
import { Image as ImageIcon, Plus, Trash2, Video, Mic, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { measurementApi } from "@/api/measurementApi";
import { MEDIA_CATEGORIES, type MeasurementMedia, type MeasurementRoom } from "@/types/measurement";
import { Field, SelectField, TextAreaField, TextField, selectClass } from "../../leads/fields";
import { ListSkeleton } from "../../leads/tabs/shared";
import EmptyState from "../../customer360/components/EmptyState";
import { formatDate, useMeasurementSubResource } from "../helpers";
import FileUploadField from "@/components/FileUploadField";
import { resolveFileUrl } from "@/lib/uploadFile";

const MEDIA_TYPE_ICON: Record<string, React.ElementType> = {
  Image: ImageIcon, Video: Video, Audio: Mic, PDF: FileText,
};

/** Guess the media type from a file name's extension, falling back to the current value. */
function inferMediaType(fileName: string, fallback = "Image"): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  if (["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "heic"].includes(ext)) return "Image";
  if (["mp4", "mov", "avi", "mkv", "webm", "m4v"].includes(ext)) return "Video";
  if (["mp3", "wav", "ogg", "m4a", "aac", "webm"].includes(ext)) return "Audio";
  if (ext === "pdf") return "PDF";
  return fallback;
}

export default function MediaTab({ measurementId, rooms, canWrite, onChanged }: {
  measurementId: number; rooms: MeasurementRoom[]; canWrite: boolean; onChanged: () => void;
}) {
  const { items: media, loading, reload } = useMeasurementSubResource<MeasurementMedia>(
    () => measurementApi.getMedia(measurementId), [measurementId]);
  const [formOpen, setFormOpen] = useState(false);

  const refresh = () => { reload(); onChanged(); };

  const remove = (m: MeasurementMedia) => {
    if (!m.id || !confirm(`Remove "${m.fileName}"?`)) return;
    measurementApi.deleteMedia(measurementId, m.id).then(refresh).catch(console.error);
  };

  if (loading) return <ListSkeleton rows={3} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground">{media.length} file{media.length === 1 ? "" : "s"}</h3>
        {canWrite && <Button size="sm" onClick={() => setFormOpen(true)}><Plus className="h-4 w-4 mr-2" /> Upload Media</Button>}
      </div>

      {media.length === 0 ? (
        <EmptyState icon={ImageIcon} title="No photos or videos yet"
          description="Before photos, room photos, measurement photos, videos and voice notes will appear here." />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
          {media.map((m) => {
            const Icon = MEDIA_TYPE_ICON[m.mediaType || "Image"] || ImageIcon;
            return (
              <div key={m.id} className="border rounded-xl overflow-hidden bg-card group">
                <a href={resolveFileUrl(m.filePath)} target="_blank" rel="noreferrer"
                  className="aspect-square flex flex-col items-center justify-center gap-1 bg-muted/50 text-muted-foreground hover:text-primary transition-colors p-2 text-center">
                  <Icon className="h-6 w-6" />
                  <span className="text-[10px] line-clamp-2">{m.fileName}</span>
                </a>
                <div className="p-2 space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded-full truncate">{m.category || m.mediaType}</span>
                    {canWrite && (
                      <button type="button" onClick={() => remove(m)} className="text-destructive hover:opacity-70 shrink-0">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  {m.measurementRoom?.roomName && <div className="text-[10px] text-muted-foreground truncate">{m.measurementRoom.roomName}</div>}
                  <div className="text-[10px] text-muted-foreground">{formatDate(m.createdAt)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <MediaFormDialog open={formOpen} onOpenChange={setFormOpen} measurementId={measurementId} rooms={rooms} onSaved={refresh} />
    </div>
  );
}

function MediaFormDialog({ open, onOpenChange, measurementId, rooms, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; measurementId: number; rooms: MeasurementRoom[]; onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<MeasurementMedia> & { mediaType?: string }>({ category: MEDIA_CATEGORIES[0], mediaType: "Image" });
  const [roomId, setRoomId] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (key: keyof MeasurementMedia) => (value: any) => setForm((f) => ({ ...f, [key]: value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fileName || !form.filePath) return;
    setSaving(true);
    const payload: any = { ...form };
    if (roomId) payload.measurementRoom = { id: Number(roomId) };
    measurementApi.addMedia(measurementId, payload)
      .then(() => { onOpenChange(false); setForm({ category: MEDIA_CATEGORIES[0], mediaType: "Image" }); setRoomId(""); onSaved(); })
      .catch(console.error)
      .finally(() => setSaving(false));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Upload Media</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Category" value={form.category} onChange={set("category")} options={MEDIA_CATEGORIES} allowEmpty={false} />
            <SelectField label="Media Type" value={form.mediaType} onChange={set("mediaType")} options={["Image", "Video", "Audio", "PDF"]} allowEmpty={false} />
          </div>
          <FileUploadField
            label="File"
            required
            module="MEASUREMENT"
            value={form.filePath}
            onChange={({ url, fileName }) => setForm((f) => ({
              ...f,
              filePath: url,
              fileName: fileName || (url ? f.fileName : ""),
              mediaType: fileName ? inferMediaType(fileName, f.mediaType) : f.mediaType,
            }))}
          />
          <TextField label="File Name" required value={form.fileName} onChange={set("fileName")} placeholder="living-room-01.jpg" />
          <Field label="Room (optional)">
            <select className={selectClass} value={roomId} onChange={(e) => setRoomId(e.target.value)}>
              <option value="">Not room-specific</option>
              {rooms.map((r) => <option key={r.id} value={r.id}>{r.roomName}</option>)}
            </select>
          </Field>
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

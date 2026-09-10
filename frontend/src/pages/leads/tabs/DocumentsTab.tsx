import { useState } from "react";
import { FolderOpen, Plus, Trash2, FileIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import EmptyState from "@/pages/customer360/components/EmptyState";
import { leadApi } from "../leadApi";
import { DOCUMENT_CATEGORIES, formatDate } from "../constants";
import { SelectField, TextAreaField, TextField } from "../fields";
import { ListSkeleton, useLeadList } from "./shared";
import FileUploadField from "@/components/FileUploadField";
import ImageCaptureField from "@/components/ImageCaptureField";
import AudioCaptureField, { type CapturedAudio } from "@/components/AudioCaptureField";
import { resolveFileUrl } from "@/lib/uploadFile";

const EMPTY = { fileName: "", fileUrl: "", category: "Property Images", documentType: "", description: "" };

// Classify a document so photos render as thumbnails and voice notes as inline players.
// Prefer the stored documentType (set on capture); fall back to the file extension.
const extOf = (doc: any) => ((doc.fileName || doc.fileUrl || "").split("?")[0].split(".").pop() || "").toLowerCase();
const IMAGE_EXT = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "heic", "heif"];
const AUDIO_EXT = ["mp3", "wav", "ogg", "webm", "m4a", "aac", "opus", "oga"];
const isImageDoc = (doc: any) => doc.documentType === "Image" || IMAGE_EXT.includes(extOf(doc));
const isAudioDoc = (doc: any) => doc.documentType === "Audio" || AUDIO_EXT.includes(extOf(doc));

export default function DocumentsTab({ leadId }: { leadId: string }) {
  const { items, loading, reload } = useLeadList<any>(() => leadApi.getDocuments(leadId), [leadId]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  const set = (key: string) => (value: any) => setForm((f: any) => ({ ...f, [key]: value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    leadApi.addDocument(leadId, form)
      .then(() => { setOpen(false); setForm({ ...EMPTY }); reload(); })
      .catch(console.error)
      .finally(() => setSaving(false));
  };

  const remove = (doc: any) => {
    if (!confirm(`Remove document "${doc.fileName}"?`)) return;
    leadApi.deleteDocument(leadId, doc.id).then(reload).catch(console.error);
  };

  const grouped = items.reduce((acc: Record<string, any[]>, doc: any) => {
    const key = doc.category || "Other";
    (acc[key] = acc[key] || []).push(doc);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Documents</CardTitle>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add Document</Button>
      </CardHeader>
      <CardContent>
        {loading ? <ListSkeleton /> : items.length === 0 ? (
          <EmptyState icon={FolderOpen} title="No documents" description="Attach property images, floor plans, reference images, videos and agreements." />
        ) : (
          <div className="space-y-5">
            {Object.entries(grouped).map(([category, docs]) => (
              <div key={category}>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{category}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {(docs as any[]).map((doc) => {
                    const url = doc.fileUrl ? resolveFileUrl(doc.fileUrl) : "";
                    const meta = (
                      <div className="text-xs text-muted-foreground">
                        {doc.documentType || "File"} · {formatDate(doc.createdAt)}
                        {doc.uploadedBy?.name ? ` · ${doc.uploadedBy.name}` : ""}
                      </div>
                    );
                    // Photo: thumbnail preview that opens full size in a new tab.
                    if (isImageDoc(doc) && url) {
                      return (
                        <div key={doc.id} className="border rounded-lg p-3 flex items-center gap-3 bg-muted/30">
                          <a href={url} target="_blank" rel="noreferrer" className="shrink-0">
                            <img src={url} alt={doc.fileName} className="h-14 w-14 rounded-md object-cover border" />
                          </a>
                          <div className="flex-1 min-w-0">
                            <a href={url} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary hover:underline truncate block">
                              {doc.fileName}
                            </a>
                            {meta}
                          </div>
                          <Button variant="ghost" size="icon" className="text-destructive shrink-0" onClick={() => remove(doc)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    }
                    // Voice note / audio: inline player.
                    if (isAudioDoc(doc) && url) {
                      return (
                        <div key={doc.id} className="border rounded-lg p-3 flex flex-col gap-2 bg-muted/30">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium truncate block">{doc.fileName}</span>
                              {meta}
                            </div>
                            <Button variant="ghost" size="icon" className="text-destructive shrink-0" onClick={() => remove(doc)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <audio controls src={url} className="h-9 w-full" />
                        </div>
                      );
                    }
                    // Everything else: generic file row.
                    return (
                      <div key={doc.id} className="border rounded-lg p-3 flex items-center gap-3 bg-muted/30">
                        <FileIcon className="h-8 w-8 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          {url ? (
                            <a href={url} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary hover:underline truncate block">
                              {doc.fileName}
                            </a>
                          ) : (
                            <span className="text-sm font-medium truncate block">{doc.fileName}</span>
                          )}
                          {meta}
                        </div>
                        <Button variant="ghost" size="icon" className="text-destructive shrink-0" onClick={() => remove(doc)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Document</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <ImageCaptureField
              label="Capture / add an image"
              module="LEAD"
              value={form.documentType === "Image" ? form.fileUrl : ""}
              onChange={({ url, fileName }) => setForm((f: any) => ({
                ...f,
                fileUrl: url,
                fileName: f.fileName || fileName || "",
                category: f.category || "Site Photos",
                documentType: "Image",
              }))}
            />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> or upload a file <span className="h-px flex-1 bg-border" />
            </div>
            <FileUploadField
              label="File"
              module="LEAD"
              value={form.documentType !== "Image" ? form.fileUrl : ""}
              onChange={({ url, fileName }) => setForm((f: any) => ({
                ...f,
                fileUrl: url,
                fileName: f.fileName || fileName || "",
                documentType: f.documentType && f.documentType !== "Image" ? f.documentType : (fileName ? fileName.split(".").pop()?.toUpperCase() : ""),
              }))}
            />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> or record a voice note <span className="h-px flex-1 bg-border" />
            </div>
            <AudioCaptureField
              label="Voice note"
              module="LEAD"
              value={form.documentType === "Audio" && form.fileUrl ? [{ url: form.fileUrl, fileName: form.fileName || "voice-note" }] : []}
              onChange={(clips: CapturedAudio[]) => {
                const last = clips[clips.length - 1];
                if (!last) { setForm((f: any) => ({ ...f, fileUrl: "", documentType: f.documentType === "Audio" ? "" : f.documentType })); return; }
                setForm((f: any) => ({
                  ...f,
                  fileUrl: last.url,
                  fileName: f.fileName || last.fileName || "",
                  category: f.category || "Voice Notes",
                  documentType: "Audio",
                }));
              }}
            />
            <TextField label="File Name" required value={form.fileName} onChange={set("fileName")} />
            <div className="grid grid-cols-2 gap-4">
              <SelectField label="Category" value={form.category} onChange={set("category")} options={DOCUMENT_CATEGORIES} allowEmpty={false} />
              <TextField label="File Type" value={form.documentType} onChange={set("documentType")} placeholder="PDF, Image, Video, CAD..." />
            </div>
            <TextAreaField label="Description" value={form.description} onChange={set("description")} />
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Add"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

import { useEffect, useState } from "react";
import { Camera, Mic, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { apiError } from "@/lib/apiError";
import { cn } from "@/lib/utils";
import FileUploadField from "@/components/FileUploadField";
import ImageCaptureField from "@/components/ImageCaptureField";
import AudioCaptureField, { type CapturedAudio } from "@/components/AudioCaptureField";
import { leadApi } from "../leadApi";
import { DOCUMENT_CATEGORIES } from "../constants";
import { SelectField, TextAreaField, TextField } from "../fields";

type Source = "photo" | "file" | "voice";

const SOURCES: { key: Source; label: string; icon: typeof Camera; category: string }[] = [
  { key: "photo", label: "Photo", icon: Camera, category: "Site Photos" },
  { key: "file", label: "File", icon: Paperclip, category: "Customer Documents" },
  { key: "voice", label: "Voice note", icon: Mic, category: "Voice Notes" },
];

const emptyForm = (source: Source) => ({
  fileName: "",
  fileUrl: "",
  category: SOURCES.find((s) => s.key === source)!.category,
  documentType: "",
  description: "",
});

/**
 * Add a document to a lead: pick ONE way to attach (photo, file or voice note), then name and file it.
 * Full-screen on phones, a scrolling dialog with a fixed footer from tablet up.
 */
export default function AddDocumentDialog({
  leadId, open, onOpenChange, onAdded,
}: {
  leadId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
}) {
  const [source, setSource] = useState<Source>("photo");
  const [form, setForm] = useState(() => emptyForm("photo"));
  // Once the user picks a category themselves, switching source no longer overrides it.
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setSource("photo"); setForm(emptyForm("photo")); setCategoryTouched(false); }
  }, [open]);

  const set = (key: keyof ReturnType<typeof emptyForm>) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const switchSource = (next: Source) => {
    if (next === source) return;
    setSource(next);
    setForm((f) => ({
      ...f,
      fileUrl: "",
      documentType: "",
      category: categoryTouched ? f.category : SOURCES.find((s) => s.key === next)!.category,
    }));
  };

  const attach = (url: string, fileName: string | undefined, documentType: string) =>
    setForm((f) => ({ ...f, fileUrl: url, fileName: f.fileName || fileName || "", documentType: url ? documentType : "" }));

  const canSave = !!form.fileUrl && !!form.fileName.trim() && !saving;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    leadApi.addDocument(leadId, form)
      .then(() => { toast.success("Document added"); onOpenChange(false); onAdded(); })
      .catch((err) => toast.error(apiError(err, "Couldn't add the document. Please try again.")))
      .finally(() => setSaving(false));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg",
          // Phones: take the whole screen so the camera/file pickers and keyboard have room.
          "max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:max-w-none max-sm:rounded-none max-sm:border-0",
        )}
      >
        <DialogHeader className="shrink-0 space-y-1 border-b px-5 py-4 pr-12 text-left sm:px-6">
          <DialogTitle>Add document</DialogTitle>
          <DialogDescription>Attach a photo, file or voice note to this lead.</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
            <section className="space-y-3">
              <div role="tablist" aria-label="Attach as" className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
                {SOURCES.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={source === key}
                    onClick={() => switchSource(key)}
                    className={cn(
                      "flex h-10 items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors",
                      source === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{label}</span>
                  </button>
                ))}
              </div>

              {source === "photo" && (
                <ImageCaptureField
                  label="Photo"
                  required
                  module="LEAD"
                  value={form.fileUrl}
                  onChange={({ url, fileName }) => attach(url, fileName, "Image")}
                />
              )}
              {source === "file" && (
                <FileUploadField
                  label="File"
                  required
                  module="LEAD"
                  value={form.fileUrl}
                  onChange={({ url, fileName }) => attach(url, fileName, fileName?.split(".").pop()?.toUpperCase() || "File")}
                />
              )}
              {source === "voice" && (
                <AudioCaptureField
                  label="Voice note"
                  module="LEAD"
                  value={form.fileUrl ? [{ url: form.fileUrl, fileName: form.fileName || "voice-note" }] : []}
                  onChange={(clips: CapturedAudio[]) => {
                    const last = clips[clips.length - 1];
                    attach(last?.url || "", last?.fileName, "Audio");
                  }}
                />
              )}
            </section>

            <section className="space-y-4 border-t pt-5">
              <TextField label="Name" required value={form.fileName} onChange={set("fileName")} placeholder="e.g. Living room — front wall" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <SelectField
                  label="Category"
                  value={form.category}
                  onChange={(v: string) => { setCategoryTouched(true); set("category")(v); }}
                  options={DOCUMENT_CATEGORIES}
                  allowEmpty={false}
                />
                <TextField label="Type" value={form.documentType} onChange={set("documentType")} placeholder="Set automatically" />
              </div>
              <TextAreaField label="Notes" rows={2} value={form.description} onChange={set("description")} placeholder="Optional" />
            </section>
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 border-t bg-card px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
            <p className="min-w-0 text-xs text-muted-foreground">
              {!form.fileUrl ? "Attach something to continue." : !form.fileName.trim() ? "Give it a name." : "Ready to add."}
            </p>
            <div className="flex shrink-0 gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={!canSave}>{saving ? "Adding…" : "Add document"}</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

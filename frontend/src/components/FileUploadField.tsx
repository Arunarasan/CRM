import { useRef, useState } from "react";
import { Upload, Link2, X, Loader2, CheckCircle2, Camera } from "lucide-react";
import { uploadFile, type UploadedFile } from "@/lib/uploadFile";
import { compressImageFile } from "@/lib/imageProcessing";
import ImageEditor from "@/components/ImageEditor";
import { useAuth } from "@/hooks/useAuth";

/**
 * Reusable "import from device" field. Replaces the paste-a-link text boxes
 * that used to be the only way to attach an image / video / audio / document.
 *
 * The user can pick a real file from their device, or — when images are allowed —
 * take a photo with the camera. Any image is routed through the shared pipeline:
 * admins get the crop/rotate/compress editor (one-time edit), everyone else's photo
 * is silently compressed. Non-image files upload as-is. A pasted link is still a fallback.
 *
 * Because this is the shared field, adding the camera + edit here gives every form that
 * uses it the same capability at once.
 */
export default function FileUploadField({
  module,
  value,
  onChange,
  accept = "image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.dwg,.dxf",
  label = "File",
  required,
  allowUrl = true,
  disabled,
  allowEdit,
}: {
  /** Grouping folder on the server, e.g. "MEASUREMENT". */
  module: string;
  /** Current URL (uploaded or pasted). */
  value?: string;
  /** Called with the uploaded/entered file URL and, for real uploads, its name. */
  onChange: (next: { url: string; fileName?: string }) => void;
  accept?: string;
  label?: string;
  required?: boolean;
  /** Show the "paste a link" fallback input. */
  allowUrl?: boolean;
  disabled?: boolean;
  /** Override who may open the crop/rotate editor for images. Defaults to admin-only. */
  allowEdit?: boolean;
}) {
  const { isAdmin } = useAuth();
  const canEdit = allowEdit ?? isAdmin;
  const imagesAllowed = accept.includes("image/") || accept.includes("image");

  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<UploadedFile | null>(null);
  const [showUrl, setShowUrl] = useState(false);
  const [pending, setPending] = useState<{ file: File; name: string } | null>(null);

  const doUpload = async (file: File | Blob, fallbackName?: string) => {
    setUploading(true);
    setError(null);
    try {
      const result = await uploadFile(file, module);
      setUploaded(result);
      onChange({ url: result.fileUrl, fileName: result.fileName || fallbackName });
    } catch (err: any) {
      setError(err?.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleFile = async (file: File) => {
    setError(null);
    if (file.type.startsWith("image/")) {
      if (canEdit) { setPending({ file, name: file.name }); return; } // admins edit before upload
      await doUpload(await compressImageFile(file), file.name);        // others: compress only
      return;
    }
    await doUpload(file, file.name); // non-image: upload as-is
  };

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) handleFile(file);
  };

  const clear = () => {
    setUploaded(null);
    setError(null);
    onChange({ url: "" });
  };

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </label>

      {uploaded || (value && !showUrl) ? (
        <div className="flex items-center gap-2 rounded-md border border-input bg-muted/40 px-3 py-2 text-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span className="min-w-0 flex-1 truncate">{uploaded?.fileName || value}</span>
          {!disabled && (
            <button type="button" onClick={clear} className="text-muted-foreground hover:text-destructive" aria-label="Remove file">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading || disabled}
              className="flex flex-1 items-center justify-center gap-2 rounded-md border border-dashed border-input bg-background px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Uploading…" : "Choose file from device"}
            </button>
            {imagesAllowed && (
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                disabled={uploading || disabled}
                className="flex items-center justify-center gap-2 rounded-md border border-dashed border-input bg-background px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
                title="Take a photo"
              >
                <Camera className="h-4 w-4" /> Camera
              </button>
            )}
          </div>

          {allowUrl && (
            showUrl ? (
              <input
                type="url"
                autoFocus
                placeholder="https://... (external link)"
                defaultValue={value || ""}
                onChange={(e) => onChange({ url: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            ) : (
              <button
                type="button"
                onClick={() => setShowUrl(true)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
              >
                <Link2 className="h-3 w-3" /> or paste a link
              </button>
            )
          )}
        </>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={pick} />
      {imagesAllowed && (
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
      )}

      {pending && canEdit && (
        <ImageEditor
          file={pending.file}
          fileName={pending.name}
          open={!!pending}
          onCancel={() => setPending(null)}
          onSave={(edited) => { setPending(null); doUpload(edited, pending.name); }}
        />
      )}
    </div>
  );
}

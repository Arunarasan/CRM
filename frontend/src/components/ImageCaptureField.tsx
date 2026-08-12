import { useRef, useState } from "react";
import { Camera, ImagePlus, X, Loader2, CheckCircle2 } from "lucide-react";
import ImageEditor from "@/components/ImageEditor";
import { uploadFile } from "@/lib/uploadFile";
import { compressImageFile, type OutputFormat } from "@/lib/imageProcessing";
import { useAuth } from "@/hooks/useAuth";

/**
 * Drop-in image field with capture + edit + compress. Same onChange contract as
 * FileUploadField ({ url, fileName }), so it can replace it anywhere an *image* is wanted.
 *
 * Flow: take a photo (rear camera) or pick a file → (admins only) crop/rotate/compress in the
 * editor → upload the shrunk result to /api/uploads → report back the stored URL.
 *
 * Image *editing* is restricted to admins: non-admin users can still add an image, but it is
 * silently compressed and uploaded without the crop/rotate editor. Pass `allowEdit` to override
 * the role check explicitly.
 */
export default function ImageCaptureField({
  module,
  value,
  onChange,
  label = "Image",
  required,
  disabled,
  maxDimension = 1600,
  quality = 0.8,
  format = "image/jpeg",
  allowEdit,
}: {
  /** Grouping folder on the server, e.g. "MEASUREMENT". */
  module: string;
  value?: string;
  onChange: (next: { url: string; fileName?: string }) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  maxDimension?: number;
  quality?: number;
  format?: OutputFormat;
  /** Override who may open the crop/rotate editor. Defaults to admin-only. */
  allowEdit?: boolean;
}) {
  const { isAdmin } = useAuth();
  const canEdit = allowEdit ?? isAdmin;
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ file: File; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedName, setUploadedName] = useState<string | null>(null);

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    if (canEdit) {
      setPending({ file, name: file.name }); // admins get the crop/rotate editor
      return;
    }
    // Non-admins: no editing — just compress and upload directly.
    setUploading(true);
    try {
      const compressed = await compressImageFile(file, { maxDimension, quality, format });
      const result = await uploadFile(compressed, module);
      setUploadedName(result.fileName);
      onChange({ url: result.fileUrl, fileName: result.fileName });
    } catch (err: any) {
      setError(err?.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (edited: File) => {
    setPending(null);
    setUploading(true);
    setError(null);
    try {
      const result = await uploadFile(edited, module);
      setUploadedName(result.fileName);
      onChange({ url: result.fileUrl, fileName: result.fileName });
    } catch (err: any) {
      setError(err?.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const clear = () => {
    setUploadedName(null);
    setError(null);
    onChange({ url: "" });
  };

  const hasImage = !!value && !uploading;

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </label>

      {hasImage ? (
        <div className="flex items-center gap-3 rounded-md border border-input bg-muted/40 p-2">
          <img src={value} alt={uploadedName || "uploaded"} className="h-14 w-14 shrink-0 rounded object-cover" />
          <div className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span className="min-w-0 truncate">{uploadedName || "Image uploaded"}</span>
          </div>
          {!disabled && (
            <button type="button" onClick={clear} className="text-muted-foreground hover:text-destructive" aria-label="Remove image">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={uploading || disabled}
            className="flex flex-1 items-center justify-center gap-2 rounded-md border border-dashed border-input bg-background px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            {uploading ? "Uploading…" : "Take photo"}
          </button>
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            disabled={uploading || disabled}
            className="flex flex-1 items-center justify-center gap-2 rounded-md border border-dashed border-input bg-background px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
          >
            <ImagePlus className="h-4 w-4" /> Choose image
          </button>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={pick} />

      {pending && canEdit && (
        <ImageEditor
          file={pending.file}
          fileName={pending.name}
          open={!!pending}
          onCancel={() => setPending(null)}
          onSave={handleSave}
          defaultMaxDimension={maxDimension}
          defaultQuality={quality}
          defaultFormat={format}
        />
      )}
    </div>
  );
}

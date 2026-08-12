import { useRef, useState } from "react";
import { Camera, ImagePlus, X, Loader2 } from "lucide-react";
import ImageEditor from "@/components/ImageEditor";
import { uploadFile } from "@/lib/uploadFile";
import { compressImageFile } from "@/lib/imageProcessing";
import { resolveFileUrl } from "@/lib/uploadFile";
import { useAuth } from "@/hooks/useAuth";

export interface CapturedImage { url: string; fileName: string; }

/**
 * Capture/pick MANY images (camera or gallery) with the same admin-gated edit + compress
 * pipeline as ImageCaptureField. Each image uploads immediately to /api/uploads and is appended
 * to `value`. Used at lead-creation time; the caller persists the list as LeadDocuments so the
 * images travel to the project on conversion.
 */
export default function MultiImageCaptureField({
  value, onChange, module, label = "Images", disabled,
}: {
  value: CapturedImage[];
  onChange: (next: CapturedImage[]) => void;
  module: string;
  label?: string;
  disabled?: boolean;
}) {
  const { isAdmin } = useAuth();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ file: File; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const append = async (file: File, fileName: string) => {
    setBusy(true);
    setError(null);
    try {
      const result = await uploadFile(file, module);
      onChange([...value, { url: result.fileUrl, fileName: result.fileName || fileName }]);
    } catch (err: any) {
      setError(err?.message || "Upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    if (isAdmin) { setPending({ file, name: file.name }); return; } // admins edit before upload
    append(await compressImageFile(file), file.name);               // others: compress only
  };

  const removeAt = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>

      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {value.map((img, i) => (
            <div key={i} className="group relative aspect-square overflow-hidden rounded-md border bg-muted/40">
              <img src={resolveFileUrl(img.url)} alt={img.fileName} className="h-full w-full object-cover" />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Remove image"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          disabled={busy || disabled}
          className="flex flex-1 items-center justify-center gap-2 rounded-md border border-dashed border-input bg-background px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          {busy ? "Uploading…" : "Take photo"}
        </button>
        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          disabled={busy || disabled}
          className="flex flex-1 items-center justify-center gap-2 rounded-md border border-dashed border-input bg-background px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
        >
          <ImagePlus className="h-4 w-4" /> Add image
        </button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={pick} />

      {pending && isAdmin && (
        <ImageEditor
          file={pending.file}
          fileName={pending.name}
          open={!!pending}
          onCancel={() => setPending(null)}
          onSave={(edited) => { setPending(null); append(edited, pending.name); }}
        />
      )}
    </div>
  );
}

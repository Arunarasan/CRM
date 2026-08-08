import { useRef, useState } from "react";
import { Upload, Link2, X, Loader2, CheckCircle2 } from "lucide-react";
import { uploadFile, type UploadedFile } from "@/lib/uploadFile";

/**
 * Reusable "import from device" field. Replaces the paste-a-link text boxes
 * that used to be the only way to attach an image / video / audio / document.
 *
 * The user can pick a real file from their device (which uploads immediately and
 * reports back an absolute URL + the original file name), or — as a fallback —
 * still paste an external link.
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
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<UploadedFile | null>(null);
  const [showUrl, setShowUrl] = useState(false);

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const result = await uploadFile(file, module);
      setUploaded(result);
      onChange({ url: result.fileUrl, fileName: result.fileName });
    } catch (err: any) {
      setError(err?.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
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
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading || disabled}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-input bg-background px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? "Uploading…" : "Choose file from device"}
          </button>

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
    </div>
  );
}

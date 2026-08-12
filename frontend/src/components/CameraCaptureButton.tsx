import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import ImageEditor from "@/components/ImageEditor";
import { compressImageFile } from "@/lib/imageProcessing";
import { useAuth } from "@/hooks/useAuth";

/**
 * Drop-in "Take photo" button for any bespoke upload UI that already has its own file handler.
 * Encapsulates the shared image pipeline once: opens the rear camera, then — for admins — the
 * crop/rotate editor, else silent compression, and finally calls `onCapture(finalFile)`.
 *
 * Lets existing custom uploaders gain camera + one-time edit with a single line, without each
 * re-implementing the editor/compress logic.
 */
export default function CameraCaptureButton({
  onCapture,
  disabled,
  label = "Camera",
  className,
  allowEdit,
}: {
  /** Receives the processed (edited/compressed) image File, ready to upload. */
  onCapture: (file: File) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
  /** Override who may open the editor. Defaults to admin-only. */
  allowEdit?: boolean;
}) {
  const { isAdmin } = useAuth();
  const canEdit = allowEdit ?? isAdmin;
  const ref = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<File | null>(null);

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (canEdit) { setPending(file); return; }     // admins edit before upload
    onCapture(await compressImageFile(file));       // others: compress only
  };

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={disabled}
        title="Take a photo"
        className={
          className ||
          "inline-flex items-center justify-center gap-2 rounded-md border border-dashed border-input bg-background px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
        }
      >
        <Camera className="h-4 w-4" /> {label}
      </button>
      <input ref={ref} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
      {pending && canEdit && (
        <ImageEditor
          file={pending}
          fileName="photo"
          open={!!pending}
          onCancel={() => setPending(null)}
          onSave={(edited) => { setPending(null); onCapture(edited); }}
        />
      )}
    </>
  );
}

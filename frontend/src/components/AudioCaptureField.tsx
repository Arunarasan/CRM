import { useEffect, useRef, useState } from "react";
import { Mic, Square, Upload, X, Loader2, Play } from "lucide-react";
import { uploadFile } from "@/lib/uploadFile";
import { resolveFileUrl } from "@/lib/uploadFile";

export interface CapturedAudio { url: string; fileName: string; }

/**
 * Capture/pick one or MANY short audio clips (voice notes) for a lead or any record. Each clip is
 * either recorded in the browser (MediaRecorder) or picked from the device, uploaded immediately to
 * /api/uploads, and appended to `value`. Mirrors MultiImageCaptureField's shape so the caller can
 * persist the list the same way (as LeadDocuments of type Audio). Recording gracefully degrades to
 * the file picker when the browser blocks the microphone.
 */
export default function AudioCaptureField({
  value, onChange, module, label = "Voice notes", disabled,
}: {
  value: CapturedAudio[];
  onChange: (next: CapturedAudio[]) => void;
  module: string;
  label?: string;
  disabled?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stop the mic + timer if the field unmounts mid-recording.
  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  const append = async (file: File | Blob, fileName: string) => {
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

  const startRecording = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      fileRef.current?.click(); // no in-browser recording — fall back to the picker
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = rec.mimeType || "audio/webm";
        const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
        const blob = new Blob(chunksRef.current, { type });
        append(blob, `voice-note-${Date.now()}.${ext}`);
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch {
      setError("Microphone unavailable. Use “Upload audio” instead.");
    }
  };

  const stopRecording = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setRecording(false);
    recorderRef.current?.stop();
  };

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) await append(file, file.name);
  };

  const removeAt = (idx: number) => onChange(value.filter((_, i) => i !== idx));
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>

      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((clip, i) => (
            <div key={i} className="flex items-center gap-2 rounded-md border bg-muted/30 px-2.5 py-2">
              <Play className="h-4 w-4 shrink-0 text-primary" />
              <audio controls src={resolveFileUrl(clip.url)} className="h-8 min-w-0 flex-1" />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  className="shrink-0 rounded-full p-1 text-muted-foreground hover:text-destructive"
                  aria-label="Remove audio"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        {recording ? (
          <button
            type="button"
            onClick={stopRecording}
            className="flex min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-destructive bg-destructive/10 px-3 py-2.5 text-sm font-medium text-destructive"
          >
            <Square className="h-4 w-4 shrink-0 animate-pulse fill-destructive" />
            <span className="truncate">Stop · {mmss(elapsed)}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={startRecording}
            disabled={busy || disabled}
            className="flex min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-dashed border-input bg-background px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Mic className="h-4 w-4 shrink-0" />}
            <span className="truncate">{busy ? "Uploading…" : "Record"}</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy || disabled || recording}
          className="flex min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-dashed border-input bg-background px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
        >
          <Upload className="h-4 w-4 shrink-0" /> <span className="truncate">Upload audio</span>
        </button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={pick} />
    </div>
  );
}

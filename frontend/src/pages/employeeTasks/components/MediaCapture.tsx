import { useRef, useState } from 'react';
import { Camera, Video, Mic, Square, X } from 'lucide-react';
import { employeeTaskApi } from '@/api/employeeTaskApi';
import { ProgressMediaItem } from '@/types/employeeTask';
import ImageEditor from '@/components/ImageEditor';
import { compressImageFile } from '@/lib/imageProcessing';
import { useAuth } from '@/hooks/useAuth';

/** Photo/video capture via native file input, plus voice notes via MediaRecorder. Uploads immediately to /api/uploads.
 *  Admins get the crop/rotate editor before upload; everyone else's photos are silently compressed only. */
export default function MediaCapture({ media, onChange }: { media: ProgressMediaItem[]; onChange: (media: ProgressMediaItem[]) => void }) {
  const { isAdmin } = useAuth();
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const upload = async (file: File | Blob, mediaType: ProgressMediaItem['mediaType']) => {
    setUploading(true);
    try {
      const { fileUrl } = await employeeTaskApi.uploadFile(file, 'TASK_PROGRESS');
      onChange([...media, { mediaType, fileUrl }]);
    } finally {
      setUploading(false);
    }
  };

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>, mediaType: 'PHOTO' | 'VIDEO') => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (mediaType !== 'PHOTO') { upload(file, mediaType); return; }
    if (isAdmin) { setPendingPhoto(file); return; }   // admins edit before upload
    upload(await compressImageFile(file), 'PHOTO');    // others: compress only
  };

  const onPhotoEdited = (edited: File) => {
    setPendingPhoto(null);
    upload(edited, 'PHOTO');
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        upload(blob, 'VOICE');
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      alert('Microphone access denied or unavailable.');
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  const remove = (index: number) => onChange(media.filter((_, i) => i !== index));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button type="button" onClick={() => photoInput.current?.click()} disabled={uploading}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border bg-card py-2 text-xs font-medium">
          <Camera className="h-4 w-4" /> Photo
        </button>
        <button type="button" onClick={() => videoInput.current?.click()} disabled={uploading}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border bg-card py-2 text-xs font-medium">
          <Video className="h-4 w-4" /> Video
        </button>
        <button type="button" onClick={recording ? stopRecording : startRecording} disabled={uploading}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-medium ${recording ? 'border-red-500 bg-red-50 text-red-600' : 'bg-card'}`}>
          {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />} {recording ? 'Stop' : 'Voice'}
        </button>
      </div>
      <input ref={photoInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFileSelected(e, 'PHOTO')} />
      <input ref={videoInput} type="file" accept="video/*" capture className="hidden" onChange={(e) => onFileSelected(e, 'VIDEO')} />
      {pendingPhoto && (
        <ImageEditor
          file={pendingPhoto}
          fileName="task-photo"
          open={!!pendingPhoto}
          onCancel={() => setPendingPhoto(null)}
          onSave={onPhotoEdited}
        />
      )}
      {uploading && <p className="text-xs text-muted-foreground">Uploading…</p>}
      {media.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {media.map((m, i) => (
            <span key={i} className="flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px]">
              {m.mediaType}
              <button type="button" onClick={() => remove(i)}><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

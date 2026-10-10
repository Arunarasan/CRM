import { useRef } from 'react';
import { Camera, ImageUp, Loader2 } from 'lucide-react';
import { compressImageFile } from '@/lib/imageProcessing';

/**
 * Two clear photo buttons for field employees: "Take photo" opens the camera straight away, "Upload"
 * opens the gallery/files (several at once). One input with `capture` would force the camera and hide
 * the gallery on most phones, hence two inputs. Photos are compressed before they're handed back.
 */
export default function PhotoPickButtons({ onPicked, busy, disabled, onBlocked }: {
  onPicked: (files: File[]) => void;
  busy?: boolean;
  disabled?: boolean;
  /** Called instead of opening the picker while the buttons are shown but not usable yet (task not taken). */
  onBlocked?: () => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const handle = async (list: FileList | null, input: HTMLInputElement | null) => {
    const files = Array.from(list || []);
    if (input) input.value = '';
    if (!files.length) return;
    onPicked(await Promise.all(files.map((f) => compressImageFile(f).catch(() => f))));
  };
  const open = (ref: React.RefObject<HTMLInputElement | null>) => (onBlocked ? onBlocked() : ref.current?.click());

  const btn = 'flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-semibold active:scale-[0.98] disabled:opacity-50';
  return (
    <div className="flex gap-2">
      <button type="button" onClick={() => open(cameraRef)} disabled={busy || disabled}
        className={`${btn} bg-[#0A573B] text-white`}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} Take photo
      </button>
      <button type="button" onClick={() => open(galleryRef)} disabled={busy || disabled}
        className={`${btn} border border-[#0A573B]/30 bg-white text-[#0A573B]`}>
        <ImageUp className="h-4 w-4" /> Upload
      </button>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => handle(e.target.files, e.currentTarget)} />
      <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden"
        onChange={(e) => handle(e.target.files, e.currentTarget)} />
    </div>
  );
}

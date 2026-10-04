import { useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Loader2 } from 'lucide-react';
import { uploadFile, resolveFileUrl } from '@/lib/uploadFile';
import { compressImageFile } from '@/lib/imageProcessing';
import { toast } from '@/components/ui/toast';

// Shared bits for the project work boards (Execution / Installation / Daily log / Team chat). Same
// forest / ivory / gold look as the employee task screens.

export const CARD = 'overflow-hidden rounded-2xl border border-[#EDE6D8] bg-white shadow-[0_2px_10px_rgba(80,55,20,0.05)]';
export const INPUT = 'w-full rounded-xl border border-[#DDE2DE] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#0A573B]';
export const PRIMARY = 'inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0A573B] px-4 py-2.5 text-[13px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-50';
export const GHOST = 'inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#DDE2DE] bg-white px-3 py-2 text-[12.5px] font-semibold text-[#0A573B] transition active:scale-[0.98] disabled:opacity-50';

export const pctTone = (p: number) =>
  p >= 100 ? 'text-[#0A573B]' : p > 0 ? 'text-[#9B6B32]' : 'text-[#9A9E96]';

export function Bar({ value, className = 'h-2', tone }: { value: number; className?: string; tone?: 'gold' }) {
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <div className={`w-full overflow-hidden rounded-full bg-[#EFEBE0] ${className}`}>
      <div
        className={`h-full rounded-full transition-all ${tone === 'gold'
          ? 'bg-gradient-to-r from-[#BC8748] to-[#D4A562]'
          : v >= 100 ? 'bg-[#0A573B]' : 'bg-gradient-to-r from-[#0A573B] to-[#2E8B65]'}`}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

/** Camera + gallery buttons that compress and upload a photo, then hand back its URL. */
export function PhotoPicker({ onUploaded, module = 'PROJECT_WORK', compact, disabled, multiple }: {
  onUploaded: (url: string) => void; module?: string; compact?: boolean; disabled?: boolean; multiple?: boolean;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setBusy(true);
    try {
      for (const f of files) {
        const { fileUrl } = await uploadFile(await compressImageFile(f), module);
        onUploaded(fileUrl);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Photo upload failed');
    } finally {
      setBusy(false);
    }
  };

  const btn = compact
    ? 'flex h-9 w-9 items-center justify-center rounded-full border border-[#DDE2DE] bg-white text-[#0A573B] active:scale-95 disabled:opacity-50'
    : GHOST;
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" className={btn} disabled={disabled || busy} onClick={() => cameraRef.current?.click()} aria-label="Take photo">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}{!compact && ' Camera'}
      </button>
      <button type="button" className={btn} disabled={disabled || busy} onClick={() => galleryRef.current?.click()} aria-label="Choose photo">
        <ImageIcon className="h-4 w-4" />{!compact && ' Gallery'}
      </button>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPick} />
      <input ref={galleryRef} type="file" accept="image/*" multiple={multiple} className="hidden" onChange={onPick} />
    </div>
  );
}

export function Thumbs({ urls, size = 'h-16 w-16', onRemove }: { urls: string[]; size?: string; onRemove?: (i: number) => void }) {
  if (!urls.length) return null;
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {urls.map((u, i) => (
        <div key={u + i} className="relative shrink-0">
          <a href={resolveFileUrl(u)} target="_blank" rel="noopener noreferrer">
            <img src={resolveFileUrl(u)} alt="" className={`${size} rounded-lg object-cover ring-1 ring-[#E4DECF]`} />
          </a>
          {onRemove && (
            <button type="button" onClick={() => onRemove(i)}
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#22271F] text-[11px] text-white">×</button>
          )}
        </div>
      ))}
    </div>
  );
}

export const fmtWhen = (s?: string | null) =>
  s ? new Date(s).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';

export const fmtDay = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : '';

export const errMsg = (e: any, fallback: string) => e?.response?.data?.message || e?.message || fallback;

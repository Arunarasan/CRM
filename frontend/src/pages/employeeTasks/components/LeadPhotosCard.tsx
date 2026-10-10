import { useCallback, useEffect, useState } from 'react';
import { Image as ImageIcon, X } from 'lucide-react';
import { employeeTaskApi, LeadPhoto } from '@/api/employeeTaskApi';
import { resolveFileUrl } from '@/lib/uploadFile';
import PhotoPickButtons from './PhotoPickButtons';

/**
 * Site photos on the Collect Requirement task page. Take a photo or upload from the gallery and it is
 * saved straight onto the lead (its Documents tab) — no need to finish the form first. Thumbnails open
 * in the app's image viewer; the employee can remove only photos they added.
 */
export default function LeadPhotosCard({ taskId, canEdit, takeFirst, embedded }: {
  taskId: number;
  /** The employee holds the task — the buttons work. */
  canEdit: boolean;
  /** The task is open to pick — buttons show but ask the employee to take the task first. */
  takeFirst?: boolean;
  /** Rendered inside another card (Task notes) — no card frame of its own. */
  embedded?: boolean;
}) {
  const [photos, setPhotos] = useState<LeadPhoto[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    employeeTaskApi.leadPhotos(taskId).then((p) => setPhotos(p || [])).catch(() => setPhotos([]));
  }, [taskId]);
  useEffect(load, [load]);

  const add = async (files: File[]) => {
    setBusy(true); setMsg('');
    try {
      for (const f of files) {
        const up = await employeeTaskApi.uploadFile(f, 'LEAD');
        await employeeTaskApi.addLeadPhoto(taskId, { fileUrl: up.fileUrl, fileName: up.fileName || f.name });
      }
      load();
    } catch (e: any) {
      setMsg(e?.response?.data?.message || 'Upload failed. Check your connection and try again.');
    } finally { setBusy(false); }
  };

  const remove = async (p: LeadPhoto) => {
    if (!window.confirm('Remove this photo from the lead?')) return;
    try { await employeeTaskApi.deleteLeadPhoto(taskId, p.id); load(); }
    catch (e: any) { setMsg(e?.response?.data?.message || 'Could not remove the photo.'); }
  };

  if (photos === null) return null;
  const showButtons = canEdit || takeFirst;
  return (
    <div className={embedded ? '' : 'rounded-2xl border border-[#ECEAE5] bg-white p-3 shadow-[0_2px_10px_rgba(0,35,22,0.04)]'}>
      {embedded ? (
        <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-[#5B625E]">
          <ImageIcon className="h-3.5 w-3.5" /> Site photos · {photos.length}
          <span className="ml-auto text-[11px] font-normal normal-case tracking-normal text-[#8A918C]">saved on the lead</span>
        </p>
      ) : (
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E7F2EC] text-[#0A573B]">
            <ImageIcon className="h-4 w-4" />
          </span>
          <h3 className="flex-1 text-[13px] font-bold uppercase tracking-wide text-[#1A211E]">Site photos</h3>
          <span className="text-[12px] font-semibold text-[#7A817C]">{photos.length}</span>
        </div>
      )}

      <div className="mt-2.5">
        {photos.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#DDE2DE] bg-[#F7F8F6] px-3 py-3 text-center text-[12.5px] text-[#8A918C]">
            No photos yet. Take photos of the site, the room or what the customer wants.
          </p>
        ) : (
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {photos.map((p) => (
              <div key={p.id} className="relative h-20 w-20 shrink-0">
                <a href={resolveFileUrl(p.fileUrl)} target="_blank" rel="noopener noreferrer"
                  className="block h-full w-full overflow-hidden rounded-xl border border-[#ECEAE5] bg-[#F7F6F2]">
                  <img src={resolveFileUrl(p.fileUrl)} alt={p.fileName || 'Site photo'} loading="lazy" className="h-full w-full object-cover"
                    onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
                </a>
                {p.mine && canEdit && (
                  <button type="button" onClick={() => remove(p)} aria-label="Remove photo"
                    className="absolute -right-1 -top-1 rounded-full bg-black/70 p-1 text-white"><X className="h-3 w-3" /></button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showButtons && (
        <div className="mt-2.5">
          <PhotoPickButtons onPicked={add} busy={busy}
            onBlocked={canEdit ? undefined : () => setMsg('Tap “Take this task” below first, then add photos.')} />
        </div>
      )}
      {msg && <p className="mt-2 rounded-lg bg-[#FBE7E4] px-2.5 py-2 text-[12px] text-[#B94B45]">{msg}</p>}
    </div>
  );
}

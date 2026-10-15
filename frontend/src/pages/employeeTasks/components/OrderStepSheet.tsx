import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { employeeTaskApi } from '@/api/employeeTaskApi';
import { resolveFileUrl } from '@/lib/uploadFile';
import { toast } from '@/components/ui/toast';
import PhotoPickButtons from './PhotoPickButtons';
import { stepLabel } from './OrderTaskView';
import { useT } from '@/i18n';

/**
 * Moves the task's order to its next step (e.g. Process → Completed) with an optional photo of the finished
 * work and a note — both saved on the order's history. Admins / the counter are told it's ready.
 */
export default function OrderStepSheet({ taskId, code, nextStatus, open, onOpenChange, onDone }: {
  taskId: number;
  code: string;
  nextStatus: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const { t } = useT();
  const [note, setNote] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const completing = nextStatus === 'COMPLETED';

  useEffect(() => { if (open) { setNote(''); setPhotoUrl(''); setError(''); } }, [open]);

  const upload = async (files: File[]) => {
    if (!files[0]) return;
    setUploading(true); setError('');
    try { setPhotoUrl((await employeeTaskApi.uploadFile(files[0], 'BUNDLE')).fileUrl); }
    catch { setError(t('pw.common.photoFailed')); }
    finally { setUploading(false); }
  };

  const save = async () => {
    setSaving(true); setError('');
    try {
      await employeeTaskApi.advanceOrder(taskId, { note: note.trim() || undefined, photoUrl: photoUrl || undefined });
      toast.success(t('pw.os.movedTo', { code, step: stepLabel(nextStatus) }));
      onOpenChange(false);
      onDone();
    } catch (e: any) {
      setError(e?.response?.data?.message || t('pw.os.updateFailed'));
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{completing ? t('pw.os.markCompleted', { code }) : t('pw.os.moveTo', { code, step: stepLabel(nextStatus) })}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-[#5B625E]">
            {completing ? t('pw.os.completingIntro')
              : t('pw.os.stepIntro')}
          </p>
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">{t('pw.os.photoOpt')}</p>
            {photoUrl ? (
              <div className="relative h-24 w-24">
                <img src={resolveFileUrl(photoUrl)} alt={t('pw.os.finishedAlt')} className="h-full w-full rounded-lg border object-cover" />
                <button type="button" onClick={() => setPhotoUrl('')} aria-label={t('pw.common.removePhoto')}
                  className="absolute -right-1.5 -top-1.5 rounded-full bg-black/70 p-1 text-white"><X className="h-3 w-3" /></button>
              </div>
            ) : <PhotoPickButtons onPicked={upload} busy={uploading} />}
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">{t('pw.os.noteOpt')}</p>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
              placeholder={completing ? t('pw.os.notePhDone') : t('pw.os.notePhStep')}
              className="w-full rounded-md border px-3 py-2 text-sm" />
          </div>
          {error && <p className="rounded-md bg-[#FBE2E0] p-2 text-xs text-[#B94B45]">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="flex-1">{t('pw.cancel')}</Button>
          <Button onClick={save} disabled={saving || uploading} className="flex-1 bg-[#0A573B] hover:bg-[#0A573B]/90">
            {saving ? t('pw.prog.saving') : completing ? t('pw.os.markCompletedBtn') : t('pw.os.moveToBtn', { step: stepLabel(nextStatus) })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

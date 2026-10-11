import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { employeeTaskApi } from '@/api/employeeTaskApi';
import { resolveFileUrl } from '@/lib/uploadFile';
import { toast } from '@/components/ui/toast';
import PhotoPickButtons from './PhotoPickButtons';
import { stepLabel } from './OrderTaskView';

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
    catch { setError('Photo upload failed. Try again.'); }
    finally { setUploading(false); }
  };

  const save = async () => {
    setSaving(true); setError('');
    try {
      await employeeTaskApi.advanceOrder(taskId, { note: note.trim() || undefined, photoUrl: photoUrl || undefined });
      toast.success(`${code} moved to ${stepLabel(nextStatus)}`);
      onOpenChange(false);
      onDone();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not update the order.');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{completing ? `Mark ${code} completed` : `Move ${code} to ${stepLabel(nextStatus)}`}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-[#5B625E]">
            {completing ? 'All items made and checked? A photo of the finished work helps the counter and the customer.'
              : 'This updates the order for the office and the customer.'}
          </p>
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Photo (optional)</p>
            {photoUrl ? (
              <div className="relative h-24 w-24">
                <img src={resolveFileUrl(photoUrl)} alt="Finished work" className="h-full w-full rounded-lg border object-cover" />
                <button type="button" onClick={() => setPhotoUrl('')} aria-label="Remove photo"
                  className="absolute -right-1.5 -top-1.5 rounded-full bg-black/70 p-1 text-white"><X className="h-3 w-3" /></button>
              </div>
            ) : <PhotoPickButtons onPicked={upload} busy={uploading} />}
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Note (optional)</p>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
              placeholder={completing ? 'e.g. Packed in 2 covers, kept on rack B' : 'e.g. Fabric cut, starting stitching'}
              className="w-full rounded-md border px-3 py-2 text-sm" />
          </div>
          {error && <p className="rounded-md bg-[#FBE2E0] p-2 text-xs text-[#B94B45]">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="flex-1">Cancel</Button>
          <Button onClick={save} disabled={saving || uploading} className="flex-1 bg-[#0A573B] hover:bg-[#0A573B]/90">
            {saving ? 'Saving…' : completing ? 'Mark Completed' : `Move to ${stepLabel(nextStatus)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

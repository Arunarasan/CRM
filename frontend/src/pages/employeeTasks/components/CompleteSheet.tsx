import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CheckCircle2 } from 'lucide-react';
import { employeeTaskApi } from '@/api/employeeTaskApi';
import { ProgressMediaItem } from '@/types/employeeTask';
import { runOrQueue } from '@/hooks/useOfflineQueue';
import MediaCapture from './MediaCapture';

/**
 * One-tap completion confirmation. Everything here is optional — the employee can just
 * confirm. If they add a closing note or photo we record it as a final progress update
 * (existing /progress endpoint) before completing (existing /complete endpoint); no new
 * backend behaviour, no extra screen.
 */
export default function CompleteSheet({ taskId, open, onOpenChange, onDone }: {
  taskId: number; open: boolean; onOpenChange: (open: boolean) => void; onDone: () => void;
}) {
  const [note, setNote] = useState('');
  const [media, setMedia] = useState<ProgressMediaItem[]>([]);
  const [saving, setSaving] = useState(false);

  const confirm = async () => {
    setSaving(true);
    try {
      if (note.trim() || media.length) {
        await employeeTaskApi.addProgress(taskId, {
          progressPercent: 100,
          remarks: note.trim() || undefined,
          media: media.length ? media : undefined,
        });
      }
      await runOrQueue({
        method: 'post',
        url: `/employee-tasks/${taskId}/complete`,
        payload: note.trim() ? { remarks: note.trim() } : undefined,
        description: 'Complete task',
      });
      setNote(''); setMedia([]);
      onOpenChange(false);
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#0A573B]">
            <CheckCircle2 className="h-5 w-5" /> Complete Task
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-[#5B625E]">Add a closing note or photo if useful — both are optional.</p>
          <div>
            <Label>Completion note</Label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
              className="w-full rounded-md border px-3 py-2 text-sm" placeholder="What was done?" />
          </div>
          <div>
            <Label>Photo / attachment</Label>
            <MediaCapture media={media} onChange={setMedia} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="flex-1">Cancel</Button>
          <Button onClick={confirm} disabled={saving} className="flex-1 bg-[#0A573B] hover:bg-[#0A573B]/90">
            {saving ? 'Completing…' : 'Mark Completed'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

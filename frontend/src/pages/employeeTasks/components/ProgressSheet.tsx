import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { employeeTaskApi } from '@/api/employeeTaskApi';
import { ProgressMediaItem } from '@/types/employeeTask';
import MediaCapture from './MediaCapture';

export default function ProgressSheet({ taskId, open, onOpenChange, onSaved }: {
  taskId: number; open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => void;
}) {
  const [progressPercent, setProgressPercent] = useState(50);
  const [remarks, setRemarks] = useState('');
  const [timeSpentMinutes, setTimeSpentMinutes] = useState<number | ''>('');
  const [media, setMedia] = useState<ProgressMediaItem[]>([]);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await employeeTaskApi.addProgress(taskId, {
        progressPercent, remarks: remarks || undefined,
        timeSpentMinutes: timeSpentMinutes === '' ? undefined : timeSpentMinutes,
        media: media.length ? media : undefined,
      });
      setRemarks(''); setMedia([]); setTimeSpentMinutes('');
      onSaved();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Update Progress</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-3">
          <div>
            <Label>Progress: {progressPercent}%</Label>
            <input type="range" min={0} max={100} step={5} value={progressPercent}
              onChange={(e) => setProgressPercent(Number(e.target.value))} className="w-full" />
          </div>
          <div>
            <Label>Time spent (minutes)</Label>
            <input type="number" min={0} value={timeSpentMinutes}
              onChange={(e) => setTimeSpentMinutes(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full rounded-md border px-3 py-2 text-sm" />
          </div>
          <div>
            <Label>Remarks</Label>
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3}
              className="w-full rounded-md border px-3 py-2 text-sm" placeholder="What did you complete?" />
          </div>
          <div>
            <Label>Photos / Video / Voice note</Label>
            <MediaCapture media={media} onChange={setMedia} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={saving} className="w-full">{saving ? 'Saving…' : 'Save Progress'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

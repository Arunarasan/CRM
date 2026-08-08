import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { employeeTaskApi } from '@/api/employeeTaskApi';
import { IssueType } from '@/types/employeeTask';

const ISSUE_TYPES: { value: IssueType; label: string }[] = [
  { value: 'MATERIAL_SHORTAGE', label: 'Material Shortage' },
  { value: 'CUSTOMER_CHANGE', label: 'Customer Change' },
  { value: 'MEASUREMENT_ISSUE', label: 'Measurement Issue' },
  { value: 'SITE_ISSUE', label: 'Site Issue' },
  { value: 'DELAY', label: 'Delay' },
  { value: 'SAFETY_ISSUE', label: 'Safety Issue' },
];

export default function IssueReportSheet({ taskId, open, onOpenChange, onSaved, defaultIssueType }: {
  taskId: number; open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => void; defaultIssueType?: IssueType;
}) {
  const [issueType, setIssueType] = useState<IssueType>(defaultIssueType ?? 'SITE_ISSUE');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!description.trim()) return;
    setSaving(true);
    try {
      await employeeTaskApi.reportIssue(taskId, issueType, description);
      setDescription('');
      onSaved();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Report an Issue</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-3">
          <div>
            <Label>Issue type</Label>
            <select value={issueType} onChange={(e) => setIssueType(e.target.value as IssueType)}
              className="w-full rounded-md border px-3 py-2 text-sm">
              {ISSUE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <Label>Description</Label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
              className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Describe the issue…" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={saving || !description.trim()} className="w-full">
            {saving ? 'Reporting…' : 'Notify Manager'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

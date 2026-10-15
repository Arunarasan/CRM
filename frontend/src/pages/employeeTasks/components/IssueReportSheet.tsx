import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { employeeTaskApi } from '@/api/employeeTaskApi';
import { IssueType } from '@/types/employeeTask';
import { useT } from '@/i18n';

const ISSUE_TYPES: IssueType[] = ['MATERIAL_SHORTAGE', 'CUSTOMER_CHANGE', 'MEASUREMENT_ISSUE', 'SITE_ISSUE', 'DELAY', 'SAFETY_ISSUE'];

export default function IssueReportSheet({ taskId, open, onOpenChange, onSaved, defaultIssueType }: {
  taskId: number; open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => void; defaultIssueType?: IssueType;
}) {
  const { t } = useT();
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
        <DialogHeader><DialogTitle>{t('pw.issue.title')}</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <Label>{t('pw.issue.type')}</Label>
            <select value={issueType} onChange={(e) => setIssueType(e.target.value as IssueType)}
              className="mt-1.5 w-full rounded-xl border border-[#DDE2DE] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0A573B]">
              {ISSUE_TYPES.map((it) => <option key={it} value={it}>{t(`pw.issue.${it}`)}</option>)}
            </select>
          </div>
          <div>
            <Label>{t('pw.issue.description')}</Label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
              className="mt-1.5 w-full rounded-xl border border-[#DDE2DE] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0A573B]" placeholder={t('pw.issue.descPh')} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={saving || !description.trim()} className="w-full bg-[#0A573B] text-white hover:bg-[#06452F]">
            {saving ? t('pw.issue.reporting') : t('pw.issue.notify')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

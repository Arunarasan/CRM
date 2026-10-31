/**
 * HR → employee profile: wipe this employee's work history (attendance, leave, tasks, reports, payroll,
 * rewards, notifications) while keeping the person, documents, login and biometrics. For clearing test
 * data. Admin only — the backend enforces ROLE_ADMIN. Always previews counts first; deleting needs the
 * employee's name typed in.
 */
import { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';

interface ResetResult { totalRows: number; counts: Record<string, number>; skipped: string[] }

const errText = (e: any) => e?.response?.data?.message || e?.message || 'Action failed';

export function ResetWorkDataCard({ employeeId, employeeName, onChanged }:
  { employeeId: number; employeeName: string; onChanged?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ResetResult | null>(null);
  const [confirm, setConfirm] = useState('');

  const run = async (dryRun: boolean) => {
    setBusy(true);
    try {
      const { data } = await api.post<ResetResult>('/hr/employees/reset-work', { employeeIds: [employeeId], dryRun });
      if (dryRun) { setPreview(data); setConfirm(''); }
      else {
        toast.success(`Work data cleared (${data.totalRows} records)`);
        setPreview(null); setConfirm('');
        onChanged?.();
      }
    } catch (e) { toast.error(errText(e)); }
    finally { setBusy(false); }
  };

  const rows = preview ? Object.entries(preview.counts).filter(([, n]) => n > 0) : [];
  const nameOk = confirm.trim().toLowerCase() === employeeName.trim().toLowerCase();

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Trash2 className="h-4 w-4" /> Reset work data</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Deletes attendance, leave, tasks, daily reports, payslips, advances, bonuses and notifications for this employee.
          Name, contact details, documents, login and salary setup are kept. Cannot be undone.
        </p>
        {!preview && (
          <Button variant="outline" size="sm" disabled={busy} onClick={() => run(true)}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Preview what will be deleted
          </Button>
        )}
        {preview && (
          <div className="space-y-3">
            {rows.length === 0 ? <p>Nothing to delete — already fresh.</p> : (
              <ul className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
                {rows.map(([t, n]) => (
                  <li key={t} className="flex justify-between border-b py-1"><span>{t.replace(/_/g, ' ')}</span><b>{n}</b></li>
                ))}
              </ul>
            )}
            {rows.length > 0 && (
              <div className="space-y-2">
                <p>Type <b>{employeeName}</b> to confirm deleting {preview.totalRows} records.</p>
                <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={employeeName} />
              </div>
            )}
            <div className="flex gap-2">
              {rows.length > 0 && (
                <Button variant="destructive" size="sm" disabled={busy || !nameOk} onClick={() => run(false)}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Delete work data
                </Button>
              )}
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => setPreview(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Fix one employee's clock-in/out sessions for one day, from the employee profile's Time & leave tab.
 * Same backend as HR → Attendance → "Fix a time" (apply-sessions): edit a time, add a missed
 * session, or remove a wrong one; hours & pay recompute.
 */
import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { attendanceApi } from '@/api/attendanceApi';
import { toast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { BaseInput } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Draft = { id?: number; checkIn: string; checkOut: string };
const hm5 = (t?: string | null) => (t ? t.slice(0, 5) : '');
const mins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const fmtDur = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
const blank = (): Draft[] => [{ checkIn: '', checkOut: '' }];

export default function EditDaySessionsDialog({ employeeId, date, open, onClose, onSaved }: {
  employeeId: number; date: string | null; open: boolean; onClose: () => void; onSaved: () => void;
}) {
  const [sessions, setSessions] = useState<Draft[]>(blank());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !date) return;
    let cancelled = false;
    setLoading(true);
    api.get('/hr/attendance/day', { params: { date } })
      .then((r) => {
        if (cancelled) return;
        const row = (r.data.rows ?? []).find((x: any) => x.id === employeeId);
        const list = row?.sessions ?? [];
        setSessions(list.length ? list.map((s: any) => ({ id: s.id, checkIn: hm5(s.checkIn), checkOut: hm5(s.checkOut) })) : blank());
      })
      .catch(() => { if (!cancelled) setSessions(blank()); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, date, employeeId]);

  const setSess = (i: number, patch: Partial<Draft>) => setSessions((l) => l.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const totalMin = sessions.reduce((sum, s) => (s.checkIn && s.checkOut && mins(s.checkOut) > mins(s.checkIn) ? sum + mins(s.checkOut) - mins(s.checkIn) : sum), 0);

  const apply = async () => {
    if (!date) return;
    const filled = sessions.filter((s) => s.checkIn || s.checkOut);
    if (filled.length === 0) return toast.error('Enter at least one session.');
    if (filled.some((s) => !s.checkIn)) return toast.error('Every session needs a clock-in time.');
    setSaving(true);
    try {
      await attendanceApi.applySessions({
        employeeId, date,
        sessions: filled.map((s) => ({ id: s.id, checkIn: s.checkIn, checkOut: s.checkOut || undefined })),
      });
      toast.success('Applied — attendance & hours updated');
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Could not apply');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Fix time — {date}</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">
          Fix a wrong time, add a missed clock-out or a forgotten session, or remove a wrong one. Hours & pay recompute.
        </p>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Sessions {loading && <Loader2 className="ml-1 inline h-3 w-3 animate-spin" />}</span>
          {totalMin > 0 && <span className="text-xs font-semibold tabular-nums text-slate-700">Total {fmtDur(totalMin)}</span>}
        </div>
        <ul className="space-y-2">
          {sessions.map((s, i) => (
            <li key={s.id ?? `new-${i}`} className="grid grid-cols-[1.5rem_1fr_1fr_auto] items-end gap-2">
              <span className="pb-2.5 text-center text-xs font-medium text-muted-foreground">{i + 1}</span>
              <label className="block">
                {i === 0 && <span className="mb-1 block text-[11px] text-muted-foreground">Clock-in</span>}
                <BaseInput type="time" value={s.checkIn} onChange={(e) => setSess(i, { checkIn: e.target.value })} aria-label={`Session ${i + 1} clock-in`} />
              </label>
              <label className="block">
                {i === 0 && <span className="mb-1 block text-[11px] text-muted-foreground">Clock-out</span>}
                <BaseInput type="time" value={s.checkOut} onChange={(e) => setSess(i, { checkOut: e.target.value })} aria-label={`Session ${i + 1} clock-out`} />
              </label>
              <button type="button" onClick={() => setSessions((l) => (l.length > 1 ? l.filter((_, j) => j !== i) : blank()))}
                className="mb-0.5 grid h-10 w-10 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label={`Remove session ${i + 1}`} title="Remove this session">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
        <Button variant="outline" size="sm" className="w-fit" onClick={() => setSessions((l) => [...l, ...blank()])}>
          <Plus className="h-4 w-4" /> Add session
        </Button>
        <p className="text-[11px] text-muted-foreground">Leave clock-out empty only for a session still running today. Sessions can't overlap.</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={apply} disabled={saving || loading}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Apply</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import api from '@/lib/api';
import SearchableSelect from '@/components/ui/searchable-select';
import { toast } from '@/components/ui/toast';
import { useTr } from '@/i18n';

const BASE = '/employee-portal';

/**
 * Helpers on a task. The task owner, PM or an admin adds a colleague from the project team.
 */
export default function TaskTeamPanel({ taskId, canManage, onChanged }: {
  taskId: number; canManage: boolean; onChanged: () => void;
}) {
  const tr = useTr();
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
  const [pick, setPick] = useState('');

  if (!canManage) return null;

  const run = async (fn: () => Promise<unknown>, ok: string | null, fail: string) => {
    setBusy(true);
    try {
      await fn();
      if (ok) toast.success(ok);
      onChanged();
      return true;
    } catch (e: any) {
      toast.error(e?.response?.data?.message || fail);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const openAdd = async () => {
    setAdding(true);
    try {
      const r = await api.get<{ id: number; name: string }[]>(`${BASE}/tasks/${taskId}/helper-candidates`);
      setOptions(r.data.map((u) => ({ value: String(u.id), label: u.name })));
    } catch (e: any) {
      toast.error(e?.response?.data?.message || tr('pw.team.loadFailed', 'Could not load colleagues.'));
      setAdding(false);
    }
  };

  const card = 'rounded-2xl border border-[#EDE6D8] bg-white p-3.5 shadow-[0_2px_10px_rgba(80,55,20,0.05)]';
  const btn = 'inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold disabled:opacity-60';

  return (
    <div className="flex flex-col gap-2.5">
      {canManage && (
        <div className={card}>
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold text-[#33392F]">{tr('pw.team.helpers', 'Helpers')}</p>
            {!adding && (
              <button onClick={openAdd} className={`${btn} border border-[#0A573B] text-[#0A573B]`}>
                <UserPlus className="h-4 w-4" /> {tr('pw.team.addHelper', 'Add helper')}
              </button>
            )}
          </div>
          {adding && (
            <div className="mt-2.5 flex flex-col gap-2">
              <SearchableSelect value={pick} onChange={setPick} options={options}
                placeholder={tr('pw.team.searchColleague', 'Search colleague…')} />
              <div className="flex gap-2">
                <button disabled={busy || !pick} className={`${btn} flex-1 bg-[#0A573B] text-white`}
                  onClick={async () => {
                    const ok = await run(() => api.post(`${BASE}/tasks/${taskId}/helpers`, { employeeId: Number(pick) }),
                      tr('pw.team.added', 'Helper added.'), tr('pw.team.addFailed', 'Could not add the helper.'));
                    if (ok) { setAdding(false); setPick(''); }
                  }}>
                  {tr('pw.team.add', 'Add')}
                </button>
                <button className={`${btn} border border-[#EDE6D8] text-[#33392F]`} onClick={() => { setAdding(false); setPick(''); }}>
                  {tr('pw.team.close', 'Close')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

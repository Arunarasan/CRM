import { useState } from 'react';
import { Check, Loader2, UserPlus, X } from 'lucide-react';
import api from '@/lib/api';
import SearchableSelect from '@/components/ui/searchable-select';
import { toast } from '@/components/ui/toast';
import { useTr } from '@/i18n';

export interface JoinRequestRow { id: number; employeeId: number; employeeName: string; note?: string | null }

const BASE = '/employee-portal';

/**
 * Helpers on a task. A non-member asks to join (the owner / PM approves); the owner, PM or an admin
 * sees pending requests and can also add a colleague directly.
 */
export default function TaskTeamPanel({ taskId, canRequestJoin, joinRequested, canManage, requests, onChanged }: {
  taskId: number; canRequestJoin: boolean; joinRequested: boolean; canManage: boolean;
  requests: JoinRequestRow[]; onChanged: () => void;
}) {
  const tr = useTr();
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
  const [pick, setPick] = useState('');

  if (!canRequestJoin && !joinRequested && !canManage) return null;

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
      {canRequestJoin && (
        <button disabled={busy} className={`${btn} w-full bg-[#0A573B] py-3 text-white`}
          onClick={() => run(() => api.post(`${BASE}/tasks/${taskId}/join-request`, {}),
            tr('pw.team.requested', 'Request sent to the task owner.'), tr('pw.team.requestFailed', 'Could not send the request.'))}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          {tr('pw.team.requestJoin', 'Request to join this task')}
        </button>
      )}
      {joinRequested && (
        <div className={`${card} flex items-center justify-between gap-2 text-[13px] text-[#33392F]`}>
          <span>{tr('pw.team.waiting', 'Waiting for the task owner to approve your request.')}</span>
          <button disabled={busy} className="shrink-0 text-[12px] font-semibold text-[#B94B45]"
            onClick={() => run(() => api.delete(`${BASE}/tasks/${taskId}/join-request`), null, tr('pw.team.cancelFailed', 'Could not cancel.'))}>
            {tr('pw.team.cancel', 'Cancel')}
          </button>
        </div>
      )}
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
          {requests.length > 0 && (
            <ul className="mt-3 flex flex-col gap-2 border-t border-[#EEE7DA] pt-3">
              <li className="text-[11px] font-semibold uppercase tracking-wide text-[#9A9E96]">
                {tr('pw.team.pending', 'Requests to join')}
              </li>
              {requests.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 text-[13px] text-[#33392F]">
                  <span className="min-w-0 truncate">{r.employeeName}{r.note ? ` — ${r.note}` : ''}</span>
                  <span className="flex shrink-0 gap-1.5">
                    <button disabled={busy} aria-label={tr('pw.team.approve', 'Approve')}
                      className="rounded-lg bg-[#0A573B] p-2 text-white disabled:opacity-60"
                      onClick={() => run(() => api.post(`${BASE}/join-requests/${r.id}/approve`),
                        tr('pw.team.added', 'Helper added.'), tr('pw.team.decideFailed', 'Could not update the request.'))}>
                      <Check className="h-4 w-4" />
                    </button>
                    <button disabled={busy} aria-label={tr('pw.team.reject', 'Decline')}
                      className="rounded-lg border border-[#EDE6D8] p-2 text-[#B94B45] disabled:opacity-60"
                      onClick={() => run(() => api.post(`${BASE}/join-requests/${r.id}/reject`),
                        null, tr('pw.team.decideFailed', 'Could not update the request.'))}>
                      <X className="h-4 w-4" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

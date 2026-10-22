import { useCallback, useEffect, useState } from 'react';
import { PhoneCall } from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { callRecordingApi, errMsg, fmtCallTime, fmtDuration, type CallRecording } from '@/api/callRecordingApi';
import CallLeadPanel, { displayPhone } from '@/components/callRecordings/CallLeadPanel';
import { useT } from '@/i18n';

/**
 * Requests → Call Leads: the shared pool of recorded calls nobody has been given a task for. Any
 * employee can listen, then create a lead, add the call to the lead on that number, or mark it not a
 * lead. The first to close a call takes it; it leaves everyone else's list.
 */
export default function CallLeads() {
  const { t } = useT();
  const [calls, setCalls] = useState<CallRecording[] | null>(null);
  const [tab, setTab] = useState<'open' | 'done'>('open');

  const load = useCallback(() => {
    callRecordingApi.pool().then(setCalls).catch((e) => { toast.error(errMsg(e, 'Could not load calls.')); setCalls([]); });
  }, []);
  useEffect(() => { load(); }, [load]);

  const open = (calls || []).filter((c) => !c.outcome);
  const done = (calls || []).filter((c) => c.outcome);
  const shown = tab === 'open' ? open : done;

  return (
    <div className="flex flex-col gap-3 bg-[#FAF8F3] p-4 pb-28">
      <div>
        <h1 className="text-[19px] font-bold text-[#1A211E]">{t('pw.callLeads.title')}</h1>
        <p className="text-[12.5px] text-[#6B7169]">{t('pw.callLeads.subtitle')}</p>
      </div>

      <div className="flex gap-2">
        {([['open', open.length], ['done', done.length]] as const).map(([k, n]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold ${tab === k ? 'border-[#0A573B] bg-[#0A573B] text-white' : 'border-[#DDE2DE] bg-white text-[#33392F]'}`}>
            {t(k === 'open' ? 'pw.callLeads.open' : 'pw.callLeads.done')} ({n})
          </button>
        ))}
      </div>

      {calls === null ? (
        <p className="p-4 text-center text-[13px] text-[#9A9E96]">{t('pw.loading')}</p>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#DCD3C0] p-6 text-center text-[13px] text-[#8A8F86]">
          <PhoneCall className="mx-auto mb-2 h-6 w-6 text-[#B79A5C]" />
          {t(tab === 'open' ? 'pw.callLeads.none' : 'pw.callLeads.noneDone')}
        </div>
      ) : (
        shown.map((c) => (
          <div key={c.id} className="rounded-2xl border border-[#EDE6D8] bg-white p-3 shadow-[0_2px_10px_rgba(80,55,20,0.05)]">
            <p className="truncate text-[14.5px] font-semibold text-[#1A211E]">
              {c.contactName || displayPhone(c.phoneNumber) || t('pw.calls.unknown')}
            </p>
            <p className="mb-2 text-[11.5px] text-[#8A8F86]">
              {[c.calledAt && fmtCallTime(c.calledAt), fmtDuration(c.durationSec),
                c.uploadedBy && t('pw.tc.addedBy', { name: c.uploadedBy })].filter(Boolean).join(' · ')}
            </p>
            {/* Replace the row in place; a call someone else just closed drops out on refresh. */}
            <CallLeadPanel call={c} onChanged={(u) => setCalls((l) => (l || []).map((x) => (x.id === u.id ? u : x)))} />
          </div>
        ))
      )}
    </div>
  );
}

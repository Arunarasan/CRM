import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Ban, CheckCircle2, Loader2, PhoneCall, Upload } from 'lucide-react';
import AudioPlayer from '@/components/AudioPlayer';
import { resolveFileUrl } from '@/lib/uploadFile';
import { toast } from '@/components/ui/toast';
import { callRecordingApi, errMsg, fmtCallTime, fmtDuration, type CallRecording } from '@/api/callRecordingApi';
import CallLeadPanel, { displayPhone } from '@/components/callRecordings/CallLeadPanel';
import { useT } from '@/i18n';

/**
 * Employee app → My Calls: upload a call from my phone (it becomes a Collect Requirement task for me),
 * and every call I uploaded or was given — listen, see where it ended up, open its task.
 */
export default function MyCalls() {
  const { t } = useT();
  const navigate = useNavigate();
  const [calls, setCalls] = useState<CallRecording[] | null>(null);
  const [note, setNote] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    callRecordingApi.mine().then(setCalls).catch(() => setCalls([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      for (const f of Array.from(files)) {
        setProgress(0);
        await callRecordingApi.uploadMine(f, { note: note.trim() || undefined }, setProgress);
      }
      setNote('');
      toast.success(files.length > 1 ? t('pw.calls.uploadedMany', { n: files.length }) : t('pw.calls.uploadedOne'));
      load();
    } catch (e) {
      toast.error(errMsg(e, t('pw.calls.uploadFailed')));
    } finally {
      setProgress(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-3.5 bg-[#FAF8F3] p-4 pb-28">
      <div>
        <h1 className="text-[19px] font-bold text-[#1A211E]">{t('pw.calls.title')}</h1>
        <p className="text-[12.5px] text-[#6B7169]">{t('pw.calls.subtitle')}</p>
      </div>

      {/* Upload */}
      <div className="rounded-2xl border border-[#EDE6D8] bg-white p-4 shadow-[0_4px_16px_rgba(80,55,20,0.06)]">
        <input ref={fileRef} type="file" accept="audio/*,.m4a,.amr,.3gp,.awb,.opus" multiple className="hidden"
          onChange={(e) => upload(e.target.files)} />
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
          placeholder={t('pw.calls.notePh')}
          className="w-full rounded-xl border border-[#DDE2DE] bg-white px-3 py-2.5 text-[13px] outline-none focus:border-[#0A573B]" />
        <button onClick={() => fileRef.current?.click()} disabled={progress !== null}
          className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0A573B] py-3 text-[14.5px] font-semibold text-white active:scale-[0.99] disabled:opacity-70">
          {progress !== null ? <><Loader2 className="h-4 w-4 animate-spin" /> {t('pw.calls.uploading', { p: progress })}</> : <><Upload className="h-4 w-4" /> {t('pw.calls.upload')}</>}
        </button>
        <p className="mt-2 text-[11.5px] text-[#8A8F86]">{t('pw.calls.hint')}</p>
      </div>

      {/* List */}
      {calls === null ? (
        <p className="p-4 text-center text-[13px] text-[#9A9E96]">{t('pw.loading')}</p>
      ) : calls.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#DCD3C0] p-6 text-center text-[13px] text-[#8A8F86]">
          <PhoneCall className="mx-auto mb-2 h-6 w-6 text-[#B79A5C]" /> {t('pw.calls.none')}
        </div>
      ) : (
        calls.map((c) => (
          <CallCard key={c.id} call={c}
            onOpen={() => c.taskId && navigate(`/employee/tasks/${c.taskId}`)}
            onChanged={(u) => setCalls((l) => (l || []).map((x) => (x.id === u.id ? u : x)))} />
        ))
      )}
    </div>
  );
}

function CallCard({ call, onOpen, onChanged }: { call: CallRecording; onOpen: () => void; onChanged: (c: CallRecording) => void }) {
  const { t } = useT();
  const who = call.contactName || displayPhone(call.phoneNumber) || t('pw.calls.unknown');
  const open = !call.outcome;
  return (
    <div className="rounded-2xl border border-[#EDE6D8] bg-white p-3.5 shadow-[0_2px_10px_rgba(80,55,20,0.05)]">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[14.5px] font-semibold text-[#1A211E]">{who}</p>
          <p className="text-[11.5px] text-[#8A8F86]">
            {[call.calledAt && fmtCallTime(call.calledAt), fmtDuration(call.durationSec), call.direction === 'IN' ? t('pw.calls.incoming') : call.direction === 'OUT' ? t('pw.calls.outgoing') : null,
              call.uploadedBy && t('pw.tc.addedBy', { name: call.uploadedBy })]
              .filter(Boolean).join(' · ')}
          </p>
        </div>
        <Status call={call} />
      </div>
      <AudioPlayer src={resolveFileUrl(call.fileUrl)} fileName={call.fileName} />
      {call.note && <p className="mt-2 rounded-lg bg-[#F6F4EC] px-2.5 py-1.5 text-[12.5px] text-[#33392F]">{call.note}</p>}
      {!call.taskId && open && <div className="mt-2.5"><CallLeadPanel call={call} onChanged={onChanged} showPlayer={false} /></div>}
      {call.taskId && (
        <button onClick={onOpen}
          className={`mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-semibold active:scale-[0.99] ${
            open ? 'bg-[#0A573B] text-white' : 'border border-[#D7DED8] bg-white text-[#0A573B]'}`}>
          {open ? t('pw.calls.collect') : t('pw.calls.openTask')} <ArrowRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function Status({ call }: { call: CallRecording }) {
  const { t } = useT();
  if (call.outcome === 'NOT_A_LEAD') {
    return <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-semibold text-slate-600"><Ban className="h-3 w-3" /> {t('pw.calls.notLead')}</span>;
  }
  if (call.outcome) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#E7F2EC] px-2 py-0.5 text-[10.5px] font-semibold text-[#2C7050]">
        <CheckCircle2 className="h-3 w-3" /> {call.lead?.leadNumber || (call.outcome === 'LEAD_CREATED' ? t('pw.calls.leadCreated') : t('pw.calls.addedToLead'))}
      </span>
    );
  }
  return <span className="shrink-0 rounded-full bg-[#FBEFE0] px-2 py-0.5 text-[10.5px] font-semibold text-[#9B6B32]">{t('pw.calls.todo')}</span>;
}

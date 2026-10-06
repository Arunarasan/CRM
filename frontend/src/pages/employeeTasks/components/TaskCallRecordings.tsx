import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Mic, Plus, Upload } from 'lucide-react';
import AudioPlayer from '@/components/AudioPlayer';
import { resolveFileUrl } from '@/lib/uploadFile';
import { callRecordingApi, errMsg, fmtCallTime, fmtDuration, type CallRecording, type TaskCalls } from '@/api/callRecordingApi';

/**
 * Call recordings on a lead task: the calls already on the lead (each one is also on the lead's
 * Documents → Call recordings), an upload for a new recording, and open calls from the same phone number
 * that can be added with one tap.
 */
export default function TaskCallRecordings({ taskId }: { taskId: number }) {
  const [data, setData] = useState<TaskCalls | null>(null);
  const [busy, setBusy] = useState<number | 'upload' | null>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    callRecordingApi.taskCalls(taskId).then(setData).catch(() => setData({ leadCalls: [], suggestions: [] }));
  }, [taskId]);
  useEffect(() => { load(); }, [load]);

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError('');
    setBusy('upload');
    try {
      for (const f of Array.from(files)) await callRecordingApi.uploadForTask(taskId, f);
      load();
    } catch (e) {
      setError(errMsg(e, 'Could not upload the recording.'));
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const add = async (c: CallRecording) => {
    setError('');
    setBusy(c.id);
    try { await callRecordingApi.addToTask(c.id, taskId); load(); }
    catch (e) { setError(errMsg(e, 'Could not add the call.')); }
    finally { setBusy(null); }
  };

  if (!data) return <p className="text-xs text-muted-foreground">Loading calls…</p>;

  return (
    <div className="flex flex-col gap-2.5">
      {data.leadCalls.length === 0 && <p className="text-xs text-muted-foreground">No call recordings on this lead yet.</p>}
      {data.leadCalls.map((c) => <CallRow key={c.id} call={c} />)}

      <input ref={fileRef} type="file" accept="audio/*,.m4a,.amr,.3gp,.awb,.opus" multiple className="hidden"
        onChange={(e) => upload(e.target.files)} />
      <button type="button" onClick={() => fileRef.current?.click()} disabled={busy !== null}
        className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#C9B88F] bg-[#FBF8F1] py-2.5 text-[13px] font-semibold text-[#8A6A2E] disabled:opacity-60">
        {busy === 'upload' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {busy === 'upload' ? 'Uploading…' : 'Upload call recording'}
      </button>

      {data.suggestions.length > 0 && (
        <div className="rounded-xl border border-[#E4DECF] bg-white p-2.5">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#9B6B32]">Other calls from this number</p>
          <div className="flex flex-col gap-2">
            {data.suggestions.map((c) => (
              <div key={c.id} className="flex flex-col gap-1.5 border-b border-[#F1ECE2] pb-2 last:border-0 last:pb-0">
                <CallRow call={c} compact />
                <button type="button" onClick={() => add(c)} disabled={busy !== null}
                  className="flex items-center justify-center gap-1 rounded-lg bg-[#0A573B] py-1.5 text-[12px] font-semibold text-white disabled:opacity-60">
                  {busy === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add to this lead
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {error && <p className="rounded-md bg-destructive/15 p-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function CallRow({ call, compact }: { call: CallRecording; compact?: boolean }) {
  return (
    <div className={compact ? '' : 'rounded-xl border border-[#EFE9DC] bg-[#FBFAF6] p-2.5'}>
      <AudioPlayer src={resolveFileUrl(call.fileUrl)} fileName={call.fileName} />
      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-[#6B7169]">
        <Mic className="h-3 w-3" />
        {[call.calledAt && fmtCallTime(call.calledAt), fmtDuration(call.durationSec), call.phoneNumber,
          call.uploadedBy && `added by ${call.uploadedBy}`].filter(Boolean).join(' · ')}
      </p>
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Mic, Send, TrendingUp } from 'lucide-react';
import AudioCaptureField, { CapturedAudio } from '@/components/AudioCaptureField';
import { projectWorkApi } from '@/api/projectWorkApi';
import { resolveFileUrl } from '@/lib/uploadFile';
import { toast } from '@/components/ui/toast';
import { DailyLog, WorkBoard } from '@/types/projectWork';
import { CARD, INPUT, PRIMARY, PhotoPicker, Thumbs, errMsg, fmtDay } from './workUi';
import AudioPlayer from "@/components/AudioPlayer";

/**
 * Day-by-day log on a project task: what was done today, the plan for tomorrow, photos and a voice note.
 * On Installation the team can also move each category's bar in the same entry.
 */
export default function DailyLogPanel({ taskId, board, installation, editable, onSaved }: {
  taskId: number;
  board?: WorkBoard | null;
  installation?: boolean;
  editable: boolean;
  onSaved?: () => void;
}) {
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [workDone, setWorkDone] = useState('');
  const [plan, setPlan] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [voice, setVoice] = useState<CapturedAudio[]>([]);
  const [percents, setPercents] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    projectWorkApi.dailyLogs(taskId).then(setLogs).catch(() => {});
  }, [taskId]);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!workDone.trim() && !plan.trim()) { toast.error('Write what was done today or the plan for tomorrow'); return; }
    setBusy(true);
    try {
      await projectWorkApi.addDailyLog(taskId, {
        workDone: workDone.trim() || undefined,
        tomorrowPlan: plan.trim() || undefined,
        photos,
        audioUrl: voice[0]?.url,
        categoryPercents: Object.keys(percents).length ? percents : undefined,
      });
      setWorkDone(''); setPlan(''); setPhotos([]); setVoice([]); setPercents({});
      toast.success("Today's update saved");
      load();
      onSaved?.();
    } catch (e) {
      toast.error(errMsg(e, 'Could not save the update'));
    } finally {
      setBusy(false);
    }
  };

  // Plan from the latest entry — shown as "planned for today" on the composer.
  const lastPlan = logs.find((l) => l.tomorrowPlan)?.tomorrowPlan;

  return (
    <div className="flex flex-col gap-3">
      {editable && (
        <div className={`${CARD} p-4`}>
          <p className="mb-2.5 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-[#9B6B32]">
            <CalendarDays className="h-4 w-4" /> Today's update
          </p>
          {lastPlan && (
            <p className="mb-2.5 rounded-xl bg-[#F6F4EC] p-2.5 text-[12.5px] text-[#5E655D]">
              <span className="font-semibold text-[#33392F]">Planned: </span>{lastPlan}
            </p>
          )}
          <label className="mb-1 block text-[12px] font-medium text-[#5E655D]">Work done today</label>
          <textarea value={workDone} onChange={(e) => setWorkDone(e.target.value)} rows={3}
            placeholder="e.g. Curtains hung in Bedroom 1 & 2" className={INPUT} />
          <label className="mb-1 mt-2.5 block text-[12px] font-medium text-[#5E655D]">Plan for tomorrow</label>
          <textarea value={plan} onChange={(e) => setPlan(e.target.value)} rows={2}
            placeholder="e.g. Wallpaper on the hall wall" className={INPUT} />

          {installation && board && board.install.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 text-[12px] font-medium text-[#5E655D]">Move the bars (optional)</p>
              <div className="flex flex-col gap-2">
                {board.install.map((c) => {
                  const v = percents[c.id] ?? c.percent;
                  return (
                    <div key={c.id} className="flex items-center gap-2.5">
                      <span className="w-24 shrink-0 truncate text-[12.5px] text-[#33392F]">{c.category}</span>
                      <input type="range" min={0} max={100} step={5} value={v}
                        onChange={(e) => setPercents((p) => ({ ...p, [c.id]: Number(e.target.value) }))}
                        className="flex-1 accent-[#9B6B32]" />
                      <span className="w-10 text-right text-[12.5px] font-semibold text-[#9B6B32]">{v}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <PhotoPicker multiple onUploaded={(url) => setPhotos((p) => [...p, url])} />
          </div>
          {photos.length > 0 && <div className="mt-2"><Thumbs urls={photos} onRemove={(i) => setPhotos((p) => p.filter((_, j) => j !== i))} /></div>}
          <div className="mt-2">
            <AudioCaptureField value={voice} onChange={(v) => setVoice(v.slice(-1))} module="PROJECT_WORK" label="Voice note (optional)" />
          </div>
          <button onClick={submit} disabled={busy} className={`${PRIMARY} mt-3 w-full`}>
            <Send className="h-4 w-4" /> Save today's update
          </button>
        </div>
      )}

      {logs.length === 0 && !editable && <p className="text-[13px] text-[#9A9E96]">No daily updates yet.</p>}
      <ol className="flex flex-col gap-2.5">
        {logs.map((l) => {
          const moved = (l.percentAfter ?? 0) - (l.percentBefore ?? 0);
          return (
            <li key={l.id} className={`${CARD} p-3.5`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-semibold text-[#1A211E]">{fmtDay(l.logDate)}</p>
                <span className="flex items-center gap-1 text-[12px] font-semibold text-[#0A573B]">
                  <TrendingUp className="h-3.5 w-3.5" />
                  {l.percentBefore ?? 0}% → {l.percentAfter ?? 0}%{moved > 0 ? ` (+${moved})` : ''}
                </span>
              </div>
              {l.workDone && <p className="mt-1.5 whitespace-pre-wrap text-[13px] text-[#33392F]"><span className="font-medium text-[#0A573B]">Done: </span>{l.workDone}</p>}
              {l.tomorrowPlan && <p className="mt-1 whitespace-pre-wrap text-[13px] text-[#5E655D]"><span className="font-medium text-[#9B6B32]">Tomorrow: </span>{l.tomorrowPlan}</p>}
              {l.photos.length > 0 && <div className="mt-2"><Thumbs urls={l.photos} size="h-14 w-14" /></div>}
              {l.audioUrl && (
                <div className="mt-2 flex items-center gap-2">
                  <Mic className="h-4 w-4 shrink-0 text-[#9B6B32]" />
                  <AudioPlayer src={resolveFileUrl(l.audioUrl)} className="w-full max-w-[260px]" />
                </div>
              )}
              <p className="mt-1.5 text-[11px] text-[#9A9E96]">{l.authorName}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

import { format } from "date-fns";
import { resolveFileUrl } from "@/lib/uploadFile";
import { CheckCircle2, Clock, MapPin, Paperclip } from "lucide-react";

// -------------------------------------------------------------- small helpers
const dt = (iso?: string | null) => { if (!iso) return null; const d = new Date(iso); return isNaN(d.getTime()) ? null : d; };
const fmtTime = (iso?: string | null) => { const d = dt(iso); return d ? format(d, 'h:mm a') : null; };
const fmtDateTime = (iso?: string | null) => { const d = dt(iso); return d ? format(d, 'd MMM, h:mm a') : '—'; };
const fmtDate = (iso?: string | null) => { const d = dt(iso); return d ? format(d, 'd MMM yyyy') : '—'; };

/** Human duration between two timestamps, e.g. "2h 15m". */
const durationBetween = (from?: string | null, to?: string | null): string | null => {
  const a = dt(from), b = dt(to);
  if (!a || !b) return null;
  const mins = Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

/** Hours (decimal) rendered as "3h 30m". */
const hoursToText = (hours?: number | null): string | null => {
  if (hours == null) return null;
  const totalMin = Math.round(Number(hours) * 60);
  if (!isFinite(totalMin) || totalMin <= 0) return null;
  const h = Math.floor(totalMin / 60), m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const initials = (name?: string) =>
  (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || '?';

/** A titled block separated from the previous one by a rule — plain, readable, sentence-case. */
function Block({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="pt-6 mt-6 border-t border-slate-200 first:border-t-0 first:mt-0 first:pt-0">
      <h3 className="text-[15px] font-semibold text-slate-800 mb-3">
        {title}{note && <span className="ml-2 text-sm font-normal text-slate-400">{note}</span>}
      </h3>
      {children}
    </section>
  );
}

/**
 * A plain-language "job card" for one field task — reads top to bottom like a report a site
 * manager would write: what happened, who did it and when, what was used, and the evidence.
 * `detail` = GET /api/employee-tasks/{id}; `assignments` = GET /api/tasks/{id}/assignments.
 */
export default function TaskExecutionReport({ task, detail, assignments }: { task: any; detail: any; assignments: any[] }) {
  if (!detail) return <p className="text-sm text-slate-400 py-6">Loading task details…</p>;

  const team: any[] = detail.team || [];
  const checkins: any[] = detail.checkins || [];
  const checklists: any[] = detail.checklist || [];
  const progress: any[] = detail.progress || [];
  const materials: any[] = detail.materialUsage || [];
  const issues: any[] = detail.issues || [];
  const attachments: any[] = detail.attachments || [];
  const comments: any[] = detail.comments || [];

  // Per-employee timings (started/completed) from the assignment ledger, keyed by employee id.
  const timingByEmp = new Map<number, any>();
  team.forEach(t => { if (t.employeeId != null) timingByEmp.set(t.employeeId, t); });

  // Actual on-site span: earliest check-in → latest check-out; task dates are the fallback.
  const checkInTimes = checkins.map(c => dt(c.checkInTime)).filter(Boolean) as Date[];
  const checkOutTimes = checkins.map(c => dt(c.checkOutTime)).filter(Boolean) as Date[];
  const firstCheckIn = checkInTimes.length ? new Date(Math.min(...checkInTimes.map(d => d.getTime()))).toISOString() : null;
  const lastCheckOut = checkOutTimes.length ? new Date(Math.max(...checkOutTimes.map(d => d.getTime()))).toISOString() : null;

  const startedIso = firstCheckIn || detail.startDate || task?.startDate;
  const endedIso = lastCheckOut || (task?.status === 'COMPLETED' ? (detail.completedDate || task?.completedDate) : null);
  const durationText = durationBetween(startedIso, endedIso) || hoursToText(detail.actualHours) || hoursToText(task?.actualHours);

  const done = task?.status === 'COMPLETED';
  const roster = assignments.length ? assignments : team;
  const totalSteps = checklists.reduce((n, cl) => n + (cl.items?.length || 0), 0);
  const doneSteps = checklists.reduce((n, cl) => n + (cl.items?.filter((i: any) => i.isCompleted).length || 0), 0);
  const completionRemarks = team.map(t => t.remarks).filter(Boolean);
  const workerNames = roster.map((a: any) => a.employeeName).filter(Boolean);

  // Plain-English one-liner under the status.
  const summary = (() => {
    const who = workerNames.length === 0 ? 'No one was assigned'
      : workerNames.length === 1 ? workerNames[0]
      : workerNames.length === 2 ? `${workerNames[0]} and ${workerNames[1]}`
      : `${workerNames[0]} and ${workerNames.length - 1} others`;
    const span = fmtTime(startedIso) && fmtTime(endedIso) ? ` from ${fmtTime(startedIso)} to ${fmtTime(endedIso)}` : '';
    const took = durationText ? ` — about ${durationText} of work` : '';
    if (done) return `${who} worked on this${span}${took}.`;
    if (workerNames.length) return `${who} ${workerNames.length === 1 ? 'is' : 'are'} working on this${span ? `, started at ${fmtTime(startedIso)}` : ''}.`;
    return 'This task has not been picked up yet.';
  })();

  const nothingLogged = progress.length === 0 && materials.length === 0 && issues.length === 0
    && checkins.length === 0 && totalSteps === 0 && attachments.length === 0 && comments.length === 0;

  // The three headline facts, only shown when we actually have them.
  const facts: { label: string; value: string }[] = [];
  if (fmtTime(startedIso) || dt(startedIso)) facts.push({ label: 'Started', value: fmtDateTime(startedIso) });
  if (done) facts.push({ label: 'Finished', value: fmtDateTime(endedIso) });
  else facts.push({ label: 'Due', value: fmtDate(detail.dueDate || task?.dueDate) });
  if (durationText) facts.push({ label: 'Time taken', value: durationText });

  return (
    <div className="text-slate-700">
      {/* -------- Headline: status + plain summary -------- */}
      <div className={`rounded-xl p-4 sm:p-5 ${done ? 'bg-emerald-50' : 'bg-slate-100'}`}>
        <div className="flex items-center gap-2">
          {done
            ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            : <Clock className="h-5 w-5 text-slate-500" />}
          <span className={`text-base font-bold ${done ? 'text-emerald-800' : 'text-slate-700'}`}>
            {done ? 'Completed' : (task?.status || 'In progress').replace(/_/g, ' ')}
          </span>
          {done && (detail.completedDate || task?.completedDate) && (
            <span className="text-sm text-emerald-700/80">· {fmtDate(detail.completedDate || task?.completedDate)}</span>
          )}
        </div>
        <p className="mt-2 text-sm text-slate-600">{summary}</p>

        {facts.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
            {facts.map(f => (
              <div key={f.label}>
                <div className="text-xs text-slate-400">{f.label}</div>
                <div className="text-sm font-semibold text-slate-800">{f.value}</div>
              </div>
            ))}
            {(detail.estimatedHours != null) && (
              <div>
                <div className="text-xs text-slate-400">Estimated</div>
                <div className="text-sm font-semibold text-slate-800">{hoursToText(detail.estimatedHours) || '—'}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* -------- Who worked on it -------- */}
      {roster.length > 0 && (
        <Block title="Who worked on it">
          <ul className="space-y-2.5">
            {roster.map((a: any) => {
              const t = timingByEmp.get(a.employeeId) || a;
              const span = fmtTime(t.startedAt) && fmtTime(t.completedAt)
                ? `${fmtTime(t.startedAt)} – ${fmtTime(t.completedAt)}` : (fmtTime(t.startedAt) ? `from ${fmtTime(t.startedAt)}` : null);
              const dur = durationBetween(t.startedAt, t.completedAt);
              return (
                <li key={a.employeeId ?? a.employeeName} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                    {initials(a.employeeName)}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-800">
                      {a.employeeName || 'Unnamed'}
                      {a.role && <span className="font-normal text-slate-400"> · {a.role}</span>}
                    </div>
                    <div className="text-xs text-slate-500">
                      {span ? <>Worked {span}{dur && <span className="text-slate-400"> ({dur})</span>}</> : (a.status ? a.status.replace(/_/g, ' ') : 'Assigned')}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Block>
      )}

      {/* -------- On-site check-ins -------- */}
      {checkins.length > 0 && (
        <Block title="Site check-ins">
          <ul className="space-y-2">
            {checkins.map((c: any) => (
              <li key={c.id} className="flex items-start gap-2 text-sm">
                <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-slate-400" />
                <span>
                  <span className="font-medium text-slate-800">{c.employeeName || 'Employee'}</span>
                  {' '}arrived {fmtTime(c.checkInTime) || fmtDateTime(c.checkInTime)}
                  {c.checkOutTime ? `, left ${fmtTime(c.checkOutTime)}` : ' (still on site)'}
                  {durationBetween(c.checkInTime, c.checkOutTime) && <span className="text-slate-400"> · {durationBetween(c.checkInTime, c.checkOutTime)} on site</span>}
                  {c.locationLabel && <span className="block text-xs text-slate-400">{c.locationLabel}</span>}
                </span>
              </li>
            ))}
          </ul>
        </Block>
      )}

      {/* -------- Work steps (checklist) -------- */}
      {totalSteps > 0 && (
        <Block title="Work steps" note={`${doneSteps} of ${totalSteps} done`}>
          <div className="space-y-3">
            {checklists.map((cl: any) => (
              (cl.items?.length ?? 0) > 0 && (
                <div key={cl.id}>
                  {cl.name && checklists.length > 1 && <p className="text-xs font-medium text-slate-400 mb-1.5">{cl.name}</p>}
                  <ul className="space-y-1.5">
                    {[...cl.items].sort((a: any, b: any) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)).map((i: any) => (
                      <li key={i.id} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className={`h-4 w-4 shrink-0 mt-0.5 ${i.isCompleted ? 'text-emerald-500' : 'text-slate-300'}`} />
                        <span className={i.isCompleted ? 'text-slate-500 line-through' : 'text-slate-700'}>{i.content}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            ))}
          </div>
        </Block>
      )}

      {/* -------- What was done (progress timeline) -------- */}
      {progress.length > 0 && (
        <Block title="What was done">
          <ol className="relative border-l-2 border-slate-100 pl-4 space-y-4">
            {progress.map((p: any) => (
              <li key={p.id} className="relative">
                <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-white" />
                <div className="text-sm">
                  <span className="font-medium text-slate-800">{p.employeeName || 'Employee'}</span>
                  {p.progressPercent != null && <span className="text-slate-500"> updated progress to {p.progressPercent}%</span>}
                  <span className="text-slate-400 text-xs"> · {fmtDateTime(p.createdAt)}</span>
                  {p.timeSpentMinutes != null && <span className="text-slate-400 text-xs"> · {p.timeSpentMinutes} min</span>}
                </div>
                {p.remarks && <p className="text-sm text-slate-600 mt-0.5">{p.remarks}</p>}
                {p.media?.length > 0 && (
                  <div className="mt-2 flex gap-2 overflow-x-auto">
                    {p.media.map((m: any, i: number) => (
                      (m.mediaType === 'PHOTO' || m.mediaType === 'Image') ? (
                        <a key={i} href={resolveFileUrl(m.fileUrl)} target="_blank" rel="noreferrer" className="shrink-0">
                          <img src={resolveFileUrl(m.fileUrl)} alt="work" className="h-20 w-20 rounded-lg border border-slate-200 object-cover" />
                        </a>
                      ) : (
                        <a key={i} href={resolveFileUrl(m.fileUrl)} target="_blank" rel="noreferrer"
                           className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-[10px] text-slate-500">
                          {m.mediaType}
                        </a>
                      )
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </Block>
      )}

      {/* -------- Materials used -------- */}
      {materials.length > 0 && (
        <Block title="Materials used">
          <ul className="divide-y divide-slate-100">
            {materials.map((m: any) => (
              <li key={m.id} className="flex flex-wrap items-baseline justify-between gap-x-3 py-2 text-sm">
                <span className="font-medium text-slate-800">{m.productName}</span>
                <span className="text-slate-600">
                  {String(m.quantityUsed)} {m.unit}
                  {m.usedByName && <span className="text-slate-400"> · by {m.usedByName}</span>}
                </span>
                {m.remarks && <span className="w-full text-xs text-slate-400">{m.remarks}</span>}
              </li>
            ))}
          </ul>
        </Block>
      )}

      {/* -------- Issues -------- */}
      {issues.length > 0 && (
        <Block title="Issues reported">
          <ul className="space-y-1.5 text-sm">
            {issues.map((i: any) => (
              <li key={i.id}>
                <span className="font-medium text-slate-800">{(i.issueType || 'Issue').replace(/_/g, ' ')}</span>
                {i.description ? <span className="text-slate-600"> — {i.description}</span> : ''}
                <span className="text-slate-400 text-xs"> ({i.status}{i.employeeName ? ` · ${i.employeeName}` : ''})</span>
              </li>
            ))}
          </ul>
        </Block>
      )}

      {/* -------- Files -------- */}
      {attachments.length > 0 && (
        <Block title="Files">
          <div className="flex flex-wrap gap-2">
            {attachments.map((a: any) => (
              <a key={a.id} href={resolveFileUrl(a.fileUrl)} target="_blank" rel="noreferrer"
                 className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-emerald-700 hover:bg-slate-50">
                <Paperclip className="h-3.5 w-3.5" /> <span className="truncate max-w-[200px]">{a.fileName || 'File'}</span>
              </a>
            ))}
          </div>
        </Block>
      )}

      {/* -------- Notes -------- */}
      {(completionRemarks.length > 0 || comments.length > 0) && (
        <Block title="Notes">
          <div className="space-y-2.5">
            {completionRemarks.map((r: string, idx: number) => (
              <p key={`r${idx}`} className="text-sm text-slate-600">“{r}”</p>
            ))}
            {comments.map((c: any) => (
              <div key={c.id} className="text-sm">
                <span className="font-medium text-slate-700">{c.authorName || 'User'}</span>
                <span className="text-slate-400 text-xs"> · {fmtDateTime(c.createdAt)}</span>
                <p className="text-slate-600">{c.content}</p>
              </div>
            ))}
          </div>
        </Block>
      )}

      {nothingLogged && (
        <p className="mt-6 text-sm text-slate-400">Nothing was logged for this task yet — no check-ins, progress updates, photos or materials.</p>
      )}
    </div>
  );
}

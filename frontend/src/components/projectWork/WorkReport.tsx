import { Fragment, useEffect, useState } from 'react';
import { Mic } from 'lucide-react';
import { projectWorkApi } from '@/api/projectWorkApi';
import { resolveFileUrl } from '@/lib/uploadFile';
import { DailyLog, EVENT_LABELS, WorkBoard, WorkEvent, WorkStep, WorkStepType } from '@/types/projectWork';
import { stepSummary } from './ExecutionBoard';
import AudioPlayer from "@/components/AudioPlayer";

const fmt = (s?: string | null) =>
  s ? new Date(s).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '—';

function Block({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 border-t border-slate-200 pt-6 first:mt-0 first:border-t-0 first:pt-0 break-inside-avoid-page">
      <h3 className="mb-3 text-[15px] font-semibold text-slate-800">
        {title}{note && <span className="ml-2 text-sm font-normal text-slate-400">{note}</span>}
      </h3>
      {children}
    </section>
  );
}

const pctCls = (p: number) => (p >= 100 ? 'text-emerald-700' : p > 0 ? 'text-amber-700' : 'text-slate-400');

/**
 * Printable report for a project's Execution or Installation task: product steps (with PO, delivery
 * route, who / when and photos) or category installation checklists, the day-by-day log and history.
 */
export default function WorkReport({ projectId, taskId, kind }: {
  projectId: number; taskId: number; kind: 'execution' | 'installation';
}) {
  const [board, setBoard] = useState<WorkBoard | null>(null);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [events, setEvents] = useState<WorkEvent[]>([]);

  useEffect(() => {
    projectWorkApi.board(projectId).then(setBoard).catch(() => {});
    projectWorkApi.dailyLogs(taskId).then(setLogs).catch(() => {});
    projectWorkApi.events(projectId).then(setEvents).catch(() => {});
  }, [projectId, taskId]);

  if (!board) return <p className="py-6 text-center text-sm text-slate-400">Loading the work report…</p>;

  const installation = kind === 'installation';
  const relevant = events.filter((e) => (installation ? e.stepType === 'INSTALL' : e.stepType !== 'INSTALL'));
  const columns: WorkStepType[] = ['MATERIAL', 'MANUFACTURE', 'STITCHING', 'DELIVERY'];
  const usedCols = columns.filter((c) => board.categories.some((cat) => cat.lines.some((l) => l.steps.some((s) => s.stepType === c))));
  const colLabel: Record<WorkStepType, string> = { MATERIAL: 'Material', MANUFACTURE: 'Manufacture', STITCHING: 'Stitching', DELIVERY: 'Delivery' };

  return (
    <div className="text-slate-700">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: installation ? 'Installation' : 'Execution', value: `${installation ? board.installationPercent : board.executionPercent}%` },
          { label: 'Overall project', value: `${board.overallPercent}%` },
          { label: 'Products at site', value: `${board.atSiteCount}/${board.productCount}` },
          { label: 'Categories installed', value: `${board.install.filter((c) => c.percent >= 100).length}/${board.install.length}` },
        ].map((k) => (
          <div key={k.label} className="rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{k.label}</p>
            <p className="text-lg font-bold text-slate-800">{k.value}</p>
          </div>
        ))}
      </div>

      {!installation && (
        <Block title="Products" note={`${board.productCount} products in ${board.categories.length} categories`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-3 font-semibold">Product</th>
                  {usedCols.map((c) => <th key={c} className="py-2 pr-3 font-semibold">{colLabel[c]}</th>)}
                  <th className="py-2 text-right font-semibold">Done</th>
                </tr>
              </thead>
              <tbody>
                {board.categories.map((cat) => (
                  <Fragment key={cat.category}>
                    <tr className="bg-slate-50">
                      <td colSpan={usedCols.length + 2} className="px-2 py-1.5 text-[12px] font-semibold text-slate-600">
                        {cat.category} · {cat.percent}% · {cat.atSiteCount}/{cat.productCount} at site
                      </td>
                    </tr>
                    {cat.lines.map((l) => (
                      <tr key={l.id} className="border-b border-slate-100 align-top">
                        <td className="py-2 pr-3">
                          <p className="font-medium text-slate-800">{l.itemName}</p>
                          <p className="text-[11.5px] text-slate-400">
                            {[l.color, l.quantity != null && `${Number(l.quantity)} ${l.unit || ''}`.trim(), l.location].filter(Boolean).join(' · ')}
                          </p>
                        </td>
                        {usedCols.map((c) => {
                          const s: WorkStep | undefined = l.steps.find((x) => x.stepType === c);
                          return (
                            <td key={c} className="py-2 pr-3">
                              {s ? (
                                <>
                                  <p className={`font-semibold ${pctCls(s.percent)}`}>{s.percent}%</p>
                                  <p className="text-[11.5px] text-slate-500">{stepSummary(s)}</p>
                                  {s.updatedByName && <p className="text-[11px] text-slate-400">{s.updatedByName}{s.doneAt ? ` · ${fmt(s.doneAt)}` : ''}</p>}
                                  {s.photoUrl && (
                                    <a href={resolveFileUrl(s.photoUrl)} target="_blank" rel="noopener noreferrer">
                                      <img src={resolveFileUrl(s.photoUrl)} alt="" className="mt-1 h-10 w-10 rounded object-cover" />
                                    </a>
                                  )}
                                </>
                              ) : <span className="text-slate-300">—</span>}
                            </td>
                          );
                        })}
                        <td className={`py-2 text-right font-bold ${pctCls(l.percent)}`}>{l.percent}%</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </Block>
      )}

      {installation && (
        <Block title="Installation by category">
          <div className="space-y-4">
            {board.install.map((c) => (
              <div key={c.id} className="break-inside-avoid">
                <div className="flex items-baseline justify-between">
                  <p className="font-semibold text-slate-800">{c.category}</p>
                  <p className={`font-bold ${pctCls(c.percent)}`}>{c.percent}%</p>
                </div>
                <p className="text-[12px] text-slate-400">
                  {c.ready ? 'All products at site' : `${c.waitingCount} of ${c.productCount} products not at site`}
                  {c.manualPercent != null ? ` · progress set to ${c.manualPercent}%` : ''}
                </p>
                <ul className="mt-1.5 space-y-1">
                  {c.steps.map((s) => (
                    <li key={s.id} className="flex items-start gap-2 text-[13px]">
                      <span className={s.done ? 'text-emerald-600' : 'text-slate-300'}>{s.done ? '✔' : '○'}</span>
                      <span className={s.done ? 'text-slate-700' : 'text-slate-400'}>{s.content}</span>
                      {s.done && <span className="ml-auto shrink-0 text-[11px] text-slate-400">{s.doneByName} · {fmt(s.doneAt)}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Block>
      )}

      <Block title="Day by day" note={logs.length ? `${logs.length} updates` : undefined}>
        {logs.length === 0 ? <p className="text-sm text-slate-400">No daily updates were posted.</p> : (
          <ol className="space-y-4">
            {[...logs].reverse().map((l) => (
              <li key={l.id} className="break-inside-avoid border-l-2 border-emerald-200 pl-3">
                <p className="text-[13px] font-semibold text-slate-800">
                  {fmtDate(l.logDate)}
                  <span className="ml-2 font-normal text-slate-400">{l.authorName} · {l.percentBefore ?? 0}% → {l.percentAfter ?? 0}%</span>
                </p>
                {l.workDone && <p className="text-[13px]"><span className="font-medium text-emerald-700">Done: </span>{l.workDone}</p>}
                {l.tomorrowPlan && <p className="text-[13px] text-slate-500"><span className="font-medium text-amber-700">Next: </span>{l.tomorrowPlan}</p>}
                {l.photos.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {l.photos.map((p, i) => (
                      <a key={i} href={resolveFileUrl(p)} target="_blank" rel="noopener noreferrer">
                        <img src={resolveFileUrl(p)} alt="" className="h-16 w-16 rounded object-cover" />
                      </a>
                    ))}
                  </div>
                )}
                {l.audioUrl && (
                  <p className="mt-1 flex items-center gap-1.5 print:hidden">
                    <Mic className="h-3.5 w-3.5 text-amber-700" /><AudioPlayer src={resolveFileUrl(l.audioUrl)} className="w-60 max-w-full" />
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </Block>

      {relevant.length > 0 && (
        <Block title="History" note="every step change, newest first">
          <ul className="space-y-1.5 text-[12.5px]">
            {relevant.map((e) => (
              <li key={e.id} className="flex gap-2">
                <span className="w-36 shrink-0 text-slate-400">{fmt(e.createdAt)}</span>
                <span>
                  <span className="font-medium text-slate-800">{e.itemName || e.category || 'Project'}</span>
                  {e.stepType && e.stepType !== 'INSTALL' && <span className="text-slate-500"> · {e.stepLabel}</span>}
                  {' — '}{EVENT_LABELS[e.action] || e.action}{e.percent != null ? ` (${e.percent}%)` : ''}
                  {e.note && <span className="text-slate-500"> · {e.note}</span>}
                  <span className="text-slate-400"> · {e.actorName}</span>
                </span>
              </li>
            ))}
          </ul>
        </Block>
      )}
    </div>
  );
}

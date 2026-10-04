import { useState } from 'react';
import { CheckCircle2, ChevronDown, Circle, Clock3, MessageSquare, Plus, X } from 'lucide-react';
import { projectWorkApi } from '@/api/projectWorkApi';
import { toast } from '@/components/ui/toast';
import { InstallCategory, WorkBoard } from '@/types/projectWork';
import { Bar, CARD, GHOST, INPUT, errMsg, fmtWhen, pctTone } from './workUi';

/**
 * Installation: one checklist per category. A category is "ready" once its products are at site
 * (from Project Execution); the team ticks the steps and can push the bar with a quick %.
 */
export default function InstallationBoard({ board, onChange, editable, onChat }: {
  board: WorkBoard;
  onChange: (b: WorkBoard) => void;
  editable: boolean;
  onChat?: (cat: InstallCategory) => void;
}) {
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [newCat, setNewCat] = useState('');

  const run = async (fn: () => Promise<WorkBoard>) => {
    setBusy(true);
    try { onChange(await fn()); }
    catch (e) { toast.error(errMsg(e, 'Could not save')); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className={`${CARD} p-4`}>
        <div className="flex items-baseline justify-between">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-[#9B6B32]">Installation</p>
          <span className={`text-[20px] font-bold ${pctTone(board.installationPercent)}`}>{board.installationPercent}%</span>
        </div>
        <Bar value={board.installationPercent} className="mt-2 h-2.5" tone="gold" />
        <p className="mt-2 text-[12.5px] text-[#6B7169]">
          {board.install.filter((c) => c.percent >= 100).length} of {board.install.length} categories installed ·{' '}
          {board.install.filter((c) => c.ready).length} ready to install
        </p>
      </div>

      {board.install.map((c, i) => {
        const isOpen = open[c.id] ?? (i === 0 || (c.ready && c.percent < 100));
        const done = c.steps.filter((s) => s.done).length;
        return (
          <div key={c.id} className={CARD}>
            <button onClick={() => setOpen((o) => ({ ...o, [c.id]: !isOpen }))} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-[15px] font-semibold text-[#1A211E]">{c.category}</p>
                  {c.percent >= 100 ? (
                    <span className="shrink-0 rounded-full bg-[#E6F1EA] px-2 py-0.5 text-[11px] font-medium text-[#0A573B]">Installed</span>
                  ) : c.ready ? (
                    <span className="shrink-0 rounded-full bg-[#E6F1EA] px-2 py-0.5 text-[11px] font-medium text-[#0A573B]">Ready</span>
                  ) : (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#FBF1E1] px-2 py-0.5 text-[11px] font-medium text-[#9B6B32]">
                      <Clock3 className="h-3 w-3" /> {c.waitingCount} not at site
                    </span>
                  )}
                </div>
                <Bar value={c.percent} className="mt-2 h-1.5" tone="gold" />
              </div>
              <span className={`w-10 text-right text-[14px] font-bold ${pctTone(c.percent)}`}>{c.percent}%</span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-[#B4B0A4] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
              <div className="border-t border-[#F1ECE2] px-4 pb-4 pt-2">
                {!c.ready && c.percent < 100 && (
                  <p className="mb-2 rounded-lg bg-[#FBF6EC] p-2.5 text-[12px] text-[#8A6A2E]">
                    {c.waitingCount} product{c.waitingCount === 1 ? '' : 's'} not at site yet — you can still start if the work allows.
                  </p>
                )}
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#A6A99E]">Checklist · {done}/{c.steps.length}</p>
                <ul className="flex flex-col">
                  {c.steps.map((s) => (
                    <li key={s.id} className="flex items-center gap-2.5 py-2">
                      <button disabled={!editable || busy} onClick={() => run(() => projectWorkApi.toggleInstallStep(s.id))}
                        className="flex min-w-0 flex-1 items-center gap-2.5 text-left disabled:cursor-default">
                        {s.done
                          ? <CheckCircle2 className="h-5 w-5 shrink-0 text-[#0A573B]" />
                          : <Circle className="h-5 w-5 shrink-0 text-[#C9C2B1]" />}
                        <span className="min-w-0">
                          <span className={`block text-[13.5px] ${s.done ? 'text-[#8A8F86] line-through' : 'text-[#22271F]'}`}>{s.content}</span>
                          {s.done && s.doneByName && <span className="block text-[11px] text-[#9A9E96]">{s.doneByName} · {fmtWhen(s.doneAt)}</span>}
                        </span>
                      </button>
                      {editable && !s.done && (
                        <button disabled={busy} onClick={() => run(() => projectWorkApi.removeInstallStep(s.id))} aria-label="Remove step"
                          className="text-[#C9C2B1] hover:text-[#B94B45]"><X className="h-4 w-4" /></button>
                      )}
                    </li>
                  ))}
                </ul>
                {editable && <AddStep onAdd={(content) => run(() => projectWorkApi.addInstallStep(c.id, content))} disabled={busy} />}

                {editable && (
                  <div className="mt-3">
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#A6A99E]">Or set how far it is</p>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[0, 25, 50, 75, 100].map((p) => (
                        <button key={p} disabled={busy} onClick={() => run(() => projectWorkApi.setInstallPercent(c.id, p))}
                          className={`rounded-xl border py-2 text-[12.5px] font-semibold transition active:scale-95 ${
                            (c.manualPercent ?? -1) === p ? 'border-[#9B6B32] bg-[#9B6B32] text-white'
                              : c.percent >= p ? 'border-[#D9C29A] bg-[#FBF6EC] text-[#9B6B32]' : 'border-[#DDE2DE] bg-white text-[#9B6B32]'}`}>
                          {p}%
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {onChat && (
                  <button onClick={() => onChat(c)} className={`${GHOST} mt-3 w-full`}>
                    <MessageSquare className="h-4 w-4" /> Message the team about {c.category}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {editable && (
        <div className="flex gap-2">
          <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Add another installation category"
            className={`${INPUT} flex-1`} />
          <button disabled={busy || !newCat.trim()} className={GHOST}
            onClick={() => run(() => projectWorkApi.addInstallCategory(board.projectId, newCat.trim())).then(() => setNewCat(''))}>
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      )}
    </div>
  );
}

function AddStep({ onAdd, disabled }: { onAdd: (content: string) => Promise<void>; disabled?: boolean }) {
  const [text, setText] = useState('');
  return (
    <div className="mt-1 flex gap-2">
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a checklist step"
        onKeyDown={(e) => { if (e.key === 'Enter' && text.trim()) onAdd(text.trim()).then(() => setText('')); }}
        className={`${INPUT} flex-1`} />
      <button disabled={disabled || !text.trim()} onClick={() => onAdd(text.trim()).then(() => setText(''))} className={GHOST}>
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

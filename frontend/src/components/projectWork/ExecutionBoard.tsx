import { useState } from 'react';
import {
  ChevronDown, Package, Scissors, Hammer, Truck, CheckCircle2, MapPin, MessageSquare, Plus, Trash2, Receipt,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { projectWorkApi } from '@/api/projectWorkApi';
import { resolveFileUrl } from '@/lib/uploadFile';
import { toast } from '@/components/ui/toast';
import {
  DELIVERY_FLOW, DeliveryRoute, WorkBoard, WorkLine, WorkStep, WorkStepType,
} from '@/types/projectWork';
import { Bar, CARD, GHOST, INPUT, PRIMARY, PhotoPicker, Thumbs, errMsg, fmtWhen, pctTone } from './workUi';

export const STEP_ICON: Record<WorkStepType, typeof Package> = {
  MATERIAL: Package, MANUFACTURE: Hammer, STITCHING: Scissors, DELIVERY: Truck,
};

/** One-line state of a step, e.g. "PO-0042 · Partly received" or "Picked up · on the way". */
export function stepSummary(s: WorkStep): string {
  if (s.source === 'PO' && s.po) {
    const pos = s.po.orders.map((o) => o.poNumber).filter(Boolean).join(', ');
    return [pos, s.po.label, s.po.ordered ? `${s.po.received}/${s.po.ordered} received` : null].filter(Boolean).join(' · ');
  }
  if (s.stepType === 'DELIVERY') {
    const route = s.deliveryRoute === 'PICKUP' ? 'Pickup' : 'Direct';
    const flow = DELIVERY_FLOW[(s.deliveryRoute as DeliveryRoute) || 'DIRECT'];
    const stage = flow.find((f) => f.stage === s.deliveryStage)?.label;
    return [route, stage || 'Not started', s.pickupFrom && `from ${s.pickupFrom}`].filter(Boolean).join(' · ');
  }
  return s.percent >= 100 ? 'Done' : s.percent > 0 ? `${s.percent}% done` : 'Not started';
}

/**
 * Project Execution: Category → Product → steps (material, manufacture, stitching, delivery to site).
 * `editable` lets the team move steps; `canManage` also allows choosing steps and adding products.
 */
export default function ExecutionBoard({ board, onChange, editable, canManage, onChat }: {
  board: WorkBoard;
  onChange: (b: WorkBoard) => void;
  editable: boolean;
  canManage?: boolean;
  onChat?: (line: WorkLine) => void;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [lineId, setLineId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const line = board.categories.flatMap((c) => c.lines).find((l) => l.id === lineId) || null;

  return (
    <div className="flex flex-col gap-3">
      {/* Summary */}
      <div className={`${CARD} p-4`}>
        <div className="flex items-baseline justify-between">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-[#9B6B32]">Project execution</p>
          <span className={`text-[20px] font-bold ${pctTone(board.executionPercent)}`}>{board.executionPercent}%</span>
        </div>
        <Bar value={board.executionPercent} className="mt-2 h-2.5" />
        <p className="mt-2 text-[12.5px] text-[#6B7169]">
          <span className="font-semibold text-[#0A573B]">{board.atSiteCount}</span> of {board.productCount} products at site
        </p>
      </div>

      {board.categories.length === 0 && (
        <p className={`${CARD} p-4 text-[13px] text-[#8A8F86]`}>No products yet — they come from the approved quotation.</p>
      )}

      {board.categories.map((cat, ci) => {
        const isOpen = open[cat.category] ?? ci === 0;
        return (
          <div key={cat.category} className={CARD}>
            <button onClick={() => setOpen((o) => ({ ...o, [cat.category]: !isOpen }))}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-[15px] font-semibold text-[#1A211E]">{cat.category}</p>
                  <span className="shrink-0 rounded-full bg-[#F3EEE2] px-2 py-0.5 text-[11px] font-medium text-[#8A6A2E]">
                    {cat.atSiteCount}/{cat.productCount} at site
                  </span>
                </div>
                <Bar value={cat.percent} className="mt-2 h-1.5" />
              </div>
              <span className={`w-10 text-right text-[14px] font-bold ${pctTone(cat.percent)}`}>{cat.percent}%</span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-[#B4B0A4] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
              <ul className="divide-y divide-[#F1ECE2] border-t border-[#F1ECE2]">
                {cat.lines.map((l) => (
                  <li key={l.id}>
                    <button onClick={() => setLineId(l.id)} className="flex w-full items-start gap-3 px-4 py-3 text-left active:bg-[#FBFAF6]">
                      {l.imageUrl ? (
                        <img src={resolveFileUrl(l.imageUrl)} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-[#E4DECF]" />
                      ) : (
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#F6F4EC] text-[#B79A5C]"><Package className="h-5 w-5" /></span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-[14px] font-semibold text-[#22271F]">{l.itemName}</p>
                          {l.atSite && <CheckCircle2 className="h-4 w-4 shrink-0 text-[#0A573B]" />}
                        </div>
                        <p className="truncate text-[12px] text-[#8A8F86]">
                          {[l.color, l.quantity != null && `${Number(l.quantity)} ${l.unit || ''}`.trim(), l.location].filter(Boolean).join(' · ')}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {l.steps.map((s) => {
                            const Icon = STEP_ICON[s.stepType];
                            return (
                              <span key={s.id} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium ${
                                s.percent >= 100 ? 'bg-[#E6F1EA] text-[#0A573B]' : s.percent > 0 ? 'bg-[#FBF1E1] text-[#9B6B32]' : 'bg-[#F1ECE2] text-[#8A8F86]'}`}>
                                <Icon className="h-3 w-3" />{s.label.replace(' to site', '')} {s.percent}%
                                {s.source === 'PO' && <Receipt className="h-3 w-3" />}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <span className={`text-[13px] font-bold ${pctTone(l.percent)}`}>{l.percent}%</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}

      {(editable || canManage) && (
        <button onClick={() => setAdding(true)} className={`${GHOST} self-start`}>
          <Plus className="h-4 w-4" /> Add product
        </button>
      )}

      <ProductSheet line={line} board={board} onClose={() => setLineId(null)} onChange={onChange}
        editable={editable} canManage={!!canManage} onChat={onChat} />
      <AddProductDialog open={adding} onOpenChange={setAdding} board={board} onChange={onChange} />
    </div>
  );
}

/* ------------------------------------------------------------------ product sheet */

function ProductSheet({ line, board, onClose, onChange, editable, canManage, onChat }: {
  line: WorkLine | null; board: WorkBoard; onClose: () => void; onChange: (b: WorkBoard) => void;
  editable: boolean; canManage: boolean; onChat?: (line: WorkLine) => void;
}) {
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<WorkBoard>) => {
    setBusy(true);
    try { onChange(await fn()); }
    catch (e) { toast.error(errMsg(e, 'Could not save')); }
    finally { setBusy(false); }
  };

  const toggleStep = (type: WorkStepType) => {
    if (!line) return;
    const have = line.steps.map((s) => s.stepType);
    const next = have.includes(type) ? have.filter((t) => t !== type) : [...have, type];
    run(() => projectWorkApi.setLineSteps(line.id, next));
  };

  return (
    <Dialog open={!!line} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto bg-[#FAF8F3] p-0 sm:max-w-lg">
        {line && (
          <>
            <DialogHeader className="border-b border-[#EEE7DA] bg-white p-4 pr-11 text-left">
              <div className="flex items-start gap-3">
                {line.imageUrl && <img src={resolveFileUrl(line.imageUrl)} alt="" className="h-14 w-14 rounded-lg object-cover ring-1 ring-[#E4DECF]" />}
                <div className="min-w-0 flex-1">
                  <DialogTitle className="text-[16px] text-[#1A211E]">{line.itemName}</DialogTitle>
                  <p className="mt-0.5 text-[12.5px] text-[#8A8F86]">
                    {[line.category, line.color, line.quantity != null && `${Number(line.quantity)} ${line.unit || ''}`.trim()].filter(Boolean).join(' · ')}
                  </p>
                  {line.location && <p className="mt-0.5 flex items-center gap-1 text-[12px] text-[#8A8F86]"><MapPin className="h-3 w-3" />{line.location}</p>}
                </div>
                <span className={`text-[18px] font-bold ${pctTone(line.percent)}`}>{line.percent}%</span>
              </div>
              {onChat && (
                <button onClick={() => { onChat(line); onClose(); }} className={`${GHOST} mt-3 w-full`}>
                  <MessageSquare className="h-4 w-4" /> Message the team about this product
                </button>
              )}
            </DialogHeader>

            <div className="flex flex-col gap-3 p-4">
              {line.steps.length === 0 && <p className="text-[13px] text-[#8A8F86]">No steps chosen for this product.</p>}
              {line.steps.map((s) => (
                <StepCard key={s.id} step={s} editable={editable && !busy} run={run} />
              ))}

              {(canManage || editable) && (
                <div className="rounded-xl border border-dashed border-[#DCD3C0] p-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#9B6B32]">Steps this product needs</p>
                  <div className="flex flex-wrap gap-1.5">
                    {board.stepTypes.map((t) => {
                      const on = line.steps.some((s) => s.stepType === t.type);
                      const Icon = STEP_ICON[t.type];
                      return (
                        <button key={t.type} disabled={busy} onClick={() => toggleStep(t.type)}
                          className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-medium ring-1 transition ${
                            on ? 'bg-[#0A573B] text-white ring-[#0A573B]' : 'bg-white text-[#6B7169] ring-[#DDE2DE]'}`}>
                          <Icon className="h-3.5 w-3.5" /> {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {canManage && (
                <button disabled={busy} onClick={() => { if (confirm('Stop tracking this product?')) run(() => projectWorkApi.removeLine(line.id)).then(onClose); }}
                  className="inline-flex items-center gap-1.5 self-start text-[12px] font-medium text-[#B94B45]">
                  <Trash2 className="h-3.5 w-3.5" /> Remove from tracking
                </button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StepCard({ step, editable, run }: {
  step: WorkStep; editable: boolean; run: (fn: () => Promise<WorkBoard>) => Promise<void>;
}) {
  const Icon = STEP_ICON[step.stepType];
  const [note, setNote] = useState(step.note || '');
  const [pickupFrom, setPickupFrom] = useState(step.pickupFrom || '');
  const save = (body: Parameters<typeof projectWorkApi.updateStep>[1]) => run(() => projectWorkApi.updateStep(step.id, body));
  const route: DeliveryRoute = (step.deliveryRoute as DeliveryRoute) || 'DIRECT';

  return (
    <div className="rounded-2xl border border-[#EDE6D8] bg-white p-3.5">
      <div className="flex items-center gap-2.5">
        <span className={`flex h-9 w-9 items-center justify-center rounded-full ${step.percent >= 100 ? 'bg-[#E6F1EA] text-[#0A573B]' : 'bg-[#FBF6EC] text-[#9B6B32]'}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-[#1A211E]">{step.label}</p>
          <p className="truncate text-[12px] text-[#8A8F86]">{stepSummary(step)}</p>
        </div>
        <span className={`text-[15px] font-bold ${pctTone(step.percent)}`}>{step.percent}%</span>
      </div>
      <Bar value={step.percent} className="mt-2.5 h-1.5" />

      {/* Purchase-order linked material: read from the PO, moves when goods are received. */}
      {step.source === 'PO' && step.po && (
        <div className="mt-2.5 rounded-xl bg-[#F6F4EC] p-2.5 text-[12px] text-[#5E655D]">
          {step.po.orders.map((o) => (
            <p key={`${o.id}-${o.poNumber}`}>
              <span className="font-semibold text-[#33392F]">{o.poNumber}</span> · {o.supplierName || 'Supplier'} · {o.received}/{o.quantity} received · {o.status}
            </p>
          ))}
          {step.po.inTransit.length > 0 && <p className="mt-1 text-[#9B6B32]">In transit: {step.po.inTransit.join(', ')}</p>}
          <p className="mt-1 text-[11px] text-[#9A9E96]">Follows the purchase order — receive the goods against the PO to move it.</p>
        </div>
      )}

      {editable && step.source !== 'PO' && step.stepType === 'MATERIAL' && (
        <button onClick={() => save({ done: step.percent < 100 })}
          className={`${step.percent >= 100 ? GHOST : PRIMARY} mt-2.5 w-full`}>
          <CheckCircle2 className="h-4 w-4" /> {step.percent >= 100 ? 'Mark not ready' : 'Material ready'}
        </button>
      )}

      {editable && (step.stepType === 'MANUFACTURE' || step.stepType === 'STITCHING') && (
        <div className="mt-2.5 grid grid-cols-5 gap-1.5">
          {[0, 25, 50, 75, 100].map((p) => (
            <button key={p} onClick={() => save({ percent: p })}
              className={`rounded-xl border py-2 text-[12.5px] font-semibold transition active:scale-95 ${
                step.percent === p ? 'border-[#0A573B] bg-[#0A573B] text-white'
                  : step.percent > p ? 'border-[#0A573B] bg-[#EFF5F0] text-[#0A573B]' : 'border-[#DDE2DE] bg-white text-[#0A573B]'}`}>
              {p === 100 ? 'Done' : `${p}%`}
            </button>
          ))}
        </div>
      )}

      {step.stepType === 'DELIVERY' && editable && (
        <div className="mt-2.5 flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-[#F3F0E8] p-1">
            {(['DIRECT', 'PICKUP'] as DeliveryRoute[]).map((r) => (
              <button key={r} onClick={() => r !== route && save({ deliveryRoute: r, deliveryStage: null })}
                className={`rounded-lg py-1.5 text-[12px] font-semibold ${route === r ? 'bg-white text-[#0A573B] shadow-sm' : 'text-[#6B7169]'}`}>
                {r === 'DIRECT' ? 'Supplier → site' : 'We pick up'}
              </button>
            ))}
          </div>
          {route === 'PICKUP' && (
            <input value={pickupFrom} onChange={(e) => setPickupFrom(e.target.value)}
              onBlur={() => pickupFrom !== (step.pickupFrom || '') && save({ pickupFrom })}
              placeholder="Pick up from (supplier / godown / transport office)" className={INPUT} />
          )}
          <div className={`grid gap-1.5 ${DELIVERY_FLOW[route].length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {DELIVERY_FLOW[route].map((f, i) => {
              const idx = DELIVERY_FLOW[route].findIndex((x) => x.stage === step.deliveryStage);
              const reached = idx >= i;
              return (
                <button key={f.stage} onClick={() => save({ deliveryStage: f.stage, pickupFrom: route === 'PICKUP' ? pickupFrom : undefined })}
                  className={`rounded-xl border py-2 text-[12px] font-semibold transition active:scale-95 ${
                    reached ? 'border-[#0A573B] bg-[#0A573B] text-white' : 'border-[#DDE2DE] bg-white text-[#0A573B]'}`}>
                  {f.label}
                </button>
              );
            })}
          </div>
          {step.deliveryStage && (
            <button onClick={() => save({ deliveryStage: null })} className="self-start text-[11.5px] font-medium text-[#9A9E96]">Reset delivery</button>
          )}
        </div>
      )}

      {/* Photo + note for any step (proof of stitching, pickup, arrival…) */}
      {step.photoUrl && <div className="mt-2.5"><Thumbs urls={[step.photoUrl]} /></div>}
      {editable ? (
        <div className="mt-2.5 flex items-center gap-2">
          <input value={note} onChange={(e) => setNote(e.target.value)}
            onBlur={() => note !== (step.note || '') && save({ note })}
            placeholder="Add a note" className={`${INPUT} flex-1`} />
          <PhotoPicker compact onUploaded={(url) => save({ photoUrl: url })} />
        </div>
      ) : step.note ? (
        <p className="mt-2 text-[12.5px] text-[#5E655D]">{step.note}</p>
      ) : null}
      {step.updatedByName && (
        <p className="mt-2 text-[11px] text-[#9A9E96]">Last update by {step.updatedByName}{step.updatedAt ? ` · ${fmtWhen(step.updatedAt)}` : ''}</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ add product */

function AddProductDialog({ open, onOpenChange, board, onChange }: {
  open: boolean; onOpenChange: (o: boolean) => void; board: WorkBoard; onChange: (b: WorkBoard) => void;
}) {
  const [form, setForm] = useState({ category: '', itemName: '', color: '', quantity: '', unit: '', location: '' });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    if (!form.itemName.trim()) { toast.error('Enter the product name'); return; }
    setBusy(true);
    try {
      onChange(await projectWorkApi.addLine(board.projectId, {
        ...form, quantity: form.quantity || undefined, category: form.category || undefined,
      }));
      setForm({ category: '', itemName: '', color: '', quantity: '', unit: '', location: '' });
      onOpenChange(false);
    } catch (e) {
      toast.error(errMsg(e, 'Could not add the product'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Add a product to track</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-2.5">
          <input list="work-categories" value={form.category} onChange={set('category')} placeholder="Category (e.g. Curtains)" className={INPUT} />
          <datalist id="work-categories">{board.categories.map((c) => <option key={c.category} value={c.category} />)}</datalist>
          <input value={form.itemName} onChange={set('itemName')} placeholder="Product name" className={INPUT} />
          <div className="grid grid-cols-3 gap-2">
            <input value={form.color} onChange={set('color')} placeholder="Colour" className={INPUT} />
            <input value={form.quantity} onChange={set('quantity')} placeholder="Qty" inputMode="decimal" className={INPUT} />
            <input value={form.unit} onChange={set('unit')} placeholder="Unit" className={INPUT} />
          </div>
          <input value={form.location} onChange={set('location')} placeholder="Location / room" className={INPUT} />
          <p className="text-[11.5px] text-[#8A8F86]">Steps are picked from the category — change them on the product after adding.</p>
          <button onClick={save} disabled={busy} className={PRIMARY}>Add product</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  bundleApi, BUNDLE_FLOW, BUNDLE_STATUS_LABELS, BUNDLE_NEXT_ACTION, WORK_TYPES,
  type Bundle, type BundleItem,
} from "@/api/bundleApi";
import { useGoBack } from "@/hooks/useGoBack";
import { useAuth } from "@/hooks/useAuth";
import { apiError } from "@/lib/apiError";
import { resolveFileUrl } from "@/lib/uploadFile";
import { fetchCompanyProfile, type CompanyProfile } from "@/lib/companyProfile";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input, BaseInput } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import ImageCaptureField from "@/components/ImageCaptureField";
import ResourceSelect from "@/components/workforce/ResourceSelect";
import type { ResourceType } from "@/types/workforce";
import { WorkSpecFields, formatSpec, parseSpec, specToJson, type WorkSpec } from "@/components/bundles/workSpec";
import { printBundleStickers, printJobCard, getLabelSize, setLabelSize, LABEL_SIZES, type LabelSize } from "@/components/bundles/printStickers";
import HandoverDialog from "@/components/bundles/HandoverDialog";
import { StatusPill } from "./BundlesPage";
import {
  ArrowLeft, Phone, Printer, PauseCircle, PlayCircle, Check, Pencil, FileText, ChevronDown, Camera,
} from "lucide-react";

const fmtTime = (s?: string | null) =>
  s ? new Date(s).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

/** One bundle — what scanning its sticker opens. Route: /bundles/:id or /bundles/code/:code. */
export default function BundleDetailPage() {
  const { id, code } = useParams();
  const navigate = useNavigate();
  const goBack = useGoBack("/bundles");
  const { hasAuthority, roleNames } = useAuth();
  const canWrite = hasAuthority("BUNDLE_WRITE");
  const canMove = canWrite || hasAuthority("BUNDLE_MOVE");
  const canOverride = roleNames.includes("ROLE_ADMIN") || roleNames.includes("ROLE_MANAGER");

  const [b, setB] = useState<Bundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [company, setCompany] = useState<CompanyProfile | undefined>();
  const [size, setSize] = useState<LabelSize>(getLabelSize);

  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState("");
  const [showPhoto, setShowPhoto] = useState(false);
  /** Hand-over candidates (every bundle of the bill); non-null = dialog open. */
  const [handover, setHandover] = useState<Bundle[] | null>(null);
  const [holdOpen, setHoldOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [specEdit, setSpecEdit] = useState<BundleItem | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      if (code) {
        const found = await bundleApi.byCode(code);
        navigate(`/bundles/${found.id}`, { replace: true });
        return;
      }
      setB(await bundleApi.get(Number(id)));
    } catch (e) {
      setError(apiError(e, "Bundle not found."));
    }
  }, [id, code, navigate]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetchCompanyProfile().then(setCompany).catch(() => {}); }, []);

  const act = async (fn: () => Promise<Bundle>, msg?: string) => {
    setBusy(true);
    try {
      const updated = await fn();
      setB(updated);
      setNote(""); setPhoto(""); setShowPhoto(false);
      if (msg) toast.success(msg);
      return true;
    } catch (e) {
      toast.error(apiError(e, "Could not update the bundle."));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const openHandover = async () => {
    if (!b) return;
    let list: Bundle[] = [b];
    if (b.invoiceId) {
      try { list = await bundleApi.forInvoice(b.invoiceId); } catch { /* fall back to this bundle */ }
      if (!list.some((x) => x.id === b.id)) list = [b, ...list];
    }
    setHandover(list);
  };

  const moveTo = (status: string) => b && act(
    () => bundleApi.move(b.id, { status, note: note.trim() || undefined, photoUrl: photo || undefined }),
    `${b.code} → ${BUNDLE_STATUS_LABELS[status]}`,
  );

  if (error) {
    return (
      <div className="max-w-lg mx-auto text-center py-16 space-y-3">
        <p className="text-slate-700 font-medium">{error}</p>
        <Button variant="outline" onClick={() => navigate("/bundles")}>Back to Bundles</Button>
      </div>
    );
  }
  if (!b) return <p className="text-sm text-slate-500 p-6">Loading…</p>;

  const flowIdx = BUNDLE_FLOW.indexOf(b.status as (typeof BUNDLE_FLOW)[number]);
  const heldIdx = BUNDLE_FLOW.indexOf((b.heldFromStatus ?? "") as (typeof BUNDLE_FLOW)[number]);
  const stepIdx = flowIdx >= 0 ? flowIdx : heldIdx;
  const onHold = b.status === "ON_HOLD";
  const closed = b.status === "DELIVERED" || b.status === "CANCELLED";

  const print = (fn: () => boolean) => { if (!fn()) toast.error("Allow pop-ups for this site to print."); };

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-24 md:pb-6">
      {/* header */}
      <div className="flex flex-wrap items-start gap-3">
        <button onClick={goBack} className="mt-1 p-1.5 rounded-md hover:bg-slate-100 text-slate-600"><ArrowLeft className="w-5 h-5" /></button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-2xl md:text-3xl font-black text-slate-900">{b.code}</h1>
            <StatusPill status={b.status} />
            {b.overdue && <span className="rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[11px] font-medium text-red-700">Overdue</span>}
          </div>
          <div className="text-sm text-slate-600 mt-0.5">
            {WORK_TYPES.find((w) => w.v === b.workType)?.label ?? b.workType}
            {b.bundleTotal > 1 && ` · bundle ${b.bundleNo} of ${b.bundleTotal}`}
            {b.invoiceId && <> · Bill <Link className="hover:underline" to={`/billing/invoices/${b.invoiceId}`}>{b.invoiceNumber}</Link></>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={size} onChange={(e) => { const v = e.target.value as LabelSize; setSize(v); setLabelSize(v); }}
            className="h-9 rounded-md border bg-white px-2 text-xs" title="Sticker size">
            {LABEL_SIZES.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
          </select>
          <Button size="sm" variant="outline" onClick={() => print(() => printBundleStickers([b], size, company))}><Printer className="w-4 h-4 mr-1" /> Sticker</Button>
          <Button size="sm" variant="outline" onClick={() => print(() => printJobCard(b, company))}><FileText className="w-4 h-4 mr-1" /> Job card</Button>
        </div>
      </div>

      {/* sibling bundles of the same order */}
      {b.siblings && b.siblings.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {b.siblings.map((s) => (
            <Link key={s.id} to={`/bundles/${s.id}`}
              className={`rounded-lg border px-2.5 py-1 text-xs font-mono ${s.id === b.id ? "bg-slate-800 text-white border-slate-800" : "bg-white hover:bg-slate-50"}`}>
              {s.code} <span className="font-sans opacity-70">· {BUNDLE_STATUS_LABELS[s.status]}</span>
            </Link>
          ))}
        </div>
      )}

      {/* stepper */}
      <div className="bg-white border rounded-2xl p-4">
        <ol className="flex items-center gap-1 overflow-x-auto">
          {BUNDLE_FLOW.map((s, i) => {
            const done = stepIdx >= 0 && i < stepIdx || b.status === "DELIVERED";
            const current = i === stepIdx && b.status !== "DELIVERED";
            return (
              <li key={s} className="flex items-center gap-1 shrink-0">
                <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                  done ? "bg-emerald-50 text-emerald-700" : current ? (onHold ? "bg-orange-100 text-orange-800" : "bg-slate-800 text-white") : "text-slate-400"}`}>
                  {done && <Check className="w-3.5 h-3.5" />}{BUNDLE_STATUS_LABELS[s]}
                </span>
                {i < BUNDLE_FLOW.length - 1 && <span className="w-4 h-px bg-slate-200" />}
              </li>
            );
          })}
        </ol>

        {onHold && (
          <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800">
            <b>On hold:</b> {b.holdReason}
          </div>
        )}
        {b.status === "CANCELLED" && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">This bundle was cancelled with its bill.</div>
        )}
        {b.status === "DELIVERED" && (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Handed over {fmtTime(b.deliveredAt)}{b.deliveredTo ? ` to ${b.deliveredTo}` : ""}.
          </div>
        )}

        {/* actions */}
        {canMove && !closed && (
          <div className="mt-4 space-y-2">
            {!onHold && (
              <div className="flex flex-col sm:flex-row gap-2">
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="h-11 sm:flex-1" />
                <Button variant="outline" className="h-11" onClick={() => setShowPhoto((v) => !v)}><Camera className="w-4 h-4 mr-1" /> {photo ? "Photo added" : "Photo"}</Button>
              </div>
            )}
            {showPhoto && !onHold && (
              <div className="max-w-xs"><ImageCaptureField module="BUNDLE" value={photo} onChange={(r) => setPhoto(r.url)} label="Work photo" allowEdit /></div>
            )}
            <div className="flex flex-wrap gap-2">
              {onHold ? (
                <Button className="h-12 flex-1 sm:flex-none text-base" disabled={busy} onClick={() => act(() => bundleApi.release(b.id), "Hold released")}>
                  <PlayCircle className="w-5 h-5 mr-1.5" /> Release hold
                </Button>
              ) : b.nextStatus && (
                <Button className="h-12 flex-1 sm:flex-none sm:min-w-[220px] text-base" disabled={busy}
                  onClick={() => (b.nextStatus === "DELIVERED" ? openHandover() : moveTo(b.nextStatus!))}>
                  {BUNDLE_NEXT_ACTION[b.nextStatus] ?? BUNDLE_STATUS_LABELS[b.nextStatus]} →
                </Button>
              )}
              {!onHold && (
                <Button variant="outline" className="h-12" disabled={busy} onClick={() => setHoldOpen(true)}>
                  <PauseCircle className="w-4 h-4 mr-1.5" /> Hold
                </Button>
              )}
              {canOverride && !onHold && (
                <div className="relative">
                  <select value="" disabled={busy}
                    onChange={(e) => { const v = e.target.value; if (!v) return; if (v === "DELIVERED") openHandover(); else moveTo(v); }}
                    className="h-12 appearance-none rounded-md border bg-white pl-3 pr-8 text-sm text-slate-700">
                    <option value="">Move to…</option>
                    {BUNDLE_FLOW.filter((s) => s !== b.status).map((s) => <option key={s} value={s}>{BUNDLE_STATUS_LABELS[s]}</option>)}
                  </select>
                  <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* items */}
        <div className="lg:col-span-2 bg-white border rounded-2xl">
          <div className="px-4 py-3 border-b font-semibold text-slate-800">Items &amp; work ({b.items?.length ?? 0})</div>
          <ul className="divide-y">
            {(b.items ?? []).map((it) => {
              const spec = parseSpec(it.workSpec);
              const summary = formatSpec(spec);
              const photos = parsePhotos(it.photoUrls);
              return (
                <li key={it.id} className="px-4 py-3 flex gap-3">
                  {canMove && !closed && (
                    <BaseInput type="checkbox" checked={it.done} className="w-5 h-5 mt-0.5 shrink-0" title="Done"
                      onChange={(e) => act(() => bundleApi.update(b.id, { items: [{ id: it.id, done: e.target.checked }] }))} />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className={`font-medium ${it.done ? "text-slate-400 line-through" : "text-slate-800"}`}>
                      {it.description} <span className="font-normal text-slate-500">× {Number(it.quantity)} {it.unit ?? ""}</span>
                    </div>
                    {summary && <div className="text-sm text-slate-700 mt-0.5">{summary}</div>}
                    {spec.notes && <div className="text-sm text-slate-500 italic mt-0.5">{spec.notes}</div>}
                    {it.notes && <div className="text-sm text-slate-500 italic mt-0.5">{it.notes}</div>}
                    {!summary && !spec.notes && !it.notes && <div className="text-xs text-slate-400 mt-0.5">No work details yet</div>}
                    {photos.length > 0 && (
                      <div className="flex gap-2 mt-2">
                        {photos.map((p) => <a key={p} href={resolveFileUrl(p)} target="_blank" rel="noreferrer"><img src={resolveFileUrl(p)} className="w-14 h-14 rounded object-cover border" /></a>)}
                      </div>
                    )}
                  </div>
                  {canWrite && !closed && (
                    <button className="text-slate-400 hover:text-slate-700 self-start" title="Edit work details" onClick={() => setSpecEdit(it)}><Pencil className="w-4 h-4" /></button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* details */}
        <div className="bg-white border rounded-2xl">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <span className="font-semibold text-slate-800">Details</span>
            {canWrite && !closed && <button className="text-xs text-slate-500 hover:text-slate-800 hover:underline" onClick={() => setEditOpen(true)}>Edit</button>}
          </div>
          <dl className="p-4 space-y-2.5 text-sm">
            <Detail label="Customer">
              {b.customerName || "Walk-in"}
              {b.customerPhone && <a href={`tel:${b.customerPhone}`} className="flex items-center gap-1 text-slate-500 hover:underline"><Phone className="w-3.5 h-3.5" />{b.customerPhone}</a>}
            </Detail>
            {b.invoiceId && b.status !== "CANCELLED" && (
              <Detail label="Bill payment">
                {Number(b.balanceDue ?? 0) > 0
                  ? <span className="font-semibold text-amber-700">₹{Number(b.balanceDue).toLocaleString("en-IN")} due</span>
                  : <span className="font-medium text-emerald-700">Paid</span>}
              </Detail>
            )}
            <Detail label="Tailor / worker">
              {canWrite && !closed ? (
                <ResourceSelect
                  value={b.resourceType && b.resourceId ? { resourceType: b.resourceType as ResourceType, resourceId: b.resourceId, name: b.assigneeName ?? undefined } : null}
                  onChange={(r) => act(() => bundleApi.assign(b.id, r?.resourceType ?? null, r?.resourceId ?? null), r ? `Assigned to ${r.name ?? "worker"}` : "Unassigned")}
                  placeholder="Assign tailor" />
              ) : (b.assigneeName || "—")}
            </Detail>
            <Detail label="Ready by"><span className={b.overdue ? "text-red-600 font-medium" : ""}>{b.dueDate || "—"}</span></Detail>
            <Detail label="Priority">{b.priority}</Detail>
            <Detail label="Handover">{b.handoverMode === "DELIVERY" ? "Delivery" : "Customer pickup"}</Detail>
            <Detail label="Kept at">{b.rackLocation || "—"}</Detail>
            {b.notes && <Detail label="Notes"><span className="whitespace-pre-wrap">{b.notes}</span></Detail>}
            {b.packedAt && <Detail label="Packed">{fmtTime(b.packedAt)}</Detail>}
          </dl>
        </div>
      </div>

      {/* history */}
      <div className="bg-white border rounded-2xl">
        <div className="px-4 py-3 border-b font-semibold text-slate-800">History</div>
        <ol className="p-4 space-y-3">
          {[...(b.events ?? [])].reverse().map((e) => (
            <li key={e.id} className="flex gap-3 text-sm">
              <span className="mt-1.5 w-2 h-2 rounded-full bg-slate-300 shrink-0" />
              <div className="min-w-0">
                <div className="text-slate-800">
                  {e.fromStatus && e.fromStatus !== e.toStatus
                    ? <>{BUNDLE_STATUS_LABELS[e.fromStatus] ?? e.fromStatus} → <b>{BUNDLE_STATUS_LABELS[e.toStatus] ?? e.toStatus}</b></>
                    : e.fromStatus ? null : <b>{BUNDLE_STATUS_LABELS[e.toStatus] ?? e.toStatus}</b>}
                  {e.note && <span className="text-slate-600">{e.fromStatus && e.fromStatus !== e.toStatus ? " · " : (e.fromStatus ? "" : " · ")}{e.note}</span>}
                </div>
                <div className="text-xs text-slate-400">{fmtTime(e.at)}{e.userName ? ` · ${e.userName}` : ""}</div>
                {e.photoUrl && <a href={resolveFileUrl(e.photoUrl)} target="_blank" rel="noreferrer"><img src={resolveFileUrl(e.photoUrl)} className="mt-1.5 w-20 h-20 rounded object-cover border" /></a>}
              </div>
            </li>
          ))}
        </ol>
      </div>

      {handover && (
        <HandoverDialog bundles={handover} focusId={b.id} onClose={() => setHandover(null)}
          onDone={(updated) => { setHandover(null); setB(updated.find((x) => x.id === b.id) ?? b); load(); }} />
      )}
      {holdOpen && (
        <HoldDialog busy={busy} onClose={() => setHoldOpen(false)}
          onConfirm={async (reason) => { if (await act(() => bundleApi.hold(b.id, reason), "Put on hold")) setHoldOpen(false); }} />
      )}
      {editOpen && (
        <EditDialog bundle={b} busy={busy} onClose={() => setEditOpen(false)}
          onSave={async (body) => { if (await act(() => bundleApi.update(b.id, body), "Saved")) setEditOpen(false); }} />
      )}
      {specEdit && (
        <SpecDialog item={specEdit} busy={busy} onClose={() => setSpecEdit(null)}
          onSave={async (spec, notes) => {
            if (await act(() => bundleApi.update(b.id, { items: [{ id: specEdit.id, workSpec: specToJson(spec) ?? "", notes }] }), "Work details saved")) setSpecEdit(null);
          }} />
      )}
    </div>
  );
}

function parsePhotos(json?: string | null): string[] {
  if (!json) return [];
  try { const v = JSON.parse(json); return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []; } catch { return []; }
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-slate-800 mt-0.5">{children}</dd>
    </div>
  );
}

function HoldDialog({ busy, onClose, onConfirm }: { busy: boolean; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  const quick = ["Fabric short", "Waiting for customer confirmation", "Accessories pending", "Re-measure needed"];
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Put on hold</DialogTitle></DialogHeader>
        <div className="flex flex-wrap gap-1.5">
          {quick.map((q) => <button key={q} onClick={() => setReason(q)} className="rounded-full border px-2.5 py-1 text-xs hover:bg-slate-50">{q}</button>)}
        </div>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" autoFocus />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={busy || !reason.trim()} onClick={() => onConfirm(reason.trim())}>Hold</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({ bundle, busy, onClose, onSave }: { bundle: Bundle; busy: boolean; onClose: () => void; onSave: (body: Record<string, unknown>) => void }) {
  const [f, setF] = useState({
    workType: bundle.workType, dueDate: bundle.dueDate ?? "", priority: bundle.priority,
    handoverMode: bundle.handoverMode, rackLocation: bundle.rackLocation ?? "", notes: bundle.notes ?? "",
  });
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const sel = "h-9 w-full rounded-md border bg-white px-2 text-sm mt-1";
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Edit {bundle.code}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <label><span className="text-slate-500 text-xs">Work</span>
            <select value={f.workType} onChange={(e) => set({ workType: e.target.value })} className={sel}>
              {WORK_TYPES.map((w) => <option key={w.v} value={w.v}>{w.label}</option>)}
            </select></label>
          <label><span className="text-slate-500 text-xs">Ready by</span>
            <Input type="date" value={f.dueDate} onChange={(e) => set({ dueDate: e.target.value })} className="h-9 mt-1" /></label>
          <label><span className="text-slate-500 text-xs">Priority</span>
            <select value={f.priority} onChange={(e) => set({ priority: e.target.value })} className={sel}>
              <option value="LOW">Low</option><option value="MEDIUM">Normal</option><option value="HIGH">High</option><option value="URGENT">Urgent</option>
            </select></label>
          <label><span className="text-slate-500 text-xs">Handover</span>
            <select value={f.handoverMode} onChange={(e) => set({ handoverMode: e.target.value as Bundle["handoverMode"] })} className={sel}>
              <option value="PICKUP">Customer pickup</option><option value="DELIVERY">Delivery</option>
            </select></label>
          <label className="col-span-2"><span className="text-slate-500 text-xs">Kept at (rack / shelf)</span>
            <Input value={f.rackLocation} onChange={(e) => set({ rackLocation: e.target.value })} className="h-9 mt-1" placeholder="e.g. Shelf B2" /></label>
          <label className="col-span-2"><span className="text-slate-500 text-xs">Notes</span>
            <textarea value={f.notes} onChange={(e) => set({ notes: e.target.value })} rows={3} className="w-full rounded-md border px-2 py-1.5 mt-1" /></label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={busy} onClick={() => onSave(f)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SpecDialog({ item, busy, onClose, onSave }: { item: BundleItem; busy: boolean; onClose: () => void; onSave: (spec: WorkSpec, notes: string) => void }) {
  const [spec, setSpec] = useState<WorkSpec>(parseSpec(item.workSpec));
  const [notes, setNotes] = useState(item.notes ?? "");
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{item.description}</DialogTitle></DialogHeader>
        <WorkSpecFields value={spec} onChange={setSpec} />
        <label className="text-xs block"><span className="text-slate-500">Item notes</span>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="h-9 mt-1" /></label>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={busy} onClick={() => onSave(spec, notes)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

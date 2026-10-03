import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, X, AlertTriangle } from "lucide-react";
import api from "@/lib/api";
import ImageCaptureField from "@/components/ImageCaptureField";
import { resolveFileUrl } from "@/lib/uploadFile";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { apiError } from "@/lib/apiError";

/**
 * "Mark Completed" → a small handover sheet: handover photos on top, then the two confirmations
 * (client approved, every product delivered) and optional notes. Submitting completes the project
 * and stamps the handover date; the photos land in the project's Documents.
 */
export default function CompleteProjectDialog({ projectId, open, onClose, onCompleted }: {
  projectId: number;
  open: boolean;
  onClose: () => void;
  onCompleted: () => void | Promise<void>;
}) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [clientApproved, setClientApproved] = useState(false);
  const [productsDelivered, setProductsDelivered] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  // Set when the readiness checklist blocks completion — lets the user override it explicitly.
  const [blocked, setBlocked] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setPhotos([]); setClientApproved(false); setProductsDelivered(false); setNotes(""); setBlocked(null); }
  }, [open]);

  const submit = async (force = false) => {
    if (!clientApproved || !productsDelivered) { toast.error("Tick both confirmations to complete the project."); return; }
    setSaving(true);
    try {
      await api.post(`/projects/${projectId}/complete-handover`, { clientApproved, productsDelivered, notes: notes || undefined, photoUrls: photos, force });
      toast.success("Project completed and handed over.");
      onClose();
      await onCompleted();
    } catch (e) {
      const msg = apiError(e, "Could not complete the project.");
      if (/ready to complete/i.test(msg)) setBlocked(msg);
      else toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const ready = clientApproved && productsDelivered;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" /> Complete &amp; hand over</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs font-semibold text-slate-600">Handover photos</Label>
            {photos.length > 0 && <div className="mt-1.5 flex flex-wrap gap-2 items-start">
              {photos.map((p) => (
                <div key={p} className="relative">
                  <img src={resolveFileUrl(p)} alt="Handover" className="h-20 w-20 rounded-xl object-cover border border-slate-100" />
                  <button type="button" className="absolute -top-1.5 -right-1.5 rounded-full bg-white shadow p-0.5 text-slate-500 hover:text-rose-600"
                    onClick={() => setPhotos((ps) => ps.filter((x) => x !== p))}><X className="h-3 w-3" /></button>
                </div>
              ))}
            </div>}
            <div className="mt-1.5">
              <ImageCaptureField key={photos.length} module="HANDOVER" label={photos.length ? "Add another photo" : "Add photo"}
                onChange={({ url }) => url && setPhotos((ps) => [...ps, url])} />
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Finished work, installed products, the client at handover — saved to the project's Documents.</p>
          </div>

          <div className="space-y-2">
            <label className={`flex items-start gap-2.5 rounded-xl border p-3 cursor-pointer transition ${clientApproved ? "border-emerald-200 bg-emerald-50/50" : "border-slate-100"}`}>
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-emerald-600" checked={clientApproved} onChange={(e) => setClientApproved(e.target.checked)} />
              <span>
                <span className="block text-sm font-semibold text-slate-800">Client approved</span>
                <span className="block text-xs text-slate-500">The client has checked and accepted the finished work.</span>
              </span>
            </label>
            <label className={`flex items-start gap-2.5 rounded-xl border p-3 cursor-pointer transition ${productsDelivered ? "border-emerald-200 bg-emerald-50/50" : "border-slate-100"}`}>
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-emerald-600" checked={productsDelivered} onChange={(e) => setProductsDelivered(e.target.checked)} />
              <span>
                <span className="block text-sm font-semibold text-slate-800">All products delivered</span>
                <span className="block text-xs text-slate-500">Every product on the order has been supplied and installed.</span>
              </span>
            </label>
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-600">Notes</Label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={400}
              placeholder="Optional — anything to remember about the handover"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none" />
          </div>

          {blocked && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 space-y-2">
              <p className="flex items-start gap-1.5"><AlertTriangle className="h-4 w-4 shrink-0" /><span>{blocked}</span></p>
              <Button size="sm" variant="outline" disabled={saving} onClick={() => submit(true)}>Complete anyway</Button>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button variant="outline" disabled={saving} onClick={onClose}>Cancel</Button>
            <Button disabled={!ready || saving} onClick={() => submit(false)}>
              {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
              Mark Completed
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { apiError } from "@/lib/apiError";

/** One remark box, required, then delete. The remark is saved on the record as the reason it was deleted. */
export default function DeleteWithRemarkDialog({ open, title, subject, onClose, onConfirm, onDone, action = "Delete", success, hint, children }: {
  open: boolean;
  action?: string;
  success?: string;
  hint?: string;
  children?: React.ReactNode;
  title: string;
  subject: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<unknown>;
  onDone: () => void | Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setReason(""); }, [open]);

  const submit = async () => {
    setSaving(true);
    try {
      await onConfirm(reason.trim());
      toast.success(success ?? `${subject} deleted.`);
      onClose();
      await onDone();
    } catch (e) {
      toast.error(apiError(e, `Could not ${action.toLowerCase()} ${subject.toLowerCase()}.`));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Trash2 className="h-5 w-5 text-rose-600" /> {title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {children}
          <div>
            <label className="text-xs font-semibold text-slate-600">Remarks <span className="text-rose-500">*</span></label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} autoFocus
              placeholder={`Why: ${action.toLowerCase()}?`}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-rose-400 focus:outline-none" />
            <p className="mt-1 text-[11px] text-slate-500">{hint ?? "This remark is saved and the record is marked as deleted."}</p>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button variant="outline" disabled={saving} onClick={onClose}>Keep</Button>
            <Button disabled={saving || !reason.trim()} onClick={submit} className="bg-rose-600 hover:bg-rose-700 text-white">
              {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1.5" />} {action}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

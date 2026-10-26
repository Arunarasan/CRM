import { useEffect, useState } from "react";
import { HandCoins, Loader2, AlertTriangle } from "lucide-react";
import api from "@/lib/api";
import { getAuthorities } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { apiError } from "@/lib/apiError";

/** Who may record a price reduction — mirrors the backend's @PreAuthorize on /projects/{id}/settle. */
export const canSettleProjects = () => {
  const a = getAuthorities();
  return ["ROLE_ADMIN"].some((r) => a.includes(r));
};

interface Preview {
  projectName: string;
  status: string;
  contractValue: number;
  agreedReduction: number;
  paid: number;
  pending: number;
  adjustments: { id: number; amount: number; reasonCode: string; reason?: string; at?: string }[];
}

const REASONS: [string, string][] = [
  ["BARGAINING", "Customer bargaining"],
  ["COMPENSATION", "Compensation"],
  ["ROUND_OFF", "Round-off"],
  ["OTHER", "Other"],
];

const inr = (n: number) => "₹" + Math.round(n || 0).toLocaleString("en-IN");

/**
 * "Settle & complete": record an agreed price reduction (e.g. the customer bargained at the end) so the
 * balance we'll never collect stops showing as pending, and optionally mark the project completed.
 */
export default function SettleProjectDialog({ projectId, open, onClose, onDone }: {
  projectId: number | null;
  open: boolean;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const [data, setData] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState<number | "">("");
  const [reasonCode, setReasonCode] = useState("BARGAINING");
  const [reason, setReason] = useState("");
  const [complete, setComplete] = useState(true);
  const [saving, setSaving] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !projectId) return;
    setData(null); setAmount(""); setReasonCode("BARGAINING"); setReason(""); setBlocked(null);
    setLoading(true);
    api.get(`/projects/${projectId}/settlement`)
      .then((res) => {
        setData(res.data);
        setComplete(!["COMPLETED", "CLOSED"].includes(String(res.data.status).toUpperCase()));
      })
      .catch((e) => { toast.error(apiError(e, "Could not load the project's payment position.")); onClose(); })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId]);

  const alreadyDone = data ? ["COMPLETED", "CLOSED"].includes(String(data.status).toUpperCase()) : false;
  const cut = Number(amount) || 0;
  const newPending = data ? Math.max(0, data.pending - cut) : 0;
  const tooMuch = !!data && cut > data.pending;

  const submit = async (force = false) => {
    if (!data || !projectId) return;
    if (cut <= 0 && !(complete && !alreadyDone)) { toast.error("Enter the amount to reduce."); return; }
    if (tooMuch) { toast.error("The reduction is more than the pending amount."); return; }
    setSaving(true);
    try {
      await api.post(`/projects/${projectId}/settle`, {
        amount: cut, reasonCode, reason: reason.trim() || undefined, markCompleted: complete && !alreadyDone, force,
      });
      toast.success(cut > 0 ? `Reduced ${inr(cut)}${complete && !alreadyDone ? " and completed the project" : ""}.` : "Project completed.");
      onClose();
      await onDone();
    } catch (e) {
      const msg = apiError(e, "Could not save the settlement.");
      if (/ready to complete/i.test(msg)) setBlocked(msg);
      else toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><HandCoins className="h-5 w-5 text-emerald-600" /> Settle &amp; complete</DialogTitle>
          <DialogDescription>{data?.projectName || "Reduce the amount the customer owes, with a reason, and close the project."}</DialogDescription>
        </DialogHeader>

        {loading || !data ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-slate-50 px-2 py-2"><p className="text-[11px] text-slate-500">Project value</p><p className="text-sm font-bold tabular-nums">{inr(data.contractValue)}</p></div>
              <div className="rounded-lg bg-slate-50 px-2 py-2"><p className="text-[11px] text-slate-500">Paid</p><p className="text-sm font-bold tabular-nums text-emerald-700">{inr(data.paid)}</p></div>
              <div className="rounded-lg bg-amber-50 px-2 py-2"><p className="text-[11px] text-amber-700">Pending</p><p className="text-sm font-bold tabular-nums text-amber-700">{inr(data.pending)}</p></div>
            </div>
            {data.agreedReduction > 0 && (
              <p className="text-xs text-slate-500">Already reduced earlier: <strong>{inr(data.agreedReduction)}</strong></p>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-600">Reduce by</Label>
                <button type="button" className="text-xs font-medium text-emerald-600 hover:underline disabled:opacity-40"
                  disabled={data.pending <= 0} onClick={() => setAmount(Math.round(data.pending * 100) / 100)}>
                  Waive all pending
                </button>
              </div>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                <Input type="number" min={0} max={data.pending} value={amount} placeholder="0" autoFocus
                  onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
                  className="pl-7 text-lg font-semibold" />
              </div>
              <div className="flex gap-1.5">
                {[5, 10, 25].map((pct) => (
                  <button key={pct} type="button" disabled={data.pending <= 0}
                    onClick={() => setAmount(Math.round(data.pending * pct) / 100)}
                    className="rounded-full border border-slate-200 px-2.5 py-0.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                    {pct}% of pending
                  </button>
                ))}
              </div>
              {tooMuch && <p className="text-xs text-destructive">More than the pending amount ({inr(data.pending)}).</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600">Reason</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {REASONS.map(([code, label]) => (
                  <button key={code} type="button" onClick={() => setReasonCode(code)}
                    className={`rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors ${
                      reasonCode === code ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                    {label}
                  </button>
                ))}
              </div>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder={reasonCode === "OTHER" ? "Explain the reduction (required)" : "Optional note — e.g. agreed with owner on site"} />
            </div>

            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2.5 text-sm">
              <span className="text-slate-500">Pending after reduction</span>
              <strong className={newPending === 0 ? "text-emerald-700" : "text-amber-700"}>{inr(newPending)}</strong>
            </div>

            {!alreadyDone && (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={complete} onChange={(e) => setComplete(e.target.checked)} className="h-4 w-4 accent-emerald-600" />
                Also mark the project completed
              </label>
            )}

            {blocked && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                <p className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {blocked}</p>
                <Button size="sm" variant="outline" className="mt-2" disabled={saving} onClick={() => submit(true)}>Override &amp; complete anyway</Button>
              </div>
            )}

            {data.adjustments.length > 0 && (
              <div className="border-t border-slate-100 pt-2">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Earlier reductions</p>
                {data.adjustments.map((a) => (
                  <p key={a.id} className="flex justify-between text-xs text-slate-600">
                    <span className="truncate">{(REASONS.find((r) => r[0] === a.reasonCode)?.[1]) || a.reasonCode}{a.reason ? ` — ${a.reason}` : ""}</span>
                    <span className="ml-3 shrink-0 tabular-nums">−{inr(a.amount)}</span>
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={() => submit(false)} disabled={saving || loading || !data}>
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            {complete && !alreadyDone ? "Settle & complete" : "Save reduction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

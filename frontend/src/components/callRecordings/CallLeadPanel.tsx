import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Phone, MessageCircle, UserPlus, Link2, Ban, CheckCircle2, AlertTriangle, Clock, CalendarClock, Loader2,
} from "lucide-react";
import AudioPlayer from "@/components/AudioPlayer";
import QuickLeadSheet from "@/components/leads/QuickLeadSheet";
import { resolveFileUrl } from "@/lib/uploadFile";
import { toast } from "@/components/ui/toast";
import { callRecordingApi, errMsg, fmtCallTime, fmtDuration, type CallRecording } from "@/api/callRecordingApi";

const NOT_A_LEAD_REASONS = ["Wrong number", "Not interested", "Spam / sales call", "Existing customer query", "Job enquiry"];

/** Local 10-digit form for Indian numbers (how leads are usually keyed), else the number as stored. */
export function displayPhone(phone?: string | null) {
  if (!phone) return "";
  const d = phone.replace(/\D/g, "");
  return d.length === 12 && d.startsWith("91") ? d.slice(2) : phone;
}

/**
 * Everything needed to finish a call: listen, call back / WhatsApp, then close it with an outcome —
 * create the lead (the mobile Add Lead form, pre-filled, recording attached automatically), add the
 * call to the existing lead on that number, or mark it not a lead. Used on the call follow-up task
 * (employee + admin) and on the Call Recordings tab.
 */
export default function CallLeadPanel({
  call, onChanged, canOpenLead = false, showPlayer = true,
}: {
  call: CallRecording;
  onChanged: (c: CallRecording) => void;
  canOpenLead?: boolean;
  showPlayer?: boolean;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<"attach" | "reject" | null>(null);

  const phone = displayPhone(call.phoneNumber);
  const waDigits = (call.phoneNumber || "").replace(/\D/g, "");

  const createLead = async (body: any) => {
    const updated = await callRecordingApi.createLead(call.id, body);
    setSheetOpen(false);
    toast.success(`Lead ${updated.lead?.leadNumber || ""} created`.trim());
    onChanged(updated);
  };

  const attach = async () => {
    if (!call.matchedLead) return;
    setBusy("attach");
    try {
      const updated = await callRecordingApi.attachToLead(call.id, call.matchedLead.id, call.note || undefined);
      toast.success(`Call added to ${updated.lead?.leadNumber || "the lead"}`);
      onChanged(updated);
    } catch (e) {
      toast.error(errMsg(e, "Could not add the call to the lead."));
    } finally {
      setBusy(null);
    }
  };

  const reject = async () => {
    if (!reason.trim()) { toast.error("Pick or type a reason."); return; }
    setBusy("reject");
    try {
      const updated = await callRecordingApi.notALead(call.id, reason.trim());
      toast.success("Call closed as not a lead");
      setReasonOpen(false);
      onChanged(updated);
    } catch (e) {
      toast.error(errMsg(e, "Could not close the call."));
    } finally {
      setBusy(null);
    }
  };

  const leadLabel = (l?: { leadNumber: string; name: string } | null) => (l ? `${l.leadNumber} · ${l.name}` : "");
  const LeadLink = ({ l }: { l: { id: number; leadNumber: string; name: string } }) =>
    canOpenLead
      ? <Link to={`/leads/${l.id}`} className="font-semibold underline underline-offset-2">{leadLabel(l)}</Link>
      : <span className="font-semibold">{leadLabel(l)}</span>;

  return (
    <div className="space-y-3">
      {showPlayer && (
        <div className="rounded-xl border bg-card p-3">
          <AudioPlayer src={resolveFileUrl(call.fileUrl)} fileName={call.fileName} />
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {call.calledAt && <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />{fmtCallTime(call.calledAt)}</span>}
            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{fmtDuration(call.durationSec)}</span>
            {call.direction && <span>{call.direction === "IN" ? "Incoming" : "Outgoing"}</span>}
          </div>
          {call.phoneNumber && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <a href={`tel:${call.phoneNumber}`} className="flex items-center justify-center gap-1.5 rounded-lg border bg-background py-2 text-sm font-medium active:scale-[0.98]">
                <Phone className="h-4 w-4 text-primary" /> {phone}
              </a>
              <a href={`https://wa.me/${waDigits}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 rounded-lg border bg-background py-2 text-sm font-medium active:scale-[0.98]">
                <MessageCircle className="h-4 w-4 text-emerald-600" /> WhatsApp
              </a>
            </div>
          )}
          {call.note && <p className="mt-2.5 rounded-md bg-muted/50 px-2.5 py-2 text-xs"><span className="font-semibold">Note: </span>{call.note}</p>}
        </div>
      )}

      {call.outcome ? (
        <div className={`flex items-start gap-2.5 rounded-xl border p-3 text-sm ${call.outcome === "NOT_A_LEAD" ? "border-slate-200 bg-slate-50 text-slate-700" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
          {call.outcome === "NOT_A_LEAD" ? <Ban className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
          <div className="min-w-0">
            {call.outcome === "LEAD_CREATED" && call.lead && <p>Lead created: <LeadLink l={call.lead} /></p>}
            {call.outcome === "ADDED_TO_LEAD" && call.lead && <p>Call added to <LeadLink l={call.lead} /></p>}
            {call.outcome === "NOT_A_LEAD" && <p>Not a lead — {call.outcomeReason}</p>}
            <p className="mt-0.5 text-xs opacity-75">
              {[call.outcomeBy, call.outcomeAt && fmtCallTime(call.outcomeAt)].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5 rounded-xl border bg-card p-3">
          <p className="text-sm font-semibold">Lead</p>
          {call.matchedLead && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-sm text-amber-900">
              <p className="flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>This number already belongs to <LeadLink l={call.matchedLead} />.</span>
              </p>
              <button onClick={attach} disabled={busy !== null}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-600 py-2 text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-60">
                {busy === "attach" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                Add this call to that lead
              </button>
            </div>
          )}
          <button onClick={() => setSheetOpen(true)} disabled={busy !== null}
            className={`flex w-full items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold active:scale-[0.99] disabled:opacity-60 ${call.matchedLead ? "border bg-background" : "bg-primary text-primary-foreground"}`}>
            <UserPlus className="h-4 w-4" /> {call.matchedLead ? "Create a new lead anyway" : "Create Lead"}
          </button>

          {!reasonOpen ? (
            <button onClick={() => setReasonOpen(true)} className="w-full py-1 text-xs font-medium text-muted-foreground underline-offset-2 hover:underline">
              Not a lead?
            </button>
          ) : (
            <div className="space-y-2 rounded-lg border bg-muted/30 p-2.5">
              <p className="text-xs font-semibold">Why isn't this a lead?</p>
              <div className="flex flex-wrap gap-1.5">
                {NOT_A_LEAD_REASONS.map((r) => (
                  <button key={r} onClick={() => setReason(r)}
                    className={`rounded-full border px-2.5 py-1 text-xs ${reason === r ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}>
                    {r}
                  </button>
                ))}
              </div>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Or type a reason"
                className="h-9 w-full rounded-md border bg-background px-2.5 text-sm" />
              <div className="flex gap-2">
                <button onClick={() => { setReasonOpen(false); setReason(""); }} className="flex-1 rounded-lg border bg-background py-2 text-sm">Cancel</button>
                <button onClick={reject} disabled={busy !== null}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-700 py-2 text-sm font-semibold text-white disabled:opacity-60">
                  {busy === "reject" && <Loader2 className="h-4 w-4 animate-spin" />} Close call
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <QuickLeadSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSubmit={createLead}
        initial={{ name: call.contactName || "", mobileNumber: phone, notes: call.note || "" }}
        title="Create lead from call"
        subtitle="The call recording is attached to the lead automatically."
        submitLabel="Create Lead"
        footerNote={call.taskId ? "Creating the lead also completes this call task." : ""}
      />
    </div>
  );
}

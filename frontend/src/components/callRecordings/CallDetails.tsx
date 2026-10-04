import { fmtCallTime, fmtDuration, type CallRecording } from "@/api/callRecordingApi";
import { displayPhone } from "./CallLeadPanel";

const OUTCOME_LABEL: Record<string, string> = {
  LEAD_CREATED: "Lead created",
  ADDED_TO_LEAD: "Added to existing lead",
  NOT_A_LEAD: "Not a lead",
};

/**
 * The details of one call recording as a compact label/value grid — number, caller, when, length,
 * direction, the admin's note and how the call ended. Used wherever a call recording appears as a
 * file (lead Documents tab, project Documents viewer).
 */
export default function CallDetails({ call, className = "" }: { call: CallRecording; className?: string }) {
  const rows: [string, React.ReactNode][] = [
    ["Phone", call.phoneNumber ? <a href={`tel:${call.phoneNumber}`} className="font-medium text-primary hover:underline">{displayPhone(call.phoneNumber)}</a> : null],
    ["Caller", call.contactName],
    ["Call time", call.calledAt ? fmtCallTime(call.calledAt) : null],
    ["Length", call.durationSec ? fmtDuration(call.durationSec) : null],
    ["Direction", call.direction === "IN" ? "Incoming" : call.direction === "OUT" ? "Outgoing" : null],
    ["Outcome", call.outcome ? [OUTCOME_LABEL[call.outcome], call.outcomeReason].filter(Boolean).join(" — ") : "Open"],
    ["Handled by", call.outcomeBy || call.assigneeName],
    ["Uploaded by", call.uploadedBy],
  ];
  return (
    <div className={className}>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13px]">
        {rows.filter(([, v]) => v != null && v !== "").map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
            <dd className="mt-0.5 break-words text-slate-700">{value}</dd>
          </div>
        ))}
      </dl>
      {call.note && (
        <p className="mt-2.5 rounded-md bg-slate-50 px-2.5 py-2 text-[12.5px] text-slate-700">
          <span className="font-semibold">Note: </span>{call.note}
        </p>
      )}
    </div>
  );
}

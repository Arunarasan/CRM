import { useState } from "react";
import { Check, X, Clock, User, FileText, Phone, ShieldAlert, Image as ImageIcon } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { resolveFileUrl } from "@/lib/uploadFile";
import { profileApprovalsApi, type AdminProfileChangeRequest } from "@/api/profileApprovalsApi";

/**
 * Shared renderer for employee profile/document change requests with Approve/Reject actions.
 * Used both on the central HR "Approvals" queue and inline on an employee's profile page.
 * When `showEmployee` is set each card also names the employee (central queue); the inline
 * panel omits it since the employee is already in context.
 */
export default function ProfileApprovalsPanel({
  requests,
  onChanged,
  showEmployee = false,
  emptyMessage = "No pending requests.",
}: {
  requests: AdminProfileChangeRequest[];
  onChanged: () => void;
  showEmployee?: boolean;
  emptyMessage?: string;
}) {
  const [busy, setBusy] = useState<number | null>(null);

  const approve = async (id: number) => {
    setBusy(id);
    try {
      await profileApprovalsApi.approve(id);
      toast.success("Change approved.");
      onChanged();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || "Could not approve.");
    } finally { setBusy(null); }
  };

  const reject = async (id: number) => {
    const remarks = window.prompt("Reason for rejection (optional):") ?? undefined;
    setBusy(id);
    try {
      await profileApprovalsApi.reject(id, remarks);
      toast.success("Change rejected.");
      onChanged();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || "Could not reject.");
    } finally { setBusy(null); }
  };

  if (requests.length === 0) {
    return <div className="rounded-xl border bg-white p-6 text-center text-sm text-muted-foreground">{emptyMessage}</div>;
  }

  return (
    <div className="space-y-3">
      {requests.map((r) => {
        const pending = r.status === "PENDING";
        const empName = r.employee ? `${r.employee.firstName ?? ""} ${r.employee.lastName ?? ""}`.trim() : "Employee";
        return (
          <div key={r.id} className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    r.changeType === "DOCUMENT" ? "bg-indigo-100 text-indigo-700" : "bg-sky-100 text-sky-700"}`}>
                    {r.changeType === "DOCUMENT" ? <FileText className="h-3 w-3" /> : <User className="h-3 w-3" />}
                    {r.changeType === "DOCUMENT" ? "Document" : "Profile"}
                  </span>
                  <StatusPill status={r.status} />
                </div>
                {showEmployee && (
                  <p className="mt-1.5 text-sm font-semibold text-slate-900">
                    {empName}{r.employee?.employeeCode ? <span className="text-slate-400"> · {r.employee.employeeCode}</span> : null}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">{r.createdAt ? new Date(r.createdAt).toLocaleString() : ""}</p>
              </div>
              {pending && (
                <div className="flex shrink-0 gap-2">
                  <button onClick={() => approve(r.id)} disabled={busy === r.id}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                    <Check className="h-4 w-4" /> Approve
                  </button>
                  <button onClick={() => reject(r.id)} disabled={busy === r.id}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60">
                    <X className="h-4 w-4" /> Reject
                  </button>
                </div>
              )}
            </div>

            <div className="mt-3 space-y-1.5 text-sm">
              {r.changeType === "PROFILE" ? (
                <>
                  {r.proposedPhone != null && <Row icon={<Phone className="h-3.5 w-3.5" />} label="Mobile" value={r.proposedPhone} />}
                  {r.proposedEmergencyName != null && <Row icon={<ShieldAlert className="h-3.5 w-3.5" />} label="Emergency contact" value={r.proposedEmergencyName} />}
                  {r.proposedEmergencyPhone != null && <Row icon={<Phone className="h-3.5 w-3.5" />} label="Emergency phone" value={r.proposedEmergencyPhone} />}
                  {r.proposedPhotoUrl != null && (
                    <div className="flex items-center gap-2">
                      <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">Profile photo:</span>
                      <a href={resolveFileUrl(r.proposedPhotoUrl)} target="_blank" rel="noreferrer">
                        <img src={resolveFileUrl(r.proposedPhotoUrl)} alt="proposed" className="h-10 w-10 rounded object-cover border" />
                      </a>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <Row icon={<FileText className="h-3.5 w-3.5" />} label="Name" value={r.docName ?? ""} />
                  <Row label="Type" value={(r.docType ?? "").replace(/_/g, " ")} />
                  {r.docFileUrl && (
                    <a href={resolveFileUrl(r.docFileUrl)} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                      <FileText className="h-3.5 w-3.5" /> View file
                    </a>
                  )}
                </>
              )}
              {r.status === "REJECTED" && r.reviewRemarks && (
                <p className="text-xs text-red-600">Reason: {r.reviewRemarks}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Row({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      {icon && <span className="text-muted-foreground">{icon}</span>}
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium text-slate-900">{value || "—"}</span>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: "bg-amber-100 text-amber-700",
    APPROVED: "bg-emerald-100 text-emerald-700",
    REJECTED: "bg-red-100 text-red-700",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${map[status] ?? "bg-slate-100 text-slate-600"}`}>
      {status === "PENDING" && <Clock className="h-3 w-3" />}{status}
    </span>
  );
}

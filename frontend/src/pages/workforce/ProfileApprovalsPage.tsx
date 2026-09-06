import { useCallback, useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { profileApprovalsApi, type AdminProfileChangeRequest } from "@/api/profileApprovalsApi";
import ProfileApprovalsPanel from "./ProfileApprovalsPanel";

const FILTERS = ["PENDING", "APPROVED", "REJECTED", "ALL"] as const;
type Filter = (typeof FILTERS)[number];

/**
 * Central HR queue of employee self-service change requests (profile fields + documents).
 * Approving copies the values onto the master record / creates the document; rejecting leaves
 * the record untouched. Also surfaced inline on each employee's profile page.
 */
export default function ProfileApprovalsPage() {
  const [filter, setFilter] = useState<Filter>("PENDING");
  const [rows, setRows] = useState<AdminProfileChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    profileApprovalsApi.list(filter === "ALL" ? "" : filter)
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-slate-900">Profile & Document Approvals</h2>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Changes employees submit from the self-service app land here for review. Nothing updates the
        master record until you approve it.
      </p>

      <div className="mb-4 flex gap-1 rounded-lg border bg-white p-1 text-sm w-fit">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1.5 font-medium capitalize transition-colors ${
              filter === f ? "bg-primary text-primary-foreground" : "text-slate-500 hover:text-slate-800"}`}>
            {f.toLowerCase()}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <ProfileApprovalsPanel requests={rows} onChanged={load} showEmployee
          emptyMessage={filter === "PENDING" ? "No pending requests. All caught up." : "No requests to show."} />
      )}
    </div>
  );
}

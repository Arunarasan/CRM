import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { FilterChips, SectionHeader } from "./hrUi";
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
      <div className="mb-4 space-y-3">
        <SectionHeader
          title="Profile & document approvals"
          description="Changes employees submit from the self-service app. Nothing updates the master record until you approve it."
        />
        <FilterChips<Filter> value={filter} onChange={setFilter}
          options={FILTERS.map((f) => ({ key: f, label: f.charAt(0) + f.slice(1).toLowerCase() }))} />
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

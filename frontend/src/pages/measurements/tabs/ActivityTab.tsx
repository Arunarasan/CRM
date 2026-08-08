import { History } from "lucide-react";
import { measurementApi } from "@/api/measurementApi";
import type { MeasurementActivityLogEntry } from "@/types/measurement";
import { ListSkeleton } from "../../leads/tabs/shared";
import EmptyState from "../../customer360/components/EmptyState";
import { formatDateTime, useMeasurementSubResource } from "../helpers";

export default function ActivityTab({ measurementId }: { measurementId: number }) {
  const { items: log, loading } = useMeasurementSubResource<MeasurementActivityLogEntry>(
    () => measurementApi.getActivityLog(measurementId), [measurementId]);

  if (loading) return <ListSkeleton rows={5} />;
  if (log.length === 0) {
    return <EmptyState icon={History} title="No activity yet" description="Actions taken on this measurement will be tracked here." />;
  }

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-px before:bg-border">
      {log.map((entry, i) => (
        <div key={i} className="relative">
          <span className="absolute -left-6 top-0.5 h-3.5 w-3.5 rounded-full bg-primary border-2 border-background ring-1 ring-primary" />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">{entry.actionType}</span>
            <span className="text-xs text-muted-foreground">{formatDateTime(entry.actionTime)}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{entry.description}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {entry.performedBy}{entry.role ? ` · ${entry.role}` : ""}
          </p>
        </div>
      ))}
    </div>
  );
}

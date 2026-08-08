import { Check, ClipboardList } from "lucide-react";
import { measurementApi } from "@/api/measurementApi";
import type { MeasurementChecklistItem } from "@/types/measurement";
import { ListSkeleton } from "../../leads/tabs/shared";
import EmptyState from "../../customer360/components/EmptyState";
import { formatDateTime, useMeasurementSubResource } from "../helpers";

export default function ChecklistTab({ measurementId, canWrite, onChanged }: {
  measurementId: number; canWrite: boolean; onChanged: () => void;
}) {
  const { items: checklist, loading, reload } = useMeasurementSubResource<MeasurementChecklistItem>(
    () => measurementApi.getChecklist(measurementId), [measurementId]);

  const toggle = (item: MeasurementChecklistItem) => {
    if (!canWrite || !item.id) return;
    measurementApi.toggleChecklistItem(measurementId, item.id, !item.isCompleted)
      .then(() => { reload(); onChanged(); })
      .catch(console.error);
  };

  if (loading) return <ListSkeleton rows={4} />;
  if (checklist.length === 0) {
    return <EmptyState icon={ClipboardList} title="No checklist yet" description="The measurement checklist will be seeded automatically." />;
  }

  const completedCount = checklist.filter((c) => c.isCompleted).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground">{completedCount} of {checklist.length} completed</h3>
        <div className="w-40 h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${(completedCount / checklist.length) * 100}%` }} />
        </div>
      </div>
      <div className="border rounded-xl divide-y bg-card">
        {checklist.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={!canWrite}
            onClick={() => toggle(item)}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${canWrite ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"}`}
          >
            <span className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
              item.isCompleted ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/30"
            }`}>
              {item.isCompleted && <Check className="h-3 w-3" />}
            </span>
            <div className="flex-1">
              <div className={`text-sm ${item.isCompleted ? "text-foreground" : "text-muted-foreground"}`}>{item.itemName}</div>
              {item.isCompleted && item.completedBy && (
                <div className="text-xs text-muted-foreground">by {item.completedBy} · {formatDateTime(item.completedAt)}</div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

import { History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import EmptyState from "@/pages/customer360/components/EmptyState";
import { leadApi } from "../leadApi";
import { formatDateTime } from "../constants";
import { ListSkeleton, useLeadList } from "./shared";

const ACTION_ICONS: Record<string, string> = {
  CREATED: "✨", UPDATED: "✏️", ASSIGNED: "👤", STATUS_CHANGED: "🔄", STAGE_CHANGED: "📊",
  FOLLOW_UP: "📞", COMMUNICATION: "💬", NOTE_ADDED: "📝", NOTE_DELETED: "🗑️",
  DOCUMENT_ADDED: "📎", DOCUMENT_DELETED: "🗑️", TASK_CREATED: "✅", TASK_UPDATED: "☑️",
  SITE_VISIT_SCHEDULED: "📍", CONVERTED: "🎉", DELETED: "🗑️",
};

export default function TimelineTab({ leadId }: { leadId: string }) {
  const { items, loading } = useLeadList<any>(() => leadApi.getActivities(leadId), [leadId]);

  return (
    <Card>
      <CardHeader><CardTitle>Activity Timeline</CardTitle></CardHeader>
      <CardContent>
        {loading ? <ListSkeleton rows={6} /> : items.length === 0 ? (
          <EmptyState icon={History} title="No activity yet" description="Every action on this lead is recorded here automatically." />
        ) : (
          <div className="relative pl-8 space-y-5 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-border">
            {items.map((activity) => (
              <div key={activity.id} className="relative">
                <span className="absolute -left-8 top-0 h-6 w-6 rounded-full bg-background border flex items-center justify-center text-xs">
                  {ACTION_ICONS[activity.action] || "•"}
                </span>
                <div>
                  <p className="text-sm">{activity.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {activity.action?.replace(/_/g, " ")} · {formatDateTime(activity.createdAt)}
                    {activity.performedBy?.name ? ` · ${activity.performedBy.name}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

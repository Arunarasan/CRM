import { ClipboardList } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import EmptyState from "@/pages/customer360/components/EmptyState";
import { leadApi } from "../leadApi";
import { formatDateTime, formatDate } from "../constants";
import { ListSkeleton, useLeadList } from "./shared";

const FORM_LABELS: Record<string, string> = {
  FOLLOW_UP: "Follow-up",
  REQUIREMENT: "Requirement",
  QUALIFY: "Qualification",
  SCHEDULE_VISIT: "Site Visit Scheduled",
  SITE_VISIT: "Site Visit Report",
  REVIEW: "Lead Review",
};

const FORM_STYLES: Record<string, string> = {
  FOLLOW_UP: "bg-emerald-100 text-emerald-700",
  REQUIREMENT: "bg-purple-100 text-purple-700",
  QUALIFY: "bg-amber-100 text-amber-700",
  SCHEDULE_VISIT: "bg-teal-100 text-teal-700",
  SITE_VISIT: "bg-emerald-100 text-emerald-700",
  REVIEW: "bg-slate-100 text-slate-700",
};

// Humanize a camelCase data key → "Camel Case".
const humanize = (k: string) =>
  k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim();

export default function TaskDataTab({ leadId }: { leadId: string }) {
  const { items, loading } = useLeadList<any>(() => leadApi.getTaskSubmissions(leadId), [leadId]);

  return (
    <Card>
      <CardHeader><CardTitle>Task Data</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Structured details captured by employees as they completed this lead's workflow tasks.
        </p>
        {loading ? <ListSkeleton /> : items.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No task data yet"
            description="When employees complete follow-up, requirement, qualification or site-visit tasks, their captured details appear here." />
        ) : (
          <div className="space-y-3">
            {items.map((s) => {
              const data: Record<string, any> = s.data || {};
              const media: any[] = s.media || [];
              return (
                <div key={s.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${FORM_STYLES[s.formType] || "bg-muted"}`}>
                        {FORM_LABELS[s.formType] || s.formType}
                      </span>
                      <span className="text-sm font-medium">{s.taskName}</span>
                    </div>
                    {s.outcome && <span className="text-xs font-medium text-muted-foreground">{s.outcome}</span>}
                  </div>

                  {s.notes && <p className="mt-2 text-sm whitespace-pre-wrap">{s.notes}</p>}

                  {Object.keys(data).length > 0 && (
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                      {Object.entries(data).map(([k, v]) => (
                        v == null || v === "" ? null : (
                          <div key={k} className="text-xs">
                            <dt className="text-muted-foreground">{humanize(k)}</dt>
                            <dd className="font-medium break-words">{String(v)}</dd>
                          </div>
                        )
                      ))}
                    </dl>
                  )}

                  {s.nextFollowUpDate && (
                    <p className="mt-2 text-xs text-emerald-700">Next follow-up: {formatDate(s.nextFollowUpDate)}</p>
                  )}

                  {media.length > 0 && (
                    <div className="mt-2 flex gap-2 overflow-x-auto">
                      {media.map((m, i) => (
                        <a key={i} href={m.url} target="_blank" rel="noreferrer">
                          <img src={m.url} alt={m.caption || ""} className="h-16 w-16 rounded-md object-cover border" />
                        </a>
                      ))}
                    </div>
                  )}

                  <p className="mt-2 text-xs text-muted-foreground">
                    {s.submittedByName || "—"} · {formatDateTime(s.submittedAt)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

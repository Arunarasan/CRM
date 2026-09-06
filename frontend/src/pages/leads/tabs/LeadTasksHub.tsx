import { useState } from "react";
import { GitBranch, Bell, ClipboardList } from "lucide-react";
import type { UserSummary } from "../constants";
import LeadJourneyTab from "./LeadJourneyTab";
import TasksTab from "./TasksTab";
import TaskDataTab from "./TaskDataTab";

// One "Tasks" home for a lead, split into three clear sub-tabs:
//  • Lead Journey  — the auto-generated workflow steps (assign: auto / smart / manual)
//  • Task Reminder — the manual mini task-manager (calls, follow-ups, ad-hoc reminders)
//  • Task Data     — structured data captured while completing the workflow steps
type SubTab = "journey" | "reminder" | "data";

const SUBTABS: { id: SubTab; label: string; icon: any }[] = [
  { id: "journey", label: "Lead Journey", icon: GitBranch },
  { id: "reminder", label: "Task Reminder", icon: Bell },
  { id: "data", label: "Task Data", icon: ClipboardList },
];

export default function LeadTasksHub({ leadId, users }: { leadId: string; users: UserSummary[] }) {
  const [sub, setSub] = useState<SubTab>("journey");

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border bg-muted/40 p-1">
        {SUBTABS.map((t) => {
          const Icon = t.icon;
          const active = sub === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setSub(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${active ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {sub === "journey" && <LeadJourneyTab leadId={leadId} />}
      {sub === "reminder" && <TasksTab leadId={leadId} users={users} />}
      {sub === "data" && <TaskDataTab leadId={leadId} />}
    </div>
  );
}

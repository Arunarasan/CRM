import { TaskSummary, LeadFollowUp } from "@/types/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Clock, PhoneCall } from "lucide-react";

export default function TasksAndFollowUps({ 
  tasks, 
  followUps, 
  isLoading 
}: { 
  tasks: TaskSummary[], 
  followUps: LeadFollowUp[], 
  isLoading: boolean 
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
        <div className="h-[400px] bg-muted rounded-xl" />
        <div className="h-[400px] bg-muted rounded-xl" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      
      {/* Tasks Card */}
      <Card className="shadow-sm rounded-xl border-border/40 animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: '400ms' }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-rose-500" />
            Today's Tasks
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground space-y-3">
              <CheckCircle2 className="h-10 w-10 text-muted/50" />
              <p>You're all caught up!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tasks.map(task => (
                <div key={task.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-background hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-rose-500" />
                    <div>
                      <p className="text-sm font-medium leading-none">{task.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{task.status}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">
                    <Clock className="h-3 w-3" />
                    {task.priority}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Follow-ups Card */}
      <Card className="shadow-sm rounded-xl border-border/40 animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: '500ms' }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PhoneCall className="h-5 w-5 text-indigo-500" />
            Today's Follow-ups
          </CardTitle>
        </CardHeader>
        <CardContent>
          {followUps.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground space-y-3">
              <PhoneCall className="h-10 w-10 text-muted/50" />
              <p>No follow-ups scheduled for today.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {followUps.map(lead => (
                <div key={lead.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-background hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500 font-bold">
                      {lead.customerName.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium leading-none">{lead.customerName}</p>
                      <p className="text-xs text-muted-foreground mt-1">{lead.status}</p>
                    </div>
                  </div>
                  <button className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90 transition-colors">
                    View
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}

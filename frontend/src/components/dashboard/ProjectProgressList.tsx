import { ProjectProgress } from "@/types/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, Calendar } from "lucide-react";

export default function ProjectProgressList({ projects, isLoading }: { projects: ProjectProgress[], isLoading: boolean }) {
  if (isLoading) {
    return (
      <Card className="col-span-1 shadow-sm rounded-xl border-border/40">
        <CardHeader>
          <CardTitle>Active Projects</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-1 shadow-sm rounded-xl border-border/40 animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: '600ms' }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-amber-500" />
          Active Projects Progress
        </CardTitle>
      </CardHeader>
      <CardContent>
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground space-y-3">
            <Briefcase className="h-10 w-10 text-muted/50" />
            <p>No active projects.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {projects.map(project => (
              <div key={project.id} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{project.name}</span>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Due {new Date(project.endDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-amber-500 rounded-full transition-all duration-1000 ease-out" 
                      style={{ width: `${project.progress}%` }} 
                    />
                  </div>
                  <span className="text-xs font-bold w-8 text-right">{project.progress}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

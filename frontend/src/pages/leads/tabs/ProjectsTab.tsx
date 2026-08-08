import { Link } from "react-router-dom";
import { Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import EmptyState from "@/pages/customer360/components/EmptyState";
import { leadApi } from "../leadApi";
import { formatINR, statusStyle } from "../constants";
import { ListSkeleton, useLeadList } from "./shared";

export default function ProjectsTab({ leadId }: { leadId: string }) {
  const { items, loading } = useLeadList<any>(() => leadApi.getProjects(leadId), [leadId]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Projects</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? <ListSkeleton /> : items.length === 0 ? (
          <EmptyState icon={Briefcase} title="No projects" description="A project is created once one of this lead's quotations is approved and converted." />
        ) : (
          <div className="space-y-3">
            {items.map((p) => (
              <div key={p.id} className="border rounded-lg p-4 flex flex-wrap items-center justify-between gap-3 bg-muted/30">
                <div>
                  <div className="flex items-center gap-2">
                    <Link to={`/projects/${p.id}`} className="font-medium text-sm text-primary hover:underline">
                      {p.projectName}
                    </Link>
                    <span className="text-xs px-2 py-0.5 bg-background border rounded-full">{p.projectCode || `#${p.id}`}</span>
                    {p.status && <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${statusStyle(p.status)}`}>{p.status}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Budget: <span className="font-semibold text-foreground">{formatINR(p.budget)}</span>
                    {typeof p.progress === "number" ? ` · ${p.progress}% complete` : ""}
                  </div>
                </div>
                <Link to={`/projects/${p.id}`}>
                  <Button variant="outline" size="sm">Open</Button>
                </Link>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

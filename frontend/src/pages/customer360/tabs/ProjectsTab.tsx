import { Link } from "react-router-dom";
import { Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "../components/EmptyState";
import PaginationFooter from "../components/PaginationFooter";
import { usePagedTab } from "../usePagedTab";
import customer360Api from "@/lib/customer360Api";

export default function ProjectsTab({ customerId }: { customerId: string }) {
  const { items, page, setPage, totalPages, isLoading } = usePagedTab<any>(
    (page, size) => customer360Api.getProjects(customerId, page, size),
    [customerId]
  );

  if (isLoading) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}</div>;
  }

  if (items.length === 0) {
    return <Card><CardContent className="pt-6"><EmptyState icon={Building2} title="No projects yet" description="Projects started for this customer will appear here." /></CardContent></Card>;
  }

  return (
    <div className="space-y-3">
      {items.map((p) => {
        const budget = Number(p.budget || 0);
        const spent = Number(p.spentAmount || 0);
        const remaining = budget - spent;
        return (
          <Card key={p.id}>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{p.projectName}</span>
                    <Badge variant="secondary">{p.status || "—"}</Badge>
                    {p.projectCode && <span className="text-xs text-muted-foreground">#{p.projectCode}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {p.startDate ? new Date(p.startDate).toLocaleDateString() : "—"} → {p.endDate ? new Date(p.endDate).toLocaleDateString() : "—"}
                  </div>
                </div>
                <Button asChild variant="outline" size="sm"><Link to={`/projects/${p.id}`}>Open Command Center</Link></Button>
              </div>

              <div className="mt-3">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Progress</span><span>{p.progress ?? 0}%</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, p.progress ?? 0)}%` }} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="bg-muted/50 rounded-lg p-2 text-center">
                  <div className="text-xs text-muted-foreground">Budget</div>
                  <div className="text-sm font-semibold">₹{budget.toLocaleString("en-IN")}</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-2 text-center">
                  <div className="text-xs text-muted-foreground">Spent</div>
                  <div className="text-sm font-semibold">₹{spent.toLocaleString("en-IN")}</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-2 text-center">
                  <div className="text-xs text-muted-foreground">Remaining</div>
                  <div className="text-sm font-semibold">₹{remaining.toLocaleString("en-IN")}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
      <PaginationFooter page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}

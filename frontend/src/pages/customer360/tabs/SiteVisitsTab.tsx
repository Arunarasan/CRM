import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "../components/EmptyState";
import customer360Api from "@/lib/customer360Api";
import { isSameDay } from "date-fns";

function VisitTable({ items }: { items: any[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">None.</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Visit</TableHead>
          <TableHead>Purpose</TableHead>
          <TableHead>Scheduled</TableHead>
          <TableHead>Location</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((v) => (
          <TableRow key={v.id}>
            <TableCell className="font-medium">{v.visitNumber || `#${v.id}`}</TableCell>
            <TableCell>{v.visitType || "—"}</TableCell>
            <TableCell>{v.scheduledTime ? new Date(v.scheduledTime).toLocaleString() : (v.scheduledDate ? new Date(v.scheduledDate).toLocaleDateString() : "—")}</TableCell>
            <TableCell className="max-w-[220px] truncate">{v.locationAddress || "—"}</TableCell>
            <TableCell><Badge variant="secondary">{v.status || "—"}</Badge></TableCell>
            <TableCell className="text-right">
              <Button asChild variant="ghost" size="sm"><Link to={`/site-visits/${v.id}`}>View</Link></Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function SiteVisitsTab({ customerId }: { customerId: string }) {
  const [visits, setVisits] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    // Fetch a large page since this tab groups by status/date rather than paginating.
    customer360Api.getSiteVisits(customerId, 0, 200)
      .then((res) => setVisits(res.content || []))
      .finally(() => setIsLoading(false));
  }, [customerId]);

  const today = new Date();
  const upcoming = visits.filter((v) => v.scheduledTime && new Date(v.scheduledTime) > today && v.status !== "Cancelled" && v.status !== "Completed" && !isSameDay(new Date(v.scheduledTime), today));
  const todays = visits.filter((v) => v.scheduledTime && isSameDay(new Date(v.scheduledTime), today) && v.status !== "Cancelled");
  const completed = visits.filter((v) => v.status === "Completed");
  const cancelled = visits.filter((v) => v.status === "Cancelled");

  if (isLoading) {
    return (
      <Card><CardContent className="pt-6 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</CardContent></Card>
    );
  }

  if (visits.length === 0) {
    return (
      <Card><CardContent className="pt-6">
        <EmptyState icon={MapPin} title="No site visits yet" description="Scheduled and completed site visits will appear here." />
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Today's Visits ({todays.length})</h3>
          <VisitTable items={todays} />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Upcoming Visits ({upcoming.length})</h3>
          <VisitTable items={upcoming} />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Completed Visits ({completed.length})</h3>
          <VisitTable items={completed} />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Cancelled Visits ({cancelled.length})</h3>
          <VisitTable items={cancelled} />
        </CardContent>
      </Card>
    </div>
  );
}

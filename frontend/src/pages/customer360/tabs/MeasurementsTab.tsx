import { Link } from "react-router-dom";
import { Ruler } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "../components/EmptyState";
import PaginationFooter from "../components/PaginationFooter";
import { usePagedTab } from "../usePagedTab";
import customer360Api from "@/lib/customer360Api";

export default function MeasurementsTab({ customerId }: { customerId: string }) {
  const { items, page, setPage, totalPages, isLoading } = usePagedTab<any>(
    (page, size) => customer360Api.getMeasurements(customerId, page, size),
    [customerId]
  );

  return (
    <Card>
      <CardContent className="pt-6">
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : items.length === 0 ? (
          <EmptyState icon={Ruler} title="No measurements yet" description="Room measurements captured for this customer will appear here." />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Measurement</TableHead>
                  <TableHead>Property Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Total Area</TableHead>
                  <TableHead>Measured By</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.measurementNumber || `#${m.id}`}</TableCell>
                    <TableCell>{m.propertyType || "—"}</TableCell>
                    <TableCell>{m.measurementDate ? new Date(m.measurementDate).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>{m.totalArea ? `${m.totalArea} sq.ft` : "—"}</TableCell>
                    <TableCell>{m.measuredBy || "—"}</TableCell>
                    <TableCell><Badge variant="secondary">{m.status || "—"}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm"><Link to={`/measurements/${m.id}`}>View</Link></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PaginationFooter page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

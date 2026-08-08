import { Link } from "react-router-dom";
import { FileSpreadsheet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "../components/EmptyState";
import PaginationFooter from "../components/PaginationFooter";
import { usePagedTab } from "../usePagedTab";
import customer360Api from "@/lib/customer360Api";

function statusVariant(status?: string) {
  if (!status) return "secondary" as const;
  const s = status.toLowerCase();
  if (s === "approved") return "success" as const;
  if (s === "rejected") return "destructive" as const;
  return "secondary" as const;
}

export default function BoqTab({ customerId }: { customerId: string }) {
  const { items, page, setPage, totalPages, isLoading } = usePagedTab<any>(
    (page, size) => customer360Api.getBoqs(customerId, page, size),
    [customerId]
  );

  return (
    <Card>
      <CardContent className="pt-6">
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : items.length === 0 ? (
          <EmptyState icon={FileSpreadsheet} title="No BOQs yet" description="BOQs generated for this customer will appear here." />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>BOQ #</TableHead>
                  <TableHead>Revision</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.boqNumber}</TableCell>
                    <TableCell>Rev {b.revisionNumber ?? 1}</TableCell>
                    <TableCell>{b.createdAt ? new Date(b.createdAt).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>{b.grandTotal ? `₹${Number(b.grandTotal).toLocaleString("en-IN")}` : "—"}</TableCell>
                    <TableCell><Badge variant={statusVariant(b.status)}>{b.status || "—"}</Badge></TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button asChild variant="ghost" size="sm"><Link to={`/boq/${b.id}`}>View</Link></Button>
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

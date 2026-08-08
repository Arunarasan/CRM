import { Link } from "react-router-dom";
import { FileText } from "lucide-react";
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

export default function QuotationsTab({ customerId }: { customerId: string }) {
  const { items, page, setPage, totalPages, isLoading } = usePagedTab<any>(
    (page, size) => customer360Api.getQuotations(customerId, page, size),
    [customerId]
  );

  return (
    <Card>
      <CardContent className="pt-6">
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : items.length === 0 ? (
          <EmptyState icon={FileText} title="No quotations yet" description="Quotations created for this customer will appear here." />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quotation #</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Approval</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-medium">{q.quotationNumber}</TableCell>
                    <TableCell>Rev {q.revisionNumber ?? 0}</TableCell>
                    <TableCell>{q.quotationDate ? new Date(q.quotationDate).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>{q.grandTotal ? `₹${Number(q.grandTotal).toLocaleString("en-IN")}` : "—"}</TableCell>
                    <TableCell><Badge variant={statusVariant(q.status)}>{q.status || "—"}</Badge></TableCell>
                    <TableCell><Badge variant="outline">{q.internalApprovalStatus || "—"}</Badge></TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button asChild variant="ghost" size="sm"><Link to={`/quotations/${q.id}`}>View</Link></Button>
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

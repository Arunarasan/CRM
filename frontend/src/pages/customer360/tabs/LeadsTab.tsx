import { Link } from "react-router-dom";
import { Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "../components/EmptyState";
import PaginationFooter from "../components/PaginationFooter";
import { usePagedTab } from "../usePagedTab";
import customer360Api from "@/lib/customer360Api";

export default function LeadsTab({ customerId }: { customerId: string }) {
  const { items, page, setPage, totalPages, isLoading } = usePagedTab<any>(
    (page, size) => customer360Api.getLeads(customerId, page, size),
    [customerId]
  );

  return (
    <Card>
      <CardContent className="pt-6">
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : items.length === 0 ? (
          <EmptyState icon={Target} title="No leads yet" description="Leads converted into this customer will appear here." />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Expected Value</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">{lead.name}</TableCell>
                    <TableCell>{lead.leadSource || "—"}</TableCell>
                    <TableCell><Badge variant="secondary">{lead.status || "—"}</Badge></TableCell>
                    <TableCell>{lead.assignedSalesExecutive?.name || "—"}</TableCell>
                    <TableCell>{lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>{lead.estimatedBudget ? `₹${Number(lead.estimatedBudget).toLocaleString("en-IN")}` : "—"}</TableCell>
                    <TableCell>{lead.priority || "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/leads/${lead.id}`}>View</Link>
                      </Button>
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

import { History } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "../components/EmptyState";
import PaginationFooter from "../components/PaginationFooter";
import { usePagedTab } from "../usePagedTab";
import customer360Api from "@/lib/customer360Api";
import type { CustomerActivityLogEntry } from "@/types/customer360";

export default function ActivityLogTab({ customerId }: { customerId: string }) {
  const { items, page, setPage, totalPages, isLoading } = usePagedTab<CustomerActivityLogEntry>(
    (page, size) => customer360Api.getActivityLog(customerId, page, size),
    [customerId],
    20
  );

  return (
    <Card>
      <CardContent className="pt-6">
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
        ) : items.length === 0 ? (
          <EmptyState icon={History} title="No activity recorded yet" description="Every create, update and workflow action on this customer will be logged here, powered by the same audit system used across the CRM." />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell><Badge variant="outline">{log.action}</Badge></TableCell>
                    <TableCell className="max-w-[280px] truncate">{log.description || "—"}</TableCell>
                    <TableCell>{log.performedBy || "—"}</TableCell>
                    <TableCell>{log.performedRole || "—"}</TableCell>
                    <TableCell>{log.performedAt ? new Date(log.performedAt).toLocaleString() : "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{log.ipAddress || "—"}</TableCell>
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

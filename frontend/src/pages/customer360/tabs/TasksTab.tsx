import { CheckSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "../components/EmptyState";
import PaginationFooter from "../components/PaginationFooter";
import { usePagedTab } from "../usePagedTab";
import customer360Api from "@/lib/customer360Api";

function statusVariant(status?: string) {
  if (!status) return "secondary" as const;
  const s = status.toLowerCase();
  if (s === "completed") return "success" as const;
  if (s === "in_progress") return "warning" as const;
  return "secondary" as const;
}

export default function TasksTab({ customerId }: { customerId: string }) {
  const { items, page, setPage, totalPages, isLoading } = usePagedTab<any>(
    (page, size) => customer360Api.getTasks(customerId, page, size),
    [customerId]
  );

  return (
    <Card>
      <CardContent className="pt-6">
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : items.length === 0 ? (
          <EmptyState icon={CheckSquare} title="No tasks yet" description="Tasks from this customer's projects will appear here." />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Completion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.taskName}</TableCell>
                    <TableCell>{t.assignedEmployee?.name || "—"}</TableCell>
                    <TableCell>{t.priority || "—"}</TableCell>
                    <TableCell><Badge variant={statusVariant(t.status)}>{t.status || "—"}</Badge></TableCell>
                    <TableCell>{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>{t.status === "COMPLETED" ? (t.updatedAt ? new Date(t.updatedAt).toLocaleDateString() : "Completed") : "—"}</TableCell>
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

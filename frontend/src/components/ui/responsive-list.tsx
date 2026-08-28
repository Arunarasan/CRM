import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/pages/customer360/components/EmptyState";

/**
 * One list, two shapes. Renders an information-dense table on tablet/desktop (md+) and a
 * tap-friendly stack of cards on phones — instead of forcing a wide table into a horizontal
 * scroll. Loading and empty states are built in so every list in the app looks and behaves
 * the same way.
 */

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** classes for the <th> (e.g. "text-right", "whitespace-nowrap") */
  headClassName?: string;
  /** classes for the <td> */
  cellClassName?: string;
}

interface ResponsiveListProps<T> {
  items: T[];
  columns: Column<T>[];
  getRowKey: (row: T) => string | number;
  /** Card body for a single row on phones. */
  renderCard: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  skeletonRows?: number;
  emptyIcon: LucideIcon;
  emptyTitle: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
}

export default function ResponsiveList<T>({
  items, columns, getRowKey, renderCard, onRowClick,
  loading = false, skeletonRows = 6,
  emptyIcon, emptyTitle, emptyDescription, emptyAction,
}: ResponsiveListProps<T>) {
  const isEmpty = !loading && items.length === 0;

  return (
    <div className="border rounded-xl bg-card overflow-hidden">
      {/* Desktop / tablet — full table */}
      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c.key} className={c.headClassName}>{c.header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: skeletonRows }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((c) => (
                    <TableCell key={c.key}><Skeleton className="h-5 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : isEmpty ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="p-0">
                  <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} action={emptyAction} />
                </TableCell>
              </TableRow>
            ) : (
              items.map((row) => (
                <TableRow
                  key={getRowKey(row)}
                  className={onRowClick ? "cursor-pointer" : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((c) => (
                    <TableCell key={c.key} className={c.cellClassName}>{c.cell(row)}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Phone — cards */}
      <div className="md:hidden divide-y">
        {loading ? (
          Array.from({ length: skeletonRows }).map((_, i) => (
            <div key={i} className="p-4 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          ))
        ) : isEmpty ? (
          <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} action={emptyAction} />
        ) : (
          items.map((row) => (
            <div
              key={getRowKey(row)}
              className={`p-4 ${onRowClick ? "cursor-pointer active:bg-muted/50 transition-colors" : ""}`}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {renderCard(row)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

import { Button } from "@/components/ui/button";

export default function PaginationFooter({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-3 mt-3 border-t">
      <span className="text-xs text-muted-foreground">
        Page {page + 1} of {totalPages}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => onPageChange(page - 1)}>
          Previous
        </Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

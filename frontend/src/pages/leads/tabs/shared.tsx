import { useCallback, useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

/** Loads a lead sub-resource list and exposes a reload handle. */
export function useLeadList<T>(fetcher: () => Promise<{ data: T[] }>, deps: unknown[] = []) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    fetcher()
      .then((res) => setItems(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { reload(); }, [reload]);
  return { items, loading, reload };
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
    </div>
  );
}

import { useEffect, useState } from "react";
import type { PageResponse } from "@/types/customer360";

/**
 * Shared fetch/pagination state for the Customer 360 list-style tabs. Extracted because the
 * same page/size/loading/error/refetch shape repeats across all 12 tabs.
 */
export function usePagedTab<T>(
  fetcher: (page: number, size: number) => Promise<PageResponse<T>>,
  deps: any[] = [],
  size = 10
) {
  const [page, setPage] = useState(0);
  const [data, setData] = useState<PageResponse<T> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setIsLoading(true);
    setError(null);
    fetcher(page, size)
      .then(setData)
      .catch((err) => setError(err.message || "Failed to load data"))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, ...deps]);

  return {
    page,
    setPage,
    items: data?.content ?? [],
    totalPages: data?.totalPages ?? 0,
    totalElements: data?.totalElements ?? 0,
    isLoading,
    error,
    reload: load,
  };
}

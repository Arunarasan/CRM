import { useCallback, useEffect, useState } from "react";

// Small formatting + data-loading helpers shared across the Measurement Management pages.
// Mirrors the equivalent helpers in pages/leads/constants.ts and pages/leads/tabs/shared.tsx.

export function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function formatArea(value?: number | null) {
  if (value === null || value === undefined) return "—";
  return `${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 1 })} sq.ft`;
}

export function initials(name?: string) {
  if (!name) return "?";
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

/** Loads a measurement sub-resource list (already-unwrapped data) and exposes a reload handle. */
export function useMeasurementSubResource<T>(fetcher: () => Promise<T[]>, deps: unknown[]) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    fetcher()
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { reload(); }, [reload]);
  return { items, loading, reload };
}

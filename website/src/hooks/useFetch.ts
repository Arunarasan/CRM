import { useCallback, useEffect, useState } from 'react'

interface FetchState<T> {
  data: T | null
  loading: boolean
  error: string | null
  reload: () => void
}

/**
 * Minimal data-fetching hook with loading/error state and a reload trigger.
 * Errors are surfaced generically — never raw backend messages — to the customer.
 */
export function useFetch<T>(fetcher: () => Promise<T>, deps: unknown[] = []): FetchState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(() => {
    let active = true
    setLoading(true)
    setError(null)
    fetcher()
      .then((res) => { if (active) setData(res) })
      .catch(() => { if (active) setError('Something went wrong. Please try again.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => run(), [run])

  return { data, loading, error, reload: run }
}

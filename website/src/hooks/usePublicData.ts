import { useEffect, useState } from 'react'

/**
 * Resilient catalog loader: renders `seed` immediately (no loading flash on the marketing site),
 * then fetches live content from the API and swaps it in — but ONLY if the API returns usable data.
 * On any failure, or an empty response, the seed data stays. This makes the public site work
 * standalone and upgrade seamlessly to live CMS content when the backend is available.
 */
export function usePublicData<T>(seed: T, fetcher: () => Promise<T>): T {
  const [data, setData] = useState<T>(seed)

  useEffect(() => {
    let active = true
    fetcher()
      .then((res) => {
        if (!active || res == null) return
        if (Array.isArray(res) && res.length === 0) return // keep seed rather than show empty
        setData(res)
      })
      .catch(() => {
        /* keep seed on error */
      })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return data
}

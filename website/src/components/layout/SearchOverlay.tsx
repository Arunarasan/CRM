import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, X, TrendingUp } from 'lucide-react'
import { products } from '@/data/products'
import { services } from '@/data/services'
import { portfolioProjects } from '@/data/portfolio'
import { materials } from '@/data/materials'
import { categories } from '@/data/categories'

interface Result {
  label: string
  sub: string
  to: string
  group: string
}

/** Builds a flat, searchable index across products, services, portfolio, and materials. */
function useIndex(): Result[] {
  return useMemo(
    () => [
      ...products.map((p) => ({ label: p.name, sub: 'Product', to: `/shop/${p.slug}`, group: 'Products' })),
      ...services.map((s) => ({ label: s.title, sub: 'Service', to: `/services/${s.slug}`, group: 'Services' })),
      ...portfolioProjects.map((p) => ({ label: p.title, sub: p.category, to: `/portfolio/${p.slug}`, group: 'Portfolio' })),
      ...materials.map((m) => ({ label: m.name, sub: m.category, to: `/materials/${m.slug}`, group: 'Materials' })),
    ],
    [],
  )
}

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const index = useIndex()

  useEffect(() => {
    if (open) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return index.filter((r) => r.label.toLowerCase().includes(q) || r.sub.toLowerCase().includes(q)).slice(0, 12)
  }, [query, index])

  const grouped = useMemo(() => {
    const map: Record<string, Result[]> = {}
    results.forEach((r) => { (map[r.group] ??= []).push(r) })
    return map
  }, [results])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Search">
      <div className="absolute inset-0 bg-forest-deep/80 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-x-0 top-0 mx-auto max-w-2xl px-4 pt-20">
        <div className="overflow-hidden border border-gold/30 bg-ivory shadow-card-hover">
          {/* Input */}
          <div className="flex items-center gap-3 border-b border-forest/10 bg-white px-5 py-4">
            <Search className="h-5 w-5 text-forest/40" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products, services, projects, materials…"
              className="flex-1 bg-transparent text-base text-forest placeholder:text-forest/35 focus:outline-none"
            />
            <button onClick={onClose} aria-label="Close search" className="text-forest/40 hover:text-forest">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="max-h-[60vh] overflow-y-auto p-5">
            {query.trim() === '' ? (
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-forest/50">
                  <TrendingUp className="h-4 w-4" /> Popular Categories
                </h3>
                <div className="flex flex-wrap gap-2">
                  {categories.slice(0, 8).map((c) => (
                    <Link
                      key={c.id}
                      to={`/shop?category=${c.slug}`}
                      onClick={onClose}
                      className="border border-forest/15 bg-white px-3 py-1.5 text-sm text-forest/75 transition-colors hover:border-gold hover:text-gold-dark"
                    >
                      {c.name}
                    </Link>
                  ))}
                </div>
              </div>
            ) : results.length === 0 ? (
              <p className="py-8 text-center text-sm text-forest/50">
                No results for “{query}”. Try a different term.
              </p>
            ) : (
              <div className="space-y-5">
                {Object.entries(grouped).map(([group, items]) => (
                  <div key={group}>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gold-dark">{group}</h3>
                    <ul className="divide-y divide-forest/5">
                      {items.map((r) => (
                        <li key={r.to}>
                          <Link
                            to={r.to}
                            onClick={onClose}
                            className="flex items-center justify-between gap-3 py-2.5 text-sm text-forest transition-colors hover:text-gold-dark"
                          >
                            <span className="font-medium">{r.label}</span>
                            <span className="text-xs text-forest/40">{r.sub}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

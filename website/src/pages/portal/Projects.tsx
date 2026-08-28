import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { portalApi } from '@/api/portalApi'
import { useFetch } from '@/hooks/useFetch'
import { AsyncSection, Card, ProgressBar, StatusBadge } from '@/components/portal/PortalUI'

interface Project {
  id: number
  name: string
  code: string
  status: string
  progress: number
  projectType: string
}

export default function PortalProjects() {
  const { data, loading, error, reload } = useFetch<Project[]>(() => portalApi.projects())

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-forest">My Projects</h1>
        <p className="mt-1 text-forest/55">Track progress across every space we're crafting for you.</p>
      </div>

      <AsyncSection
        loading={loading}
        error={error}
        onRetry={reload}
        empty={!!data && data.length === 0}
        emptyMessage="Your projects will appear here once your journey with JB Decor begins."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {data?.map((p) => (
            <Link key={p.id} to={`/portal/projects/${p.id}`}>
              <Card className="transition-all hover:-translate-y-0.5 hover:shadow-card-hover">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-serif text-lg font-semibold text-forest">{p.name}</h3>
                    <p className="text-xs text-forest/40">{p.code} · {p.projectType}</p>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                <div className="mt-5">
                  <div className="mb-1.5 flex justify-between text-xs text-forest/55">
                    <span>Progress</span><span className="font-semibold text-forest">{p.progress ?? 0}%</span>
                  </div>
                  <ProgressBar value={p.progress ?? 0} />
                </div>
                <div className="mt-4 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gold-dark">
                  View Details <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </AsyncSection>
    </div>
  )
}

import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Check, Circle, MapPin, Calendar } from 'lucide-react'
import { portalApi } from '@/api/portalApi'
import { useFetch } from '@/hooks/useFetch'
import { AsyncSection, Card, ProgressBar, StatusBadge, Skeleton } from '@/components/portal/PortalUI'
import { cn } from '@/lib/utils'

interface ProjectDetailData {
  id: number
  name: string
  code: string
  status: string
  progress: number
  projectType: string
  propertyAddress?: string
  startDate?: string
  endDate?: string
  actualCompletionDate?: string
  customerNotes?: string
}

// Canonical customer-facing journey. Until per-project milestone data is wired, completion is
// inferred from overall progress so the stepper stays truthful to the reported percentage.
const MILESTONES = ['Consultation', 'Design', 'Quotation', 'Material Selection', 'Production', 'Installation', 'Completion']

export default function PortalProjectDetail() {
  const { id = '' } = useParams()
  const { data, loading, error, reload } = useFetch<ProjectDetailData>(() => portalApi.project(id), [id])

  const progress = data?.progress ?? 0
  const doneCount = Math.round((progress / 100) * MILESTONES.length)

  return (
    <div className="space-y-6">
      <Link to="/portal/projects" className="inline-flex items-center gap-2 text-sm text-forest/60 hover:text-gold">
        <ArrowLeft className="h-4 w-4" /> Back to Projects
      </Link>

      <AsyncSection
        loading={loading}
        error={error}
        onRetry={reload}
        skeleton={<div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>}
      >
        {data && (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="font-serif text-3xl font-semibold text-forest">{data.name}</h1>
                <p className="mt-1 text-sm text-forest/45">{data.code} · {data.projectType}</p>
              </div>
              <StatusBadge status={data.status} />
            </div>

            {/* Progress */}
            <Card>
              <div className="mb-2 flex justify-between text-sm">
                <span className="font-medium text-forest">Overall Progress</span>
                <span className="font-semibold text-gold-dark">{progress}%</span>
              </div>
              <ProgressBar value={progress} />
            </Card>

            <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
              {/* Milestones */}
              <Card>
                <h2 className="mb-5 font-serif text-lg font-semibold text-forest">Project Journey</h2>
                <ol className="space-y-1">
                  {MILESTONES.map((m, i) => {
                    const done = i < doneCount
                    const current = i === doneCount
                    return (
                      <li key={m} className="flex items-center gap-3 py-2">
                        <span className={cn(
                          'flex h-7 w-7 items-center justify-center rounded-full text-xs',
                          done ? 'bg-gold text-forest' : current ? 'border-2 border-gold text-gold' : 'border border-forest/20 text-forest/30',
                        )}>
                          {done ? <Check className="h-4 w-4" /> : current ? <span className="h-2 w-2 rounded-full bg-gold" /> : <Circle className="h-3 w-3" />}
                        </span>
                        <span className={cn('text-sm', done ? 'font-medium text-forest' : current ? 'font-medium text-gold-dark' : 'text-forest/40')}>
                          {m}
                        </span>
                      </li>
                    )
                  })}
                </ol>
              </Card>

              {/* Facts */}
              <Card>
                <h2 className="mb-4 font-serif text-lg font-semibold text-forest">Details</h2>
                <dl className="space-y-4 text-sm">
                  {data.propertyAddress && (
                    <div className="flex gap-3">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                      <div><dt className="text-forest/45">Location</dt><dd className="text-forest">{data.propertyAddress}</dd></div>
                    </div>
                  )}
                  {data.startDate && (
                    <div className="flex gap-3">
                      <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                      <div><dt className="text-forest/45">Started</dt><dd className="text-forest">{data.startDate}</dd></div>
                    </div>
                  )}
                  {data.endDate && (
                    <div className="flex gap-3">
                      <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                      <div><dt className="text-forest/45">Expected Completion</dt><dd className="text-forest">{data.endDate}</dd></div>
                    </div>
                  )}
                </dl>
                {data.customerNotes && (
                  <div className="mt-5 border-t border-forest/10 pt-4">
                    <dt className="text-xs uppercase tracking-wide text-forest/45">Notes</dt>
                    <dd className="mt-1 text-sm text-forest/70">{data.customerNotes}</dd>
                  </div>
                )}
              </Card>
            </div>
          </>
        )}
      </AsyncSection>
    </div>
  )
}

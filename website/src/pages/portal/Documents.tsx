import { FileArchive, Download, ExternalLink } from 'lucide-react'
import { portalApi } from '@/api/portalApi'
import { useFetch } from '@/hooks/useFetch'
import { AsyncSection, Card } from '@/components/portal/PortalUI'

interface Doc {
  id: number
  fileName: string
  fileUrl: string
  fileType: string
  uploadedAt: string
}

export default function PortalDocuments() {
  const { data, loading, error, reload } = useFetch<Doc[]>(() => portalApi.documents())

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-forest">Documents</h1>
        <p className="mt-1 text-forest/55">Quotations, invoices, agreements, and warranties — all in one place.</p>
      </div>

      <AsyncSection loading={loading} error={error} onRetry={reload}
        empty={!!data && data.length === 0} emptyMessage="No documents yet.">
        <Card className="divide-y divide-forest/5 p-0">
          {data?.map((d) => (
            <div key={d.id} className="flex items-center gap-3 px-5 py-4">
              <span className="flex h-10 w-10 items-center justify-center rounded bg-gold/10 text-gold-dark">
                <FileArchive className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-forest">{d.fileName}</div>
                <div className="text-xs text-forest/45">{d.fileType}{d.uploadedAt ? ` · ${String(d.uploadedAt).slice(0, 10)}` : ''}</div>
              </div>
              <div className="flex items-center gap-2">
                <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" aria-label="View" className="flex h-9 w-9 items-center justify-center border border-forest/15 text-forest hover:border-gold hover:text-gold">
                  <ExternalLink className="h-4 w-4" />
                </a>
                <a href={d.fileUrl} download aria-label="Download" className="flex h-9 w-9 items-center justify-center border border-forest/15 text-forest hover:border-gold hover:text-gold">
                  <Download className="h-4 w-4" />
                </a>
              </div>
            </div>
          ))}
        </Card>
      </AsyncSection>
    </div>
  )
}

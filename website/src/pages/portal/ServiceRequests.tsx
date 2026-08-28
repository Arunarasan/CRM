import { useState, type FormEvent } from 'react'
import { Plus, X } from 'lucide-react'
import { portalApi } from '@/api/portalApi'
import { useFetch } from '@/hooks/useFetch'
import { AsyncSection, Card, StatusBadge } from '@/components/portal/PortalUI'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select } from '@/components/ui/Form'
import { toast } from '@/store/toast'

interface Request {
  id: number
  subject: string
  issueType: string
  priority: string
  status: string
  createdAt: string
}

export default function PortalServiceRequests() {
  const { data, loading, error, reload } = useFetch<Request[]>(() => portalApi.serviceRequests())
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setSubmitting(true)
    try {
      await portalApi.createServiceRequest({
        subject: form.get('subject'),
        issueType: form.get('issueType'),
        priority: form.get('priority'),
        description: form.get('description'),
        preferredDate: form.get('preferredDate'),
      })
      toast('Service request submitted')
      setOpen(false)
      reload()
    } catch {
      toast('Could not submit your request', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-forest">Service Requests</h1>
          <p className="mt-1 text-forest/55">Raise an issue and our team will take it from there.</p>
        </div>
        <Button onClick={() => setOpen((v) => !v)} variant="primary">
          {open ? <><X className="h-4 w-4" /> Cancel</> : <><Plus className="h-4 w-4" /> New Request</>}
        </Button>
      </div>

      {open && (
        <Card>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <Input label="Subject" name="subject" required placeholder="Brief summary" className="sm:col-span-2" />
            <Select label="Issue Type" name="issueType" defaultValue="General">
              <option>General</option><option>Furniture</option><option>Lighting</option>
              <option>Installation</option><option>Electrical</option><option>Finishing</option>
            </Select>
            <Select label="Priority" name="priority" defaultValue="MEDIUM">
              <option value="LOW">Low</option><option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option><option value="URGENT">Urgent</option>
            </Select>
            <Textarea label="Description" name="description" required placeholder="Describe the issue…" className="sm:col-span-2" />
            <Input label="Preferred Date" name="preferredDate" type="date" />
            <div className="flex items-end sm:col-span-2">
              <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
                {submitting ? 'Submitting…' : 'Submit Request'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <AsyncSection loading={loading} error={error} onRetry={reload}
        empty={!!data && data.length === 0} emptyMessage="No active service requests.">
        <Card className="divide-y divide-forest/5 p-0">
          {data?.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div>
                <div className="font-medium text-forest">{r.subject}</div>
                <div className="text-xs text-forest/45">
                  {r.issueType}{r.createdAt ? ` · ${String(r.createdAt).slice(0, 10)}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={r.priority} />
                <StatusBadge status={r.status} />
              </div>
            </div>
          ))}
        </Card>
      </AsyncSection>
    </div>
  )
}

import { useEffect, useState, type FormEvent } from 'react'
import { portalApi } from '@/api/portalApi'
import { useFetch } from '@/hooks/useFetch'
import { AsyncSection, Card, Skeleton } from '@/components/portal/PortalUI'
import { Input } from '@/components/ui/Form'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/lib/auth'
import { toast } from '@/store/toast'

interface Profile {
  name: string
  email: string
  phone: string
  whatsappNumber: string
  city: string
  state: string
  companyName: string
  customerCode: string
  billingAddress: string
}

export default function PortalProfile() {
  const { data, loading, error, reload } = useFetch<Profile>(() => portalApi.profile())
  const [form, setForm] = useState<Partial<Profile>>({})
  const [saving, setSaving] = useState(false)
  const user = useAuth((s) => s.user)

  useEffect(() => { if (data) setForm(data) }, [data])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await portalApi.updateProfile({
        name: form.name ?? '',
        phone: form.phone ?? '',
        whatsappNumber: form.whatsappNumber ?? '',
        email: form.email ?? '',
      })
      toast('Profile updated')
      reload()
    } catch {
      toast('Could not update profile', 'error')
    } finally {
      setSaving(false)
    }
  }

  const set = (k: keyof Profile) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-forest">My Profile</h1>
        <p className="mt-1 text-forest/55">Manage your contact details.</p>
      </div>

      <AsyncSection loading={loading} error={error} onRetry={reload}
        skeleton={<Skeleton className="h-80" />}>
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          {/* Summary */}
          <Card className="h-max text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-forest text-2xl font-semibold text-gold">
              {(data?.name || user?.name || 'U').charAt(0).toUpperCase()}
            </div>
            <h2 className="mt-4 font-serif text-xl font-semibold text-forest">{data?.name}</h2>
            <p className="text-sm text-forest/50">{data?.email}</p>
            {data?.customerCode && <p className="mt-2 text-xs uppercase tracking-wide text-forest/40">Client #{data.customerCode}</p>}
            {data?.companyName && <p className="mt-1 text-sm text-forest/60">{data.companyName}</p>}
          </Card>

          {/* Editable form */}
          <Card>
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              <Input label="Name" value={form.name ?? ''} onChange={set('name')} required />
              <Input label="Phone" value={form.phone ?? ''} onChange={set('phone')} />
              <Input label="Email" type="email" value={form.email ?? ''} onChange={set('email')} />
              <Input label="WhatsApp" value={form.whatsappNumber ?? ''} onChange={set('whatsappNumber')} />
              <Input label="City" value={form.city ?? ''} onChange={set('city')} disabled />
              <Input label="State" value={form.state ?? ''} onChange={set('state')} disabled />
              <div className="sm:col-span-2">
                <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Button>
                <p className="mt-2 text-xs text-forest/40">Some fields are managed by JB Decor and can't be edited here.</p>
              </div>
            </form>
          </Card>
        </div>
      </AsyncSection>
    </div>
  )
}

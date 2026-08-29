import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react'
import { Logo } from '@/components/layout/Logo'
import { SmartImage } from '@/components/ui/SmartImage'
import { images } from '@/config/images'
import { site } from '@/config/site'
import { authApi } from '@/api/authApi'
import { useAuth } from '@/lib/auth'

export default function Login() {
  const setSession = useAuth((s) => s.setSession)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await authApi.login(email, password, remember)
      // The customer portal is retired — this sign-in is the staff door to the CRM. The CRM lives at
      // the same origin ("/crm") and reads the same localStorage session, so persisting it here logs
      // the user straight into the CRM with no second sign-in. Role checks are enforced by the CRM.
      setSession(res.token, res.refreshToken, { name: res.name, email: res.email, roles: res.roles })
      window.location.assign(site.crmUrl)
    } catch (err: any) {
      const data = err?.response?.data
      if (data?.requiresVerification) {
        setError('This account is not activated yet. Please contact an administrator.')
      } else {
        setError('Invalid email or password. Please try again.')
      }
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left — imagery */}
      <div className="relative hidden lg:block">
        <SmartImage src={images.hero.livingRoom} alt="A JB Decor luxury interior" className="h-full w-full" imgClassName="h-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-forest-deep/90 via-forest/40 to-transparent" />
        <div className="absolute bottom-0 left-0 p-12">
          <span className="eyebrow"><span className="rule-gold" />Crafting Spaces. Defining Luxury.</span>
          <h2 className="mt-4 max-w-md font-serif text-4xl font-semibold leading-tight text-ivory">
            Welcome back to your <span className="text-gold">private studio.</span>
          </h2>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex flex-col justify-center bg-forest px-6 py-10 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <Logo />
          <h1 className="mt-10 font-serif text-3xl font-semibold text-ivory">Team Sign in</h1>
          <p className="mt-2 text-sm text-ivory/60">Sign in to the {site.name} CRM.</p>

          {error && (
            <div className="mt-6 flex items-center gap-2 border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ivory/60">Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ivory/40" />
                <input
                  id="email" type="email" required autoComplete="email" value={email}
                  onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com"
                  className="w-full border border-ivory/20 bg-forest-light/40 py-3 pl-10 pr-4 text-sm text-ivory placeholder:text-ivory/30 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ivory/60">Password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ivory/40" />
                <input
                  id="password" type={showPw ? 'text' : 'password'} required autoComplete="current-password" value={password}
                  onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                  className="w-full border border-ivory/20 bg-forest-light/40 py-3 pl-10 pr-10 text-sm text-ivory placeholder:text-ivory/30 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                />
                <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ivory/40 hover:text-ivory">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex cursor-pointer items-center gap-2 text-ivory/70">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-gold" />
                Remember me
              </label>
              <Link to="/forgot-password" className="text-gold hover:text-gold-dark">Forgot password?</Link>
            </div>

            <button
              type="submit" disabled={loading}
              className="flex w-full items-center justify-center gap-2 bg-gold py-3.5 text-sm font-semibold uppercase tracking-wide text-forest transition-colors hover:bg-gold-dark disabled:opacity-60"
            >
              {loading ? 'Signing in…' : <>Sign In <ArrowRight className="h-4 w-4" /></>}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-ivory/50">
            A customer looking for your project?{' '}
            <Link to="/consultation" className="text-gold hover:text-gold-dark">Get in touch</Link>{' '}
            for your private tracking link.
          </p>
        </div>
      </div>
    </div>
  )
}

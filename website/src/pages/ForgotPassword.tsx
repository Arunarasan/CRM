import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { Logo } from '@/components/layout/Logo'
import { authApi } from '@/api/authApi'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await authApi.forgotPassword(email)
    } catch {
      // Backend returns a generic success regardless; never reveal whether the email exists.
    } finally {
      setLoading(false)
      setSent(true)
    }
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-forest px-6 py-10">
      <div className="mx-auto w-full max-w-sm">
        <Logo />
        {sent ? (
          <div className="mt-10 text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-gold" />
            <h1 className="mt-5 font-serif text-2xl font-semibold text-ivory">Check your email</h1>
            <p className="mt-2 text-sm text-ivory/60">
              If an account exists for that email, we've sent a verification code to reset your password.
            </p>
            <Link to="/login" className="mt-8 inline-flex items-center gap-2 text-sm text-gold hover:text-gold-dark">
              <ArrowLeft className="h-4 w-4" /> Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <h1 className="mt-10 font-serif text-3xl font-semibold text-ivory">Reset password</h1>
            <p className="mt-2 text-sm text-ivory/60">Enter your email and we'll send you a reset code.</p>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ivory/40" />
                <input
                  type="email" required autoComplete="email" value={email}
                  onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com"
                  className="w-full border border-ivory/20 bg-forest-light/40 py-3 pl-10 pr-4 text-sm text-ivory placeholder:text-ivory/30 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-gold py-3.5 text-sm font-semibold uppercase tracking-wide text-forest transition-colors hover:bg-gold-dark disabled:opacity-60">
                {loading ? 'Sending…' : 'Send Reset Code'}
              </button>
            </form>
            <Link to="/login" className="mt-6 inline-flex items-center gap-2 text-sm text-ivory/60 hover:text-gold">
              <ArrowLeft className="h-4 w-4" /> Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

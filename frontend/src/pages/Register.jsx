import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, ArrowRight, LoaderCircle } from 'lucide-react'

import { useAuth } from '../contexts/AuthContext'

const Register = () => {
  const [formData, setFormData] = useState({
    username: '', email: '', password: '', password2: '',
    first_name: '', last_name: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { register, isAuthenticated, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/dashboard'

  if (isAuthenticated) return <Navigate to="/dashboard" replace />

  if (authLoading) {
    return (
      <div className="theme-app-gradient flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="theme-panel flex items-center gap-3 rounded-2xl px-5 py-4">
          <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm font-medium text-muted-foreground">Loading…</span>
        </div>
      </div>
    )
  }

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    if (formData.password !== formData.password2) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }
    const result = await register(formData)
    if (result.success) navigate(redirectTo)
    else setError(result.error)
    setLoading(false)
  }

  return (
    <div className="theme-app-gradient relative flex h-[calc(100vh-4rem)] items-center overflow-hidden px-4 py-6 sm:px-6">
      {/* Decorative patterns — light theme */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Primary blue glow top-left */}
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[rgb(var(--theme-primary-rgb)/0.12)] blur-[80px]" />
        {/* Accent orange glow bottom-right */}
        <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-[rgb(var(--theme-accent-rgb)/0.10)] blur-[80px]" />
        {/* Secondary teal glow bottom-left */}
        <div className="absolute -bottom-16 left-1/4 h-48 w-48 rounded-full bg-[rgb(var(--theme-secondary-rgb)/0.08)] blur-[70px]" />

        {/* Dot grid — top right */}
        <svg className="absolute right-12 top-10 opacity-40" width="130" height="70" viewBox="0 0 130 70">
          {Array.from({ length: 5 }).map((_, row) =>
            Array.from({ length: 9 }).map((_, col) => (
              <circle
                key={`${row}-${col}`}
                cx={col * 15 + 4} cy={row * 14 + 4} r="1.8"
                fill="rgb(37 99 235 / 0.35)"
              />
            ))
          )}
        </svg>

        {/* Dot grid — bottom left */}
        <svg className="absolute bottom-10 left-10 opacity-30" width="100" height="60" viewBox="0 0 100 60">
          {Array.from({ length: 4 }).map((_, row) =>
            Array.from({ length: 7 }).map((_, col) => (
              <circle
                key={`b${row}-${col}`}
                cx={col * 15 + 4} cy={row * 14 + 4} r="1.8"
                fill="rgb(15 118 110 / 0.3)"
              />
            ))
          )}
        </svg>

        {/* Geometric corner accent top-right */}
        <svg className="absolute right-6 top-6 opacity-20" width="52" height="52" viewBox="0 0 52 52">
          <rect x="10" y="0" width="16" height="16" rx="3" stroke="rgb(37 99 235)" fill="none" strokeWidth="1.5" />
          <rect x="24" y="14" width="16" height="16" rx="3" stroke="rgb(37 99 235)" fill="none" strokeWidth="1.5" />
          <rect x="32" y="28" width="12" height="12" rx="2" stroke="rgb(15 118 110)" fill="none" strokeWidth="1" />
        </svg>

        {/* Vertical bars — bottom right */}
        <div className="absolute bottom-8 right-16 flex items-end gap-1.5 opacity-20">
          {[28, 40, 22, 36, 18, 44, 30].map((h, i) => (
            <div
              key={i}
              className="w-1.5 rounded-full bg-primary"
              style={{ height: `${h}px` }}
            />
          ))}
        </div>

        {/* Thin diagonal lines */}
        <svg className="absolute inset-0 h-full w-full opacity-[0.04]" preserveAspectRatio="none">
          <line x1="0" y1="60%" x2="100%" y2="20%" stroke="rgb(37 99 235)" strokeWidth="1.5" />
          <line x1="0" y1="80%" x2="100%" y2="40%" stroke="rgb(15 118 110)" strokeWidth="1" />
        </svg>
      </div>

      {/* Layout */}
      <div className="relative z-10 mx-auto flex w-full max-w-5xl items-stretch gap-4 lg:gap-6">

        {/* ── Left panel: branding image ── */}
        <div className="hidden flex-1 lg:flex lg:flex-col">
          <div
            className="relative flex-1 overflow-hidden rounded-3xl border border-[rgb(var(--theme-border-rgb)/0.7)] bg-[rgb(var(--theme-primary-soft-rgb)/0.6)] shadow-[0_28px_70px_rgb(var(--theme-shadow-rgb)/0.12)] backdrop-blur-sm"
            style={{ minHeight: 'calc(100vh - 8rem)' }}
          >
            <img
              src="/branding/registerpage.webp"
              alt="Register visual"
              className="h-full w-full object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
            {/* Overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-[rgb(var(--theme-primary-ink-rgb)/0.45)] via-transparent to-transparent" />
          </div>
        </div>

        {/* ── Right panel: glass form ── */}
        <div className="flex w-full flex-shrink-0 flex-col lg:w-[360px]">
          {/* Mobile logo */}
          <div className="mb-5 lg:hidden">
            <img src="/branding/logo.svg" alt="Logo" className="h-8 w-auto" />
          </div>

          <div className="theme-panel flex flex-1 flex-col justify-center rounded-3xl p-6 sm:p-8">
            <h1 className="text-2xl font-bold tracking-tight text-[rgb(var(--theme-primary-ink-rgb))]">
              Create account
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Already have one?{' '}
              <Link to="/login" className="font-semibold text-primary transition hover:text-primary/80">
                Sign in
              </Link>
            </p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-3">
              {error && (
                <div className="flex items-center gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              {[
                { name: 'username', label: 'Username', type: 'text', autoComplete: 'username', placeholder: 'Choose a username', required: true },
                { name: 'email', label: 'Email', type: 'email', autoComplete: 'email', placeholder: 'you@example.com', required: true },
                { name: 'first_name', label: 'First Name', type: 'text', autoComplete: 'given-name', placeholder: 'John', required: false },
                { name: 'last_name', label: 'Last Name', type: 'text', autoComplete: 'family-name', placeholder: 'Doe', required: false },
                { name: 'password', label: 'Password', type: 'password', autoComplete: 'new-password', placeholder: 'Create a password', required: true },
                { name: 'password2', label: 'Confirm Password', type: 'password', autoComplete: 'new-password', placeholder: 'Repeat your password', required: true },
              ].map((field) => (
                <div key={field.name} className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {field.label}
                  </label>
                  <input
                    name={field.name}
                    type={field.type}
                    autoComplete={field.autoComplete}
                    placeholder={field.placeholder}
                    value={formData[field.name]}
                    onChange={handleChange}
                    required={field.required}
                    className="h-10 w-full rounded-xl border border-[rgb(var(--theme-border-rgb))] bg-white/80 px-4 text-sm text-foreground placeholder-muted-foreground outline-none backdrop-blur-sm transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              ))}

              <button
                type="submit"
                disabled={loading}
                className="mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-[0_4px_16px_rgb(var(--theme-primary-rgb)/0.3)] transition hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? (
                  <><LoaderCircle className="h-4 w-4 animate-spin" /> Creating account…</>
                ) : (
                  <>Create account <ArrowRight className="h-4 w-4" /></>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Register

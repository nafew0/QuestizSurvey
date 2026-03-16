import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, ArrowRight, LoaderCircle } from 'lucide-react'

import { useAuth } from '../contexts/AuthContext'

const Login = () => {
  const [formData, setFormData] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { login, isAuthenticated, loading: authLoading } = useAuth()
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
    const result = await login(formData.username, formData.password)
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
                fill={`rgb(var(--theme-primary-rgb)/0.35)`}
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
                fill={`rgb(var(--theme-secondary-rgb)/0.3)`}
              />
            ))
          )}
        </svg>

        {/* Geometric corner accent top-right */}
        <svg className="absolute right-6 top-6 opacity-20" width="52" height="52" viewBox="0 0 52 52">
          <rect x="10" y="0" width="16" height="16" rx="3" stroke="rgb(var(--theme-primary-rgb))" fill="none" strokeWidth="1.5" />
          <rect x="24" y="14" width="16" height="16" rx="3" stroke="rgb(var(--theme-primary-rgb))" fill="none" strokeWidth="1.5" />
          <rect x="32" y="28" width="12" height="12" rx="2" stroke="rgb(var(--theme-secondary-rgb))" fill="none" strokeWidth="1" />
        </svg>

        {/* Vertical bars — bottom right */}
        <div className="absolute bottom-8 right-16 flex items-end gap-1.5 opacity-20">
          {[28, 40, 22, 36, 18, 44, 30].map((h, i) => (
            <div
              key={i}
              className="w-1.5 rounded-full bg-[rgb(var(--theme-primary-rgb))]"
              style={{ height: `${h}px` }}
            />
          ))}
        </div>

        {/* Thin diagonal lines */}
        <svg className="absolute inset-0 h-full w-full opacity-[0.04]" preserveAspectRatio="none">
          <line x1="0" y1="60%" x2="100%" y2="20%" stroke="rgb(var(--theme-primary-rgb))" strokeWidth="1.5" />
          <line x1="0" y1="80%" x2="100%" y2="40%" stroke="rgb(var(--theme-secondary-rgb))" strokeWidth="1" />
        </svg>
      </div>

      {/* Layout */}
      <div className="relative z-10 mx-auto flex w-full max-w-5xl items-stretch gap-4 lg:gap-6">

        {/* ── Left panel: branding image ── */}
        <div className="hidden flex-1 lg:flex lg:flex-col">
          {/* Image card */}
          <div className="relative flex-1 overflow-hidden rounded-3xl border border-[rgb(var(--theme-border-rgb)/0.7)] bg-[rgb(var(--theme-primary-soft-rgb)/0.6)] shadow-[0_28px_70px_rgb(var(--theme-shadow-rgb)/0.12)] backdrop-blur-sm"
            style={{ minHeight: 'calc(100vh - 8rem)' }}
          >
            <img
              src="/branding/loginpage.webp"
              alt="Login visual"
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
          <div className="mb-6 lg:hidden">
            <img src="/branding/logo.svg" alt="Logo" className="h-8 w-auto" />
          </div>

          <div className="theme-panel flex flex-1 flex-col justify-center rounded-3xl p-7 sm:p-9">
            <h1 className="text-2xl font-bold tracking-tight text-[rgb(var(--theme-primary-ink-rgb))]">
              Sign in
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter your credentials to continue
            </p>

            <form onSubmit={handleSubmit} className="mt-7 space-y-5">
              {error && (
                <div className="flex items-center gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Username or Email
                </label>
                <input
                  name="username"
                  type="text"
                  autoComplete="username"
                  placeholder="name@example.com"
                  value={formData.username}
                  onChange={handleChange}
                  required
                  className="h-11 w-full rounded-xl border border-[rgb(var(--theme-border-rgb))] bg-white/80 px-4 text-sm text-foreground placeholder-muted-foreground outline-none backdrop-blur-sm transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Password
                </label>
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="h-11 w-full rounded-xl border border-[rgb(var(--theme-border-rgb))] bg-white/80 px-4 text-sm text-foreground placeholder-muted-foreground outline-none backdrop-blur-sm transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-[0_4px_16px_rgb(var(--theme-primary-rgb)/0.3)] transition hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? (
                  <><LoaderCircle className="h-4 w-4 animate-spin" /> Signing in…</>
                ) : (
                  <>Sign in <ArrowRight className="h-4 w-4" /></>
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{' '}
              <Link to="/register" className="font-semibold text-primary transition hover:text-primary/80">
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login

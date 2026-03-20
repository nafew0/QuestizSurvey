import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, ArrowRight, LoaderCircle, MailCheck } from 'lucide-react'

import BrandLogo from '@/components/branding/BrandLogo'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
import { getSafeRedirect } from '@/utils/redirects'

const Login = () => {
  const [formData, setFormData] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [verificationState, setVerificationState] = useState(null)
  const [resending, setResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  const { login, resendVerificationEmail, isAuthenticated, loading: authLoading } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectTo = getSafeRedirect(searchParams.get('redirect'))

  useEffect(() => {
    if (resendCooldown <= 0) {
      return undefined
    }

    const timerId = window.setInterval(() => {
      setResendCooldown((current) => (current > 1 ? current - 1 : 0))
    }, 1000)

    return () => window.clearInterval(timerId)
  }, [resendCooldown])

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
    if (verificationState && e.target.name === 'username') {
      setVerificationState((current) => ({
        ...current,
        identifier: e.target.value,
      }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await login(formData.username, formData.password)
    if (result.success) {
      setVerificationState(null)
      navigate(redirectTo)
    } else if (result.emailVerificationRequired) {
      setVerificationState({
        emailHint: result.emailHint,
        identifier: formData.username.trim(),
      })
      setError('')
    } else {
      setError(result.error)
    }
    setLoading(false)
  }

  const handleResendVerification = async () => {
    const identifier = verificationState?.identifier?.trim() || formData.username.trim()
    if (!identifier || resending || resendCooldown > 0) {
      return
    }

    setResending(true)
    const result = await resendVerificationEmail(identifier)

    if (result.success) {
      setResendCooldown(120)
      toast({
        title: 'Verification email requested',
        description: result.message,
        variant: 'success',
        duration: 4200,
      })
    } else {
      toast({
        title: 'Could not resend email',
        description: result.error,
        variant: 'error',
        duration: 4500,
      })
    }

    setResending(false)
  }

  return (
    <div className="theme-app-gradient flex min-h-[calc(100vh-4rem)] items-center px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-6xl">
        <div className="theme-panel overflow-hidden rounded-[2.2rem]">
          <div className="grid lg:grid-cols-[1.08fr_0.92fr]">
            <section className="relative hidden min-h-[38rem] overflow-hidden border-b border-[rgb(var(--theme-border-rgb)/0.88)] bg-[rgb(var(--theme-muted-rgb)/0.82)] lg:flex lg:border-b-0 lg:border-r">
              <img
                src="/branding/loginpage.webp"
                alt="Login visual"
                className="absolute inset-0 h-full w-full object-cover"
                onError={(event) => {
                  event.currentTarget.style.display = 'none'
                }}
              />
              <div className="absolute inset-0 bg-[rgb(var(--theme-primary-ink-rgb)/0.38)]" />
            </section>

            <section className="bg-white px-6 py-7 sm:px-8 sm:py-8 lg:px-10">
              <div className="mx-auto flex max-w-md flex-col justify-center">
                <div className="mb-6 lg:hidden">
                  <BrandLogo />
                </div>

                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Account Access
                </p>
                <h1 className="mt-3 text-2xl font-bold tracking-tight text-[rgb(var(--theme-primary-ink-rgb))]">
                  Sign in
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Enter your credentials to continue.
                </p>

                <form onSubmit={handleSubmit} className="mt-7 space-y-5">
                  {verificationState ? (
                    <div className="rounded-2xl border border-[rgb(var(--theme-secondary-strong-rgb)/0.9)] bg-[rgb(var(--theme-secondary-soft-rgb)/0.68)] p-4 text-sm text-[rgb(var(--theme-secondary-ink-rgb))]">
                      <div className="flex items-start gap-3">
                        <span className="theme-icon-secondary inline-flex h-10 w-10 items-center justify-center rounded-full">
                          <MailCheck className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">Please verify your email first</p>
                          <p className="mt-1 opacity-80">
                            We blocked sign in because this account is not verified yet.
                            {verificationState.emailHint
                              ? ` Verification email sent to ${verificationState.emailHint}.`
                              : ''}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-3">
                            <Button
                              type="button"
                              variant="secondary"
                              className="rounded-full"
                              onClick={handleResendVerification}
                              disabled={resending || resendCooldown > 0}
                            >
                              {resending
                                ? 'Resending...'
                                : resendCooldown > 0
                                  ? `Resend in ${resendCooldown}s`
                                  : 'Resend verification email'}
                            </Button>
                            <Link
                              to="/verify-email"
                              className="self-center text-sm font-semibold text-primary hover:text-primary/80"
                            >
                              Open verification page
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

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
                      className="h-11 w-full rounded-xl border border-[rgb(var(--theme-border-rgb))] bg-white px-4 text-sm text-foreground placeholder-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
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
                      className="h-11 w-full rounded-xl border border-[rgb(var(--theme-border-rgb))] bg-white px-4 text-sm text-foreground placeholder-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                    <div className="pt-1 text-right">
                      <Link
                        to="/forgot-password"
                        className="text-xs font-semibold text-primary transition hover:text-primary/80"
                      >
                        Forgot password?
                      </Link>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-[0_4px_16px_rgb(var(--theme-primary-rgb)/0.3)] transition hover:bg-primary/90 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                        Signing in…
                      </>
                    ) : (
                      <>
                        Sign in
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </form>

                <p className="mt-6 text-center text-sm text-muted-foreground">
                  Don&apos;t have an account?{' '}
                  <Link
                    to="/register"
                    className="font-semibold text-primary transition hover:text-primary/80"
                  >
                    Create one
                  </Link>
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login

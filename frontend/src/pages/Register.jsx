import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, ArrowRight, LoaderCircle, MailCheck } from 'lucide-react'

import BrandLogo from '@/components/branding/BrandLogo'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/useToast'
import { getSafeRedirect } from '@/utils/redirects'

const Register = () => {
  const [formData, setFormData] = useState({
    username: '', email: '', password: '', password2: '',
    first_name: '', last_name: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [verificationState, setVerificationState] = useState(null)
  const [resending, setResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  const { register, resendVerificationEmail, isAuthenticated, loading: authLoading } = useAuth()
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
    if (result.success) {
      if (result.emailVerificationRequired) {
        setVerificationState({
          emailHint: result.emailHint,
          identifier: formData.email.trim(),
        })
        setResendCooldown(120)
      } else {
        navigate(redirectTo)
      }
    } else {
      setError(result.error)
    }
    setLoading(false)
  }

  const handleResendVerification = async () => {
    const identifier = verificationState?.identifier?.trim()
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
          <div className="grid lg:grid-cols-[1.04fr_0.96fr]">
            <section className="relative hidden min-h-[42rem] overflow-hidden border-b border-[rgb(var(--theme-border-rgb)/0.88)] bg-[rgb(var(--theme-muted-rgb)/0.82)] lg:flex lg:border-b-0 lg:border-r">
              <img
                src="/branding/registerpage.webp"
                alt="Register visual"
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

                {verificationState ? (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                      Email Verification
                    </p>
                    <div className="mt-5 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[rgb(var(--theme-secondary-soft-rgb))] text-[rgb(var(--theme-secondary-rgb))]">
                      <MailCheck className="h-5 w-5" />
                    </div>
                    <h1 className="mt-5 text-2xl font-bold tracking-tight text-[rgb(var(--theme-primary-ink-rgb))]">
                      Check your email
                    </h1>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Your account is ready, but you need to verify your email before
                      signing in.
                      {verificationState.emailHint
                        ? ` We sent the first link to ${verificationState.emailHint}.`
                        : ''}
                    </p>
                    <div className="mt-6 space-y-3">
                      <Button
                        type="button"
                        className="w-full rounded-xl"
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
                        to="/login"
                        className="flex h-11 w-full items-center justify-center rounded-xl border border-[rgb(var(--theme-border-rgb))] bg-white text-sm font-semibold text-foreground transition hover:bg-[rgb(var(--theme-muted-rgb)/0.55)]"
                      >
                        Back to sign in
                      </Link>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                      New Account
                    </p>
                    <h1 className="mt-3 text-2xl font-bold tracking-tight text-[rgb(var(--theme-primary-ink-rgb))]">
                      Create account
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Already have one?{' '}
                      <Link
                        to="/login"
                        className="font-semibold text-primary transition hover:text-primary/80"
                      >
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
                        {
                          name: 'username',
                          label: 'Username',
                          type: 'text',
                          autoComplete: 'username',
                          placeholder: 'Choose a username',
                          required: true,
                        },
                        {
                          name: 'email',
                          label: 'Email',
                          type: 'email',
                          autoComplete: 'email',
                          placeholder: 'you@example.com',
                          required: true,
                        },
                        {
                          name: 'first_name',
                          label: 'First Name',
                          type: 'text',
                          autoComplete: 'given-name',
                          placeholder: 'John',
                          required: false,
                        },
                        {
                          name: 'last_name',
                          label: 'Last Name',
                          type: 'text',
                          autoComplete: 'family-name',
                          placeholder: 'Doe',
                          required: false,
                        },
                        {
                          name: 'password',
                          label: 'Password',
                          type: 'password',
                          autoComplete: 'new-password',
                          placeholder: 'Create a password',
                          required: true,
                        },
                        {
                          name: 'password2',
                          label: 'Confirm Password',
                          type: 'password',
                          autoComplete: 'new-password',
                          placeholder: 'Repeat your password',
                          required: true,
                        },
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
                            className="h-10 w-full rounded-xl border border-[rgb(var(--theme-border-rgb))] bg-white px-4 text-sm text-foreground placeholder-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                          />
                        </div>
                      ))}

                      <button
                        type="submit"
                        disabled={loading}
                        className="mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-[0_4px_16px_rgb(var(--theme-primary-rgb)/0.3)] transition hover:bg-primary/90 disabled:opacity-50"
                      >
                        {loading ? (
                          <>
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                            Creating account…
                          </>
                        ) : (
                          <>
                            Create account
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </button>
                    </form>
                  </>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Register

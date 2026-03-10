import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowRight, LoaderCircle, Sparkles } from "lucide-react"

import AuthShell from '@/components/auth/AuthShell'
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from '../contexts/AuthContext'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    password2: '',
    first_name: '',
    last_name: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { register, isAuthenticated, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  if (authLoading) {
    return (
      <div className="theme-app-gradient flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
        <div className="theme-panel flex items-center gap-3 rounded-[2rem] px-5 py-4">
          <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm font-medium text-muted-foreground">Preparing registration</span>
        </div>
      </div>
    )
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Validate passwords match
    if (formData.password !== formData.password2) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    const result = await register(formData)

    if (result.success) {
      navigate('/dashboard')
    } else {
      setError(result.error)
    }

    setLoading(false)
  }

  return (
    <AuthShell
      eyebrow="Create workspace"
      title="Launch your Questiz account"
      description="Create an account to build surveys, manage collectors, theme each experience, and export stakeholder-ready reports."
      imageSrc="/branding/registerpage.webp"
      imageAlt="Questiz registration showcase"
      showcaseTitle="Set up the account that holds your surveys, brand settings, and delivery workflow."
      showcaseDescription="If you want a custom visual here, add frontend/public/branding/registerpage.webp. The layout already handles the fallback state cleanly."
      metrics={[
        { value: 'Pages', label: 'Flow-based survey design' },
        { value: 'Analytics', label: 'Summaries and crosstabs' },
        { value: 'Exports', label: 'PDF, XLSX, PPTX' },
      ]}
      highlights={[
        'Optional page media file: frontend/public/branding/registerpage.webp',
        'Registration routes directly into the authenticated dashboard after success.',
        'The page is designed to feel like product onboarding rather than a plain form card.',
      ]}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[rgb(var(--theme-accent-rgb))]" />
            Built for branded survey operations
          </div>
          <div>
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-primary transition hover:text-primary/80">
              Sign in
            </Link>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="rounded-[1.75rem] border border-[rgb(var(--theme-border-rgb)/0.78)] bg-[rgb(var(--theme-neutral-rgb)/0.74)] p-4">
          <p className="text-sm leading-7 text-[rgb(var(--theme-secondary-ink-rgb))]">
            Start with the account details below. You&apos;ll land in the dashboard immediately after registration succeeds.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <Alert variant="destructive" className="rounded-2xl">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="username" className="text-sm font-semibold text-foreground">
              Username
            </Label>
            <Input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              placeholder="Choose a username"
              value={formData.username}
              onChange={handleChange}
              required
              className="h-12 rounded-2xl border-[rgb(var(--theme-border-rgb)/0.86)] bg-white"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-semibold text-foreground">
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              value={formData.email}
              onChange={handleChange}
              required
              className="h-12 rounded-2xl border-[rgb(var(--theme-border-rgb)/0.86)] bg-white"
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="first_name" className="text-sm font-semibold text-foreground">
                First name
              </Label>
              <Input
                id="first_name"
                name="first_name"
                type="text"
                autoComplete="given-name"
                placeholder="John"
                value={formData.first_name}
                onChange={handleChange}
                className="h-12 rounded-2xl border-[rgb(var(--theme-border-rgb)/0.86)] bg-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name" className="text-sm font-semibold text-foreground">
                Last name
              </Label>
              <Input
                id="last_name"
                name="last_name"
                type="text"
                autoComplete="family-name"
                placeholder="Doe"
                value={formData.last_name}
                onChange={handleChange}
                className="h-12 rounded-2xl border-[rgb(var(--theme-border-rgb)/0.86)] bg-white"
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold text-foreground">
                Password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder="Create a password"
                value={formData.password}
                onChange={handleChange}
                required
                className="h-12 rounded-2xl border-[rgb(var(--theme-border-rgb)/0.86)] bg-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password2" className="text-sm font-semibold text-foreground">
                Confirm password
              </Label>
              <Input
                id="password2"
                name="password2"
                type="password"
                autoComplete="new-password"
                placeholder="Confirm your password"
                value={formData.password2}
                onChange={handleChange}
                required
                className="h-12 rounded-2xl border-[rgb(var(--theme-border-rgb)/0.86)] bg-white"
              />
            </div>
          </div>

          <p className="text-sm leading-7 text-muted-foreground">
            Password confirmation is checked before the registration request is submitted.
          </p>

          <Button type="submit" className="h-12 w-full rounded-2xl text-base" disabled={loading}>
            {loading ? (
              <>
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              <>
                Create account
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </form>
      </div>
    </AuthShell>
  )
}

export default Register

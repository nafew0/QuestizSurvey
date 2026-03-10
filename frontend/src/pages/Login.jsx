import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowRight, LoaderCircle, ShieldCheck } from "lucide-react"

import AuthShell from '@/components/auth/AuthShell'
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from '../contexts/AuthContext'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const Login = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { login, isAuthenticated, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  if (authLoading) {
    return (
      <div className="theme-app-gradient flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
        <div className="theme-panel flex items-center gap-3 rounded-[2rem] px-5 py-4">
          <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm font-medium text-muted-foreground">Loading account access</span>
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

    const result = await login(formData.username, formData.password)

    if (result.success) {
      navigate('/dashboard')
    } else {
      setError(result.error)
    }

    setLoading(false)
  }

  return (
    <AuthShell
      eyebrow="Secure sign-in"
      title="Welcome back to Questiz"
      description="Sign in to reopen your survey workspace, continue builder edits, and inspect the latest analytics."
      imageSrc="/branding/loginpage.webp"
      imageAlt="Questiz login showcase"
      showcaseTitle="Return to the workspace where survey creation, collection, and analysis stay connected."
      showcaseDescription="Use the optional image slot on this page if you want a branded visual. Until then, the interface falls back to a product-style preview."
      metrics={[
        { value: 'Builder', label: 'Create and edit' },
        { value: 'Collectors', label: 'Launch and manage' },
        { value: 'Reports', label: 'Share and export' },
      ]}
      highlights={[
        'Optional page media file: frontend/public/branding/loginpage.webp',
        'Account access stays connected to your existing survey ownership and authenticated dashboard routes.',
        'The form layout is mobile-safe and keeps the workspace context visible on larger screens.',
      ]}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[rgb(var(--theme-secondary-rgb))]" />
            JWT-backed account access
          </div>
          <div>
            Need an account?{' '}
            <Link to="/register" className="font-semibold text-primary transition hover:text-primary/80">
              Create one
            </Link>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="rounded-[1.75rem] border border-[rgb(var(--theme-border-rgb)/0.78)] bg-[rgb(var(--theme-neutral-rgb)/0.74)] p-4">
          <p className="text-sm leading-7 text-[rgb(var(--theme-secondary-ink-rgb))]">
            Use your username or email together with your password to jump straight back into the dashboard.
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
              Username or email
            </Label>
            <Input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              placeholder="name@example.com"
              value={formData.username}
              onChange={handleChange}
              required
              className="h-12 rounded-2xl border-[rgb(var(--theme-border-rgb)/0.86)] bg-white"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-semibold text-foreground">
              Password
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={formData.password}
              onChange={handleChange}
              required
              className="h-12 rounded-2xl border-[rgb(var(--theme-border-rgb)/0.86)] bg-white"
            />
          </div>

          <Button type="submit" className="h-12 w-full rounded-2xl text-base" disabled={loading}>
            {loading ? (
              <>
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                Sign in
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </form>
      </div>
    </AuthShell>
  )
}

export default Login

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, LoaderCircle } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/useToast'
import { getSubscription } from '@/services/subscriptions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const REDIRECT_DELAY_MS = 3500
const SYNC_ATTEMPTS = 5
const SYNC_INTERVAL_MS = 1200

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export default function PaymentSuccess() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isAuthenticated, refreshUser } = useAuth()
  const { toast } = useToast()
  const [syncing, setSyncing] = useState(true)
  const announcedRef = useRef(false)
  const provider = (searchParams.get('provider') || 'stripe').toLowerCase()

  useEffect(() => {
    let cancelled = false

    const syncSubscription = async () => {
      if (!isAuthenticated) {
        if (!cancelled) {
          setSyncing(false)
        }
        return
      }

      for (let attempt = 0; attempt < SYNC_ATTEMPTS && !cancelled; attempt += 1) {
        try {
          const subscription = await getSubscription()
          if (
            subscription?.payment_provider === 'stripe' &&
            subscription?.plan?.slug &&
            subscription.plan.slug !== 'free'
          ) {
            await refreshUser()
            if (!cancelled) {
              setSyncing(false)
            }
            if (!announcedRef.current) {
              announcedRef.current = true
              toast({
                title: 'Payment confirmed',
                description: 'Your Stripe subscription is now active.',
                variant: 'success',
              })
            }
            return
          }
        } catch (error) {
          console.error('Unable to confirm Stripe subscription yet:', error)
        }

        await delay(SYNC_INTERVAL_MS)
      }

      if (!cancelled) {
        setSyncing(false)
      }
    }

    syncSubscription()

    const redirectTimer = window.setTimeout(() => {
      navigate('/dashboard', { replace: true })
    }, REDIRECT_DELAY_MS)

    return () => {
      cancelled = true
      window.clearTimeout(redirectTimer)
    }
  }, [isAuthenticated, navigate, refreshUser, toast])

  const providerLabel = provider === 'stripe' ? 'Stripe' : provider

  return (
    <div className="theme-app-gradient flex min-h-[calc(100vh-4rem)] items-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <Card className="theme-panel rounded-[2.25rem] border-0">
          <CardHeader className="space-y-5 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[2rem] bg-emerald-100 text-emerald-700 shadow-[0_18px_40px_rgb(var(--theme-shadow-rgb)/0.12)]">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <div className="space-y-3">
              <div className="flex justify-center">
                <Badge variant="success">{providerLabel} payment</Badge>
              </div>
              <CardTitle className="text-4xl tracking-tight">
                Payment successful
              </CardTitle>
              <CardDescription className="mx-auto max-w-2xl text-base leading-8">
                Your billing request has been accepted. Questiz is syncing the Stripe subscription state and will return you to the dashboard automatically.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 text-center">
            <div className="theme-panel-soft rounded-[1.75rem] px-5 py-5">
              {syncing ? (
                <div className="flex flex-col items-center gap-3">
                  <LoaderCircle className="h-6 w-6 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">
                    Confirming your subscription with Stripe and refreshing your workspace access.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Redirecting you to the dashboard now. If the plan badge still looks stale, refresh once after the webhook finishes processing.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button asChild className="rounded-full">
                <Link to="/dashboard">Go to dashboard</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full">
                <Link to="/pricing">Back to pricing</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

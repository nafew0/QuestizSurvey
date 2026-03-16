import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { Link } from 'react-router-dom'

import PlanBadge from '@/components/subscription/PlanBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/useToast'
import { getPlans } from '@/services/subscriptions'
import { cn } from '@/lib/utils'

function formatLimit(value, label) {
  if (!value) {
    return `Unlimited ${label}`
  }

  return `${value.toLocaleString()} ${label}`
}

function formatPrice(amount, currency) {
  const numericAmount = Number(amount || 0)
  if (numericAmount === 0) {
    return 'Free'
  }

  if (currency === 'BDT') {
    return `৳${numericAmount.toLocaleString('en-BD', { maximumFractionDigits: 0 })}`
  }

  if (currency === 'USD') {
    return `$${numericAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  }

  return `${currency || 'USD'} ${numericAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function getCurrencyLabel(currency) {
  if (currency === 'BDT') {
    return 'BDT'
  }

  if (currency === 'USD') {
    return 'USD'
  }

  return currency || 'USD'
}

function getPricingDetails(plan, { yearlyBilling, isBangladeshiBilling }) {
  if (isBangladeshiBilling) {
    const monthlyAmount = Number(plan.bkash_price_monthly || 0)
    const yearlyAmount = Number(plan.bkash_price_yearly || 0)
    const activeAmount = yearlyBilling ? yearlyAmount : monthlyAmount

    return {
      amount: activeAmount,
      currency: 'BDT',
      providerLabel: 'bKash',
      savings:
        monthlyAmount > 0 && yearlyAmount > 0
          ? Math.max(0, monthlyAmount * 12 - yearlyAmount)
          : 0,
      missingPrice: plan.slug !== 'free' && activeAmount === 0,
    }
  }

  const monthlyAmount = Number(plan.price_monthly || 0)
  const yearlyAmount = Number(plan.price_yearly || 0)

  return {
    amount: yearlyBilling ? yearlyAmount : monthlyAmount,
    currency: 'USD',
    providerLabel: 'Stripe',
    savings:
      monthlyAmount > 0 && yearlyAmount > 0
        ? Math.max(0, monthlyAmount * 12 - yearlyAmount)
        : 0,
    missingPrice: false,
  }
}

export default function Pricing() {
  const { user, isAuthenticated } = useAuth()
  const { toast } = useToast()
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [yearlyBilling, setYearlyBilling] = useState(false)
  const [isBangladeshiBilling, setIsBangladeshiBilling] = useState(false)

  useEffect(() => {
    let cancelled = false

    const loadPlans = async () => {
      setLoading(true)
      setError('')

      try {
        const response = await getPlans()
        if (!cancelled) {
          setPlans(response)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.detail || 'Unable to load subscription plans right now.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadPlans()

    return () => {
      cancelled = true
    }
  }, [])

  const currentPlanSlug = user?.current_plan?.slug || 'free'

  const handleChangePlan = (plan) => {
    const providerLabel = isBangladeshiBilling ? 'bKash' : 'Stripe'
    const audienceLabel = isBangladeshiBilling
      ? 'Bangladeshi Nationals'
      : 'Non-Bangladeshi Nationals'

    toast({
      title: `${plan.name} plan selected`,
      description: `${providerLabel} pricing for ${audienceLabel} is selected. Online checkout and plan changes are enabled in the next billing phase. For now, keep testing with Django admin-managed plans.`,
      variant: 'warning',
      duration: 5000,
    })
  }

  return (
    <div className="theme-app-gradient min-h-[calc(100vh-4rem)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="theme-panel rounded-[2.25rem] px-6 py-8 md:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="default">Subscription plans</Badge>
                {isAuthenticated ? <PlanBadge plan={user?.current_plan} /> : null}
              </div>
              <div className="space-y-3">
                <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
                  Pick the plan that fits your survey volume
                </h1>
                <p className="max-w-3xl text-base leading-8 text-muted-foreground">
                  Licensing is enforced server-side for survey count, per-survey question count, and response caps. Plan values come from Django admin, including separate Stripe and bKash prices for different billing categories.
                </p>
              </div>
            </div>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="theme-panel-soft flex flex-col gap-3 rounded-[1.75rem] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Billing cycle</p>
              <p className="text-xs text-muted-foreground">
                Toggle between monthly and yearly pricing.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={cn('text-sm', !yearlyBilling ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                Monthly
              </span>
              <Switch checked={yearlyBilling} onCheckedChange={setYearlyBilling} />
              <span className={cn('text-sm', yearlyBilling ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                Yearly
              </span>
            </div>
          </div>

          <div className="theme-panel-soft flex flex-col gap-3 rounded-[1.75rem] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Billing category</p>
              <p className="text-xs text-muted-foreground">
                Stripe is shown in USD for non-Bangladeshi nationals. bKash is shown in BDT for Bangladeshi nationals.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={cn('text-sm', !isBangladeshiBilling ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                Non-Bangladeshi Nationals
              </span>
              <Switch checked={isBangladeshiBilling} onCheckedChange={setIsBangladeshiBilling} />
              <span className={cn('text-sm', isBangladeshiBilling ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                Bangladeshi Nationals
              </span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-5 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="theme-panel h-[28rem] animate-pulse rounded-[2rem]" />
            ))}
          </div>
        ) : null}

        {error ? (
          <Card className="rounded-[2rem] border-rose-200 bg-rose-50">
            <CardHeader>
              <CardTitle className="text-rose-900">Unable to load plans</CardTitle>
              <CardDescription className="text-rose-700">{error}</CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {!loading && !error ? (
          <div className="grid gap-5 lg:grid-cols-3">
            {plans.map((plan) => {
              const pricing = getPricingDetails(plan, {
                yearlyBilling,
                isBangladeshiBilling,
              })
              const isCurrentPlan = currentPlanSlug === plan.slug
              const actionLabel = !isAuthenticated
                ? plan.slug === 'free'
                  ? 'Start free'
                  : 'Choose plan'
                : isCurrentPlan
                  ? 'Current plan'
                  : (user?.current_plan?.tier ?? 0) < plan.tier
                    ? 'Upgrade'
                    : 'Downgrade'

              return (
                <Card
                  key={plan.id}
                  className={cn(
                    'theme-panel rounded-[2rem] border-0 shadow-[0_24px_60px_rgb(var(--theme-shadow-rgb)/0.12)]',
                    plan.slug === 'pro' ? 'ring-2 ring-[rgb(var(--theme-primary-rgb)/0.18)]' : ''
                  )}
                >
                  <CardHeader className="space-y-5">
                    <div className="flex items-center justify-between gap-3">
                      <PlanBadge plan={plan} />
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{pricing.providerLabel}</Badge>
                        {yearlyBilling && pricing.savings > 0 ? (
                          <Badge variant="outline">
                            Save {formatPrice(pricing.savings, pricing.currency)}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    <div>
                      <CardTitle className="text-3xl">{plan.name}</CardTitle>
                      <CardDescription className="mt-3 text-sm leading-7">
                        {plan.slug === 'free'
                          ? 'A solid starting tier for pilots and smaller internal studies.'
                          : plan.slug === 'pro'
                            ? 'More headroom for teams running regular research programs.'
                            : 'Unlimited capacity for larger organizations and high-volume work.'}
                      </CardDescription>
                    </div>
                    <div className="flex items-end gap-2">
                      <span className="text-5xl font-semibold tracking-tight text-foreground">
                        {pricing.missingPrice
                          ? 'Set in admin'
                          : formatPrice(pricing.amount, pricing.currency)}
                      </span>
                      <span className="pb-2 text-sm text-muted-foreground">
                        {pricing.missingPrice || Number(pricing.amount || 0) === 0
                          ? ''
                          : yearlyBilling
                            ? '/year'
                            : '/month'}
                      </span>
                    </div>
                    {!pricing.missingPrice && Number(pricing.amount || 0) > 0 ? (
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        {getCurrencyLabel(pricing.currency)} billing
                      </p>
                    ) : null}
                    {pricing.missingPrice ? (
                      <p className="text-xs text-muted-foreground">
                        Set the BDT amount for this plan in Django admin before offering it through bKash.
                      </p>
                    ) : null}
                  </CardHeader>

                  <CardContent className="space-y-6">
                    <div className="grid gap-3">
                      <div className="theme-panel-soft rounded-2xl px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Survey capacity
                        </p>
                        <p className="mt-1 text-sm font-medium text-foreground">
                          {formatLimit(plan.max_surveys, 'surveys')}
                        </p>
                      </div>
                      <div className="theme-panel-soft rounded-2xl px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Question cap
                        </p>
                        <p className="mt-1 text-sm font-medium text-foreground">
                          {formatLimit(plan.max_questions_per_survey, 'questions per survey')}
                        </p>
                      </div>
                      <div className="theme-panel-soft rounded-2xl px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Response cap
                        </p>
                        <p className="mt-1 text-sm font-medium text-foreground">
                          {formatLimit(plan.max_responses_per_survey, 'responses per survey')}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {(plan.features || []).map((feature) => (
                        <div key={feature} className="flex items-start gap-3">
                          <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                            <Check className="h-4 w-4" />
                          </span>
                          <p className="text-sm leading-6 text-muted-foreground">{feature}</p>
                        </div>
                      ))}
                    </div>

                    {!isAuthenticated ? (
                      <Button asChild className="w-full rounded-full">
                        <Link to="/register">{actionLabel}</Link>
                      </Button>
                    ) : (
                      <Button
                        className="w-full rounded-full"
                        variant={isCurrentPlan ? 'outline' : 'default'}
                        disabled={isCurrentPlan}
                        onClick={() => handleChangePlan(plan)}
                      >
                        {actionLabel}
                      </Button>
                    )}

                    {isAuthenticated && !isCurrentPlan ? (
                      <p className="text-xs text-muted-foreground">
                        Online billing is enabled in the next phase. Plan switching remains admin-managed for now.
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : null}

        {!loading && !error && !plans.length ? (
          <Card className="theme-panel rounded-[2rem] border-dashed text-center">
            <CardHeader>
              <CardTitle>No plans are active</CardTitle>
              <CardDescription>
                Activate at least one plan from Django admin to expose the licensing catalog.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}
      </div>
    </div>
  )
}

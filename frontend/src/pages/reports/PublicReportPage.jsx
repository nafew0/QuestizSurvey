import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, Globe2, LockKeyhole } from 'lucide-react'
import { useParams } from 'react-router-dom'

import AnalyticsSummaryBar from '@/components/analytics/AnalyticsSummaryBar'
import CrossTabReadOnlyCard from '@/components/analytics/CrossTabReadOnlyCard'
import QuestionAnalyticsCard from '@/components/analytics/QuestionAnalyticsCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { buildResponseFilterChips } from '@/lib/analytics'
import { fetchPublicReportData } from '@/services/analytics'

function PublicReportFallback({ title, description, children }) {
  return (
    <div className="theme-app-gradient flex min-h-screen items-center justify-center px-4 py-10 text-foreground">
      <Card className="theme-panel w-full max-w-xl rounded-[2rem]">
        <CardContent className="space-y-4 px-7 py-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
          {children}
        </CardContent>
      </Card>
    </div>
  )
}

export default function PublicReportPage() {
  const { reportId = '' } = useParams()
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordAttempt, setPasswordAttempt] = useState('')

  const reportQuery = useQuery({
    queryKey: ['public-report', reportId, passwordAttempt],
    queryFn: () => fetchPublicReportData(reportId, passwordAttempt),
    enabled: Boolean(reportId),
    retry: false,
  })

  const payload = reportQuery.data
  const shareError = reportQuery.error?.response?.data

  const filterChips = useMemo(
    () =>
      buildResponseFilterChips(
        payload?.filters || {},
        payload?.question_lookup || {},
        payload?.collector_lookup || {}
      ),
    [payload]
  )

  const handleUnlock = (event) => {
    event.preventDefault()
    const nextPassword = passwordInput.trim()
    if (!nextPassword) {
      return
    }
    setPasswordAttempt(nextPassword)
  }

  if (reportQuery.isLoading) {
    return (
      <div className="theme-app-gradient min-h-screen px-4 py-6">
        <div className="mx-auto max-w-[1280px] space-y-4">
          <Skeleton className="h-28 w-full rounded-[2rem]" />
          <Skeleton className="h-36 w-full rounded-[2rem]" />
          <Skeleton className="h-[420px] w-full rounded-[2rem]" />
        </div>
      </div>
    )
  }

  if (shareError?.code === 'password_required' || shareError?.code === 'password_invalid') {
    return (
      <PublicReportFallback
        title={shareError?.report?.name || 'Shared report locked'}
        description={
          shareError?.code === 'password_invalid'
            ? 'The password was not accepted. Try again to open this shared report.'
            : 'This shared report is password protected. Enter the password to continue.'
        }
      >
        <form className="mx-auto w-full max-w-sm space-y-3 text-left" onSubmit={handleUnlock}>
          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Report password
            </span>
            <Input
              type="password"
              value={passwordInput}
              onChange={(event) => setPasswordInput(event.target.value)}
              placeholder="Enter password"
              autoFocus
              className="h-11 rounded-2xl"
            />
          </label>
          <Button type="submit" className="w-full rounded-full">
            <LockKeyhole className="mr-2 h-4 w-4" />
            Unlock report
          </Button>
        </form>
      </PublicReportFallback>
    )
  }

  if (reportQuery.isError || !payload) {
    return (
      <PublicReportFallback
        title="Shared report unavailable"
        description={
          shareError?.detail ||
          'This shared report could not be found or is no longer available.'
        }
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-[rgb(var(--theme-border-rgb)/0.82)] px-4 py-2 text-sm text-muted-foreground">
          <Globe2 className="h-4 w-4" />
          Powered by MindSpear
        </div>
      </PublicReportFallback>
    )
  }

  return (
    <div className="theme-app-gradient min-h-screen px-4 py-6 text-foreground sm:px-6 sm:py-8">
      <div className="mx-auto max-w-[1280px] space-y-4">
        <header className="theme-panel rounded-[2rem] px-5 py-5 sm:px-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">Shared report</Badge>
                <Badge variant="secondary">{payload.report.name}</Badge>
                <Badge variant="outline">{payload.summary?.total_responses ?? 0} responses</Badge>
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">
                {payload.survey.title}
              </h1>
              {payload.survey.description ? (
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                  {payload.survey.description}
                </p>
              ) : null}
            </div>
            <div className="theme-panel-soft flex items-center gap-2 rounded-2xl px-4 py-3 text-sm text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              Read-only analytics
            </div>
          </div>

          {filterChips.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {filterChips.map((chip) => (
                <span key={chip.key} className="theme-chip-secondary">
                  {chip.label}
                </span>
              ))}
            </div>
          ) : null}
        </header>

        <AnalyticsSummaryBar
          summary={payload.summary}
          filtersActive={Boolean(filterChips.length)}
        />

        <div className="space-y-4">
          {(payload.questions ?? []).map((analytics) => (
            <QuestionAnalyticsCard
              key={analytics.question.id}
              analytics={analytics}
              preference={payload.report.config?.card_preferences?.[analytics.question.id]}
              readOnly
            />
          ))}

          {(payload.cross_tabs ?? []).map((crosstab, index) => (
            <CrossTabReadOnlyCard
              key={`${crosstab.row_question?.id || 'row'}-${crosstab.col_question?.id || 'col'}-${index}`}
              crosstab={crosstab}
            />
          ))}
        </div>

        <footer className="flex flex-col items-center justify-center gap-2 px-4 py-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[rgb(var(--theme-border-rgb)/0.82)] bg-white/80 px-4 py-2 text-sm text-muted-foreground shadow-sm">
            <Globe2 className="h-4 w-4" />
            Powered by MindSpear
          </div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Shared analytics for fast stakeholder review
          </p>
        </footer>
      </div>
    </div>
  )
}

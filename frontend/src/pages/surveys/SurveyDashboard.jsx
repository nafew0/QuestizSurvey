import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  Copy,
  Gift,
  Layers3,
  MoreHorizontal,
  Plus,
  Search,
  Share2,
  Sparkle,
  Trash2,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { useSiteTheme } from '@/contexts/SiteThemeContext'
import { useToast } from '@/hooks/useToast'
import { createInitialSurveyTheme } from '@/lib/surveyTheme'
import { cn } from '@/lib/utils'
import { getUsage } from '@/services/subscriptions'
import {
  createSurvey,
  deleteSurvey,
  duplicateSurvey,
  listSurveys,
} from '@/services/surveys'
import UsageBanner from '@/components/subscription/UsageBanner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  formatSurveyDate,
  getStatusLabel,
} from '@/utils/surveyBuilder'

const DASHBOARD_FILTERS = [
  { value: 'all', label: 'All Surveys' },
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Drafts' },
  { value: 'paused', label: 'Paused' },
  { value: 'closed', label: 'Closed' },
]

function formatMetricNumber(value) {
  return new Intl.NumberFormat('en-US').format(Number(value || 0))
}

function getSurveyCardTone(status) {
  switch (status) {
    case 'active':
      return {
        iconBg: 'bg-[rgb(var(--theme-primary-soft-rgb)/0.82)]',
        iconColor: 'text-[rgb(var(--theme-primary-rgb))]',
        statusDot: 'bg-emerald-500',
        statusText: 'text-emerald-700',
        responsesCard:
          'border-[rgb(var(--theme-primary-rgb)/0.16)] bg-[rgb(var(--theme-primary-soft-rgb)/0.62)]',
        updatedCard:
          'border-[rgb(var(--theme-secondary-rgb)/0.16)] bg-[rgb(var(--theme-secondary-soft-rgb)/0.5)]',
        shareButton:
          'border-[rgb(var(--theme-primary-rgb)/0.18)] bg-[rgb(var(--theme-primary-soft-rgb)/0.72)] text-[rgb(var(--theme-primary-ink-rgb))] hover:bg-[rgb(var(--theme-primary-soft-rgb))] hover:text-[rgb(var(--theme-primary-ink-rgb))]',
      }
    case 'draft':
      return {
        iconBg: 'bg-[rgb(var(--theme-secondary-soft-rgb)/0.88)]',
        iconColor: 'text-[rgb(var(--theme-secondary-rgb))]',
        statusDot: 'bg-[rgb(var(--theme-secondary-rgb))]',
        statusText: 'text-[rgb(var(--theme-secondary-ink-rgb))]',
        responsesCard:
          'border-[rgb(var(--theme-secondary-rgb)/0.16)] bg-[rgb(var(--theme-secondary-soft-rgb)/0.6)]',
        updatedCard:
          'border-[rgb(var(--theme-primary-rgb)/0.14)] bg-[rgb(var(--theme-primary-soft-rgb)/0.46)]',
        shareButton:
          'border-[rgb(var(--theme-secondary-rgb)/0.18)] bg-[rgb(var(--theme-secondary-soft-rgb)/0.76)] text-[rgb(var(--theme-secondary-ink-rgb))] hover:bg-[rgb(var(--theme-secondary-soft-rgb))] hover:text-[rgb(var(--theme-secondary-ink-rgb))]',
      }
    case 'paused':
      return {
        iconBg: 'bg-amber-50',
        iconColor: 'text-amber-600',
        statusDot: 'bg-amber-500',
        statusText: 'text-amber-700',
        responsesCard: 'border-amber-200 bg-amber-50',
        updatedCard: 'border-[rgb(var(--theme-secondary-rgb)/0.16)] bg-[rgb(var(--theme-secondary-soft-rgb)/0.5)]',
        shareButton:
          'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-700',
      }
    case 'closed':
      return {
        iconBg: 'bg-[rgb(var(--theme-accent-soft-rgb)/0.86)]',
        iconColor: 'text-[rgb(var(--theme-accent-rgb))]',
        statusDot: 'bg-rose-500',
        statusText: 'text-rose-700',
        responsesCard:
          'border-[rgb(var(--theme-accent-rgb)/0.16)] bg-[rgb(var(--theme-accent-soft-rgb)/0.64)]',
        updatedCard:
          'border-[rgb(var(--theme-secondary-rgb)/0.14)] bg-[rgb(var(--theme-secondary-soft-rgb)/0.46)]',
        shareButton:
          'border-[rgb(var(--theme-accent-rgb)/0.18)] bg-[rgb(var(--theme-accent-soft-rgb)/0.76)] text-[rgb(var(--theme-accent-ink-rgb))] hover:bg-[rgb(var(--theme-accent-soft-rgb))] hover:text-[rgb(var(--theme-accent-ink-rgb))]',
      }
    default:
      return {
        iconBg: 'bg-[rgb(var(--theme-neutral-rgb))]',
        iconColor: 'text-[rgb(var(--theme-secondary-ink-rgb))]',
        statusDot: 'bg-slate-400',
        statusText: 'text-slate-600',
        responsesCard:
          'border-[rgb(var(--theme-primary-rgb)/0.14)] bg-[rgb(var(--theme-primary-soft-rgb)/0.46)]',
        updatedCard:
          'border-[rgb(var(--theme-secondary-rgb)/0.16)] bg-[rgb(var(--theme-secondary-soft-rgb)/0.5)]',
        shareButton:
          'border-[rgb(var(--theme-secondary-rgb)/0.18)] bg-[rgb(var(--theme-secondary-soft-rgb)/0.72)] text-[rgb(var(--theme-secondary-ink-rgb))] hover:bg-[rgb(var(--theme-secondary-soft-rgb))] hover:text-[rgb(var(--theme-secondary-ink-rgb))]',
      }
  }
}

export default function SurveyDashboard() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { activeColors } = useSiteTheme()
  const [surveys, setSurveys] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const [usage, setUsage] = useState(null)
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
  })

  const deferredSearch = useDeferredValue(search)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const [nextSurveys, nextUsage] = await Promise.all([
          listSurveys(),
          getUsage().catch(() => null),
        ])

        if (!cancelled) {
          setSurveys(nextSurveys)
          setUsage(nextUsage)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.detail || 'Unable to load your surveys.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  const totalResponses = useMemo(
    () =>
      surveys.reduce(
        (sum, survey) => sum + Number(survey.response_count || 0),
        0
      ),
    [surveys]
  )

  const activeSurveyCount = useMemo(
    () => surveys.filter((survey) => survey.status === 'active').length,
    [surveys]
  )

  const draftSurveyCount = useMemo(
    () => surveys.filter((survey) => survey.status === 'draft').length,
    [surveys]
  )

  const closedSurveyCount = useMemo(
    () => surveys.filter((survey) => survey.status === 'closed').length,
    [surveys]
  )

  const pausedSurveyCount = useMemo(
    () => surveys.filter((survey) => survey.status === 'paused').length,
    [surveys]
  )

  const filterCounts = useMemo(
    () => ({
      all: surveys.length,
      active: activeSurveyCount,
      draft: draftSurveyCount,
      paused: pausedSurveyCount,
      closed: closedSurveyCount,
    }),
    [activeSurveyCount, closedSurveyCount, draftSurveyCount, pausedSurveyCount, surveys.length]
  )

  const filteredSurveys = useMemo(() => {
    const normalizedQuery = deferredSearch.trim().toLowerCase()

    return surveys.filter((survey) => {
      const matchesFilter = activeFilter === 'all' || survey.status === activeFilter
      const matchesQuery =
        !normalizedQuery ||
        [survey.title, survey.slug, survey.status].some((value) =>
          value?.toLowerCase().includes(normalizedQuery)
        )

      return matchesFilter && matchesQuery
    })
  }, [activeFilter, deferredSearch, surveys])

  const refreshUsage = async () => {
    try {
      const nextUsage = await getUsage()
      setUsage(nextUsage)
    } catch (err) {
      console.error('Unable to refresh subscription usage:', err)
    }
  }

  const surveyUsage = usage?.surveys
  const showUsageBanner = Boolean(
    surveyUsage &&
      !surveyUsage.unlimited &&
      surveyUsage.limit &&
      surveyUsage.used / surveyUsage.limit >= 0.7
  )

  const remainingSurveyCapacity = surveyUsage?.unlimited
    ? 'Unlimited survey capacity'
    : surveyUsage?.limit
      ? `${Math.max(surveyUsage.limit - surveyUsage.used, 0)} survey slots left`
      : 'Workspace ready'

  const liveRatio = surveys.length
    ? ((activeSurveyCount / surveys.length) * 100).toFixed(1)
    : '0.0'

  const handleCreateSurvey = async () => {
    if (!createForm.title.trim()) {
      toast({
        title: 'Title required',
        description: 'Give the survey a working title before creating it.',
        variant: 'warning',
      })
      return
    }

    try {
      const createdSurvey = await createSurvey({
        title: createForm.title,
        description: createForm.description,
        theme: createInitialSurveyTheme({
          primary: activeColors.primary,
          accent: activeColors.accent,
        }),
        settings: {
          progress_bar: true,
          numbering: true,
          save_continue: true,
        },
        welcome_page: {
          enabled: true,
          title: createForm.title,
          desc: createForm.description,
        },
        thank_you_page: {
          enabled: true,
          title: 'Thanks for your feedback',
          desc: 'Your response has been captured.',
        },
      })

      startTransition(() => {
        setSurveys((current) => [createdSurvey, ...current])
      })
      refreshUsage()

      setCreateOpen(false)
      setCreateForm({ title: '', description: '' })
      toast({
        title: 'Survey created',
        description: 'Opening the builder now.',
        variant: 'success',
      })
      navigate(`/surveys/${createdSurvey.id}/edit`)
    } catch (err) {
      toast({
        title: 'Create failed',
        description: err.response?.data?.detail || 'The survey could not be created.',
        variant: 'error',
      })
    }
  }

  const handleDuplicateSurvey = async (surveyId) => {
    try {
      const duplicated = await duplicateSurvey(surveyId)
      setSurveys((current) => [duplicated, ...current])
      refreshUsage()
      toast({
        title: 'Survey duplicated',
        description: 'A copy was added to your dashboard.',
        variant: 'success',
      })
    } catch (err) {
      toast({
        title: 'Duplicate failed',
        description: err.response?.data?.detail || 'The survey could not be duplicated.',
        variant: 'error',
      })
    }
  }

  const handleDeleteSurvey = async (surveyId) => {
    try {
      await deleteSurvey(surveyId)
      setSurveys((current) => current.filter((survey) => survey.id !== surveyId))
      refreshUsage()
      toast({
        title: 'Survey deleted',
        description: 'The survey was removed from your workspace.',
        variant: 'warning',
      })
    } catch (err) {
      toast({
        title: 'Delete failed',
        description: err.response?.data?.detail || 'The survey could not be deleted.',
        variant: 'error',
      })
    }
  }

  const handleCopyShareLink = async (slug) => {
    await navigator.clipboard.writeText(`${window.location.origin}/s/${slug}`)
    toast({
      title: 'Share link copied',
      description: 'The public survey link is in your clipboard.',
      variant: 'success',
    })
  }

  return (
    <div className="theme-app-gradient min-h-[calc(100vh-4rem)] px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="grid gap-4 lg:grid-cols-[1.65fr_0.8fr]">
          <div className="theme-panel relative overflow-hidden rounded-[2rem] px-6 py-5 sm:px-7">
            <div className="absolute right-4 top-0 h-24 w-24 rounded-full bg-[rgb(var(--theme-primary-soft-rgb)/0.64)] blur-3xl" />
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-muted-foreground">
              Live performance
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-6">
              <div>
                <p className="text-5xl font-semibold tracking-tight text-foreground sm:text-6xl">
                  {formatMetricNumber(totalResponses)}
                </p>
                <p className="mt-1 text-lg text-[rgb(var(--theme-secondary-ink-rgb))]">
                  Total responses
                </p>
              </div>
              <div className="pb-2">
                <p className="text-2xl font-semibold tracking-tight text-[rgb(var(--theme-secondary-rgb))]">
                  {activeSurveyCount} live
                </p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Active surveys
                </p>
              </div>
            </div>

            <svg viewBox="0 0 420 82" className="mt-5 h-20 w-full">
              <path
                d="M10 56C46 34 86 24 128 42C170 60 206 52 246 28C284 6 324 10 358 46C382 70 398 52 410 38"
                fill="none"
                stroke="rgb(var(--theme-secondary-rgb))"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div className="overflow-hidden rounded-[2rem] border border-[rgb(var(--theme-secondary-rgb)/0.18)] bg-[rgb(var(--theme-secondary-rgb))] px-6 py-5 text-white shadow-[0_24px_56px_rgb(var(--theme-shadow-rgb)/0.14)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.26em] text-white/72">
                  Efficiency
                </p>
                <p className="mt-4 text-5xl font-semibold tracking-tight sm:text-6xl">
                  {liveRatio}%
                </p>
                <p className="mt-1 text-lg text-white/78">Live ratio</p>
              </div>
              <Sparkle className="h-12 w-12 text-white/24" />
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between text-sm">
                <span>Drafts</span>
                <span>{draftSurveyCount}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/16">
                <div
                  className="h-full rounded-full bg-white"
                  style={{ width: `${liveRatio}%` }}
                />
              </div>
              <p className="mt-3 text-sm text-white/68">
                {closedSurveyCount} closed • {pausedSurveyCount} paused
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-4xl font-semibold tracking-tight text-foreground">
                  My Surveys
                </h1>
                <span className="theme-chip-secondary">{remainingSurveyCapacity}</span>
              </div>
              <p className="mt-2 text-base text-muted-foreground">
                Manage and monitor your running surveys.
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
              <div className="rounded-2xl border border-[rgb(var(--theme-border-rgb)/0.82)] bg-white px-4 py-3 sm:min-w-[18rem]">
                <div className="flex items-center gap-3">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search surveys"
                    className="border-none p-0 shadow-none focus-visible:ring-0"
                  />
                </div>
              </div>

              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button className="rounded-2xl px-6 py-6 text-base">
                    <Plus className="mr-2 h-5 w-5" />
                    Create Survey
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create a new survey</DialogTitle>
                    <DialogDescription>Add a title and short brief.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Title</label>
                      <Input
                        value={createForm.title}
                        onChange={(event) =>
                          setCreateForm((current) => ({
                            ...current,
                            title: event.target.value,
                          }))
                        }
                        placeholder="Customer onboarding study"
                        className="rounded-2xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Description</label>
                      <Textarea
                        value={createForm.description}
                        onChange={(event) =>
                          setCreateForm((current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                        placeholder="Optional"
                        className="rounded-2xl"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      className="rounded-2xl"
                      onClick={() => setCreateOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button className="rounded-2xl" onClick={handleCreateSurvey}>
                      Create
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-5 border-b border-[rgb(var(--theme-border-rgb)/0.85)] pb-2">
            {DASHBOARD_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setActiveFilter(filter.value)}
                className={cn(
                  'border-b-2 pb-3 text-sm font-medium transition-colors',
                  activeFilter === filter.value
                    ? 'border-[rgb(var(--theme-primary-rgb))] text-[rgb(var(--theme-primary-ink-rgb))]'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {filter.label}
                <span className="ml-2 text-xs text-muted-foreground">
                  {filterCounts[filter.value]}
                </span>
              </button>
            ))}
          </div>
        </section>

        {showUsageBanner ? <UsageBanner usage={usage} /> : null}

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div
                key={index}
                className="theme-panel h-[18.75rem] animate-pulse rounded-[1.8rem]"
              />
            ))}
          </div>
        ) : null}

        {error ? (
          <Card className="rounded-[2rem] border-rose-200 bg-rose-50">
            <CardHeader>
              <CardTitle className="text-rose-900">Unable to load surveys</CardTitle>
              <CardDescription className="text-rose-700">{error}</CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {!loading && !error && !filteredSurveys.length ? (
          <Card className="theme-panel rounded-[2rem] border-dashed text-center">
            <CardHeader>
              <div className="theme-icon-accent mx-auto flex h-16 w-16 items-center justify-center rounded-3xl">
                <Sparkle className="h-8 w-8" />
              </div>
              <CardTitle className="mt-4">No surveys match yet</CardTitle>
              <CardDescription className="mx-auto max-w-xl">
                Create a survey or change the filter.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="rounded-2xl" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Survey
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {!loading && !error && filteredSurveys.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredSurveys.map((survey) => {
              const tone = getSurveyCardTone(survey.status)

              return (
                <article
                  key={survey.id}
                  className="theme-panel h-[18.75rem] overflow-hidden rounded-[1.8rem] p-4 transition hover:-translate-y-0.5 hover:shadow-[0_24px_54px_rgb(var(--theme-shadow-rgb)/0.12)] sm:p-5"
                >
                  <div className="grid h-full min-h-0 grid-rows-[auto_auto_auto_1fr_auto] gap-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={cn(
                            'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl',
                            tone.iconBg,
                            tone.iconColor
                          )}
                        >
                          <Sparkle className="h-4 w-4" />
                        </div>
                        <div className="flex min-w-0 items-center gap-2">
                          <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', tone.statusDot)} />
                          <span className={cn('truncate text-[11px] font-semibold uppercase tracking-[0.16em]', tone.statusText)}>
                            {getStatusLabel(survey.status)}
                          </span>
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-9 w-9 shrink-0 rounded-2xl"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-2xl">
                          <DropdownMenuItem onClick={() => navigate(`/surveys/${survey.id}/edit`)}>
                            Open builder
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/surveys/${survey.id}/analyze`)}>
                            <BarChart3 className="mr-2 h-4 w-4" />
                            Analyze
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/surveys/${survey.id}/lottery`)}>
                            <Gift className="mr-2 h-4 w-4" />
                            Lottery
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/surveys/${survey.id}/distribute`)}>
                            <Share2 className="mr-2 h-4 w-4" />
                            Distribute
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicateSurvey(survey.id)}>
                            <Copy className="mr-2 h-4 w-4" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleCopyShareLink(survey.slug)}>
                            <Layers3 className="mr-2 h-4 w-4" />
                            Copy share link
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteSurvey(survey.id)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <button
                      type="button"
                      className="block min-w-0 text-left"
                      onClick={() => navigate(`/surveys/${survey.id}/edit`)}
                    >
                      <h3
                        className="line-clamp-2 break-words text-[1rem] font-semibold leading-[1.2] tracking-tight text-foreground sm:text-[1.08rem]"
                      >
                        {survey.title}
                      </h3>
                    </button>

                    <div className="grid grid-cols-2 gap-3">
                      <div className={cn('rounded-2xl border px-3 py-3', tone.responsesCard)}>
                        <p className="text-xs font-medium text-muted-foreground">Responses</p>
                        <p className="mt-1 text-[1.45rem] font-semibold tracking-tight text-foreground">
                          {survey.response_count ?? 0}
                        </p>
                      </div>
                      <div className={cn('rounded-2xl border px-3 py-3', tone.updatedCard)}>
                        <p className="text-xs font-medium text-muted-foreground">Updated</p>
                        <p className="mt-1 text-sm font-semibold tracking-tight text-foreground">
                          {formatSurveyDate(survey.updated_at)}
                        </p>
                      </div>
                    </div>

                    <div />

                    <div className="space-y-3 pb-1">
                      <div className="flex min-w-0 items-center justify-between gap-3 text-xs text-muted-foreground">
                        <span className="min-w-0 truncate text-[rgb(var(--theme-secondary-ink-rgb))]">
                          /s/{survey.slug}
                        </span>
                        <span className="whitespace-nowrap">Public link</span>
                      </div>

                      <div className="grid grid-cols-[minmax(0,1fr)_2.25rem_2.25rem] gap-2">
                        <Button
                          size="sm"
                          className="h-9 rounded-2xl"
                          onClick={() => navigate(`/surveys/${survey.id}/edit`)}
                        >
                          Open
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className={cn('h-9 w-9 rounded-2xl', tone.shareButton)}
                          onClick={() => navigate(`/surveys/${survey.id}/distribute`)}
                        >
                          <Share2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-9 w-9 rounded-2xl"
                          onClick={() => navigate(`/surveys/${survey.id}/analyze`)}
                        >
                          <BarChart3 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}

            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="theme-panel-soft h-[18.75rem] rounded-[1.8rem] border-dashed border-[rgb(var(--theme-secondary-rgb)/0.28)] text-left transition hover:-translate-y-0.5 hover:border-[rgb(var(--theme-secondary-rgb)/0.42)]"
            >
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-[rgb(var(--theme-secondary-rgb))] shadow-[0_18px_36px_rgb(var(--theme-shadow-rgb)/0.08)]">
                  <Plus className="h-8 w-8" />
                </div>
                <h3 className="mt-5 text-2xl font-semibold tracking-tight text-foreground">
                  New Survey
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Start from scratch.
                </p>
              </div>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

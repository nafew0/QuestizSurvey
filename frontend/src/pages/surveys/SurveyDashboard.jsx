import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  Copy,
  Layers3,
  MoreHorizontal,
  Plus,
  Search,
  Share2,
  Sparkle,
  Trash2,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
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
import { useSiteTheme } from '@/contexts/SiteThemeContext'
import { useToast } from '@/hooks/useToast'
import {
  createSurvey,
  deleteSurvey,
  duplicateSurvey,
  listSurveys,
} from '@/services/surveys'
import {
  formatSurveyDate,
  getStatusLabel,
} from '@/utils/surveyBuilder'
import { STATUS_BADGE_VARIANTS } from '@/constants/surveyBuilder'

export default function SurveyDashboard() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { activeColors } = useSiteTheme()
  const [surveys, setSurveys] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
  })

  const deferredSearch = useDeferredValue(search)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const nextSurveys = await listSurveys()
        setSurveys(nextSurveys)
      } catch (err) {
        setError(err.response?.data?.detail || 'Unable to load your surveys.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const filteredSurveys = useMemo(() => {
    if (!deferredSearch.trim()) {
      return surveys
    }

    const normalizedQuery = deferredSearch.toLowerCase()
    return surveys.filter((survey) =>
      [survey.title, survey.slug, survey.status].some((value) =>
        value?.toLowerCase().includes(normalizedQuery)
      )
    )
  }, [deferredSearch, surveys])

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
        theme: {
          primary: activeColors.primary,
          secondary: activeColors.secondary,
          accent: activeColors.accent,
        },
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
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="theme-panel rounded-[2.25rem] px-6 py-8 md:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge variant="default">Phase 2 Builder</Badge>
                <Badge variant="outline">React survey workspace</Badge>
              </div>
              <div className="space-y-3">
                <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
                  My Surveys
                </h1>
                <p className="max-w-2xl text-base leading-8 text-muted-foreground">
                  Create polished studies, iterate in the builder, and preview respondent flows before launch.
                </p>
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
                  <DialogDescription>
                    Start with a title and short brief. You can refine theme, logic, and questions in the builder.
                  </DialogDescription>
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
                      placeholder="What do you want to learn from respondents?"
                      className="rounded-2xl"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" className="rounded-2xl" onClick={() => setCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button className="rounded-2xl" onClick={handleCreateSurvey}>
                    Build survey
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="rounded-2xl border border-[rgb(var(--theme-border-rgb)/0.82)] bg-white px-4 py-3">
              <div className="flex items-center gap-3">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by title, slug, or status"
                  className="border-none p-0 shadow-none focus-visible:ring-0"
                />
              </div>
            </div>
            <div className="theme-panel-soft grid grid-cols-2 gap-3 rounded-2xl px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Surveys
                </p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                  {surveys.length}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Active
                </p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                  {surveys.filter((survey) => survey.status === 'active').length}
                </p>
              </div>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div
                key={index}
                className="theme-panel h-64 animate-pulse rounded-[2rem]"
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
                Create your first survey or refine the search term. The builder is ready for page logic, drag-and-drop question arrangement, and preview mode.
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
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredSurveys.map((survey) => (
              <Card
                key={survey.id}
                className="theme-panel group cursor-pointer rounded-[2rem] transition hover:-translate-y-1 hover:shadow-2xl"
                onClick={() => navigate(`/surveys/${survey.id}/edit`)}
              >
                <CardHeader className="space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Badge variant={STATUS_BADGE_VARIANTS[survey.status]}>
                          {getStatusLabel(survey.status)}
                        </Badge>
                        <Badge variant="outline">Slug: {survey.slug}</Badge>
                      </div>
                      <div>
                        <CardTitle className="line-clamp-2 text-2xl">{survey.title}</CardTitle>
                        <CardDescription className="mt-2">
                          Updated {formatSurveyDate(survey.updated_at)}
                        </CardDescription>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
                        <Button type="button" size="icon" variant="outline" className="rounded-2xl">
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
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="theme-panel-soft grid grid-cols-2 gap-4 rounded-3xl p-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Responses
                      </p>
                      <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                        {survey.response_count ?? 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Created
                      </p>
                      <p className="mt-1 text-sm font-medium text-[rgb(var(--theme-secondary-ink-rgb))]">
                        {formatSurveyDate(survey.created_at)}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Open the builder to edit pages, refine logic, and preview the respondent flow.
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

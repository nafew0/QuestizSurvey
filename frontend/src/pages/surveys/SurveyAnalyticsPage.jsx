import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  BarChart3,
  Copy,
  FileDown,
  Filter,
  LoaderCircle,
  Rows3,
  Save,
  Share2,
} from 'lucide-react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

import AnalyticsSummaryBar from '@/components/analytics/AnalyticsSummaryBar'
import CrossTabPanel from '@/components/analytics/CrossTabPanel'
import FilterBuilderDialog from '@/components/analytics/FilterBuilderDialog'
import QuestionAnalyticsCard from '@/components/analytics/QuestionAnalyticsCard'
import ResponseBrowser from '@/components/analytics/ResponseBrowser'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CustomSelect } from '@/components/ui/custom-select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/useToast'
import {
  buildResponseFilterChips,
  createDefaultReportConfig,
} from '@/lib/analytics'
import {
  createSavedReport,
  deleteSavedReport,
  fetchAnalyticsSummary,
  fetchQuestionAnalytics,
  listSavedReports,
  updateSavedReport,
} from '@/services/analytics'
import { listCollectors } from '@/services/collectors'
import { fetchSurvey } from '@/services/surveys'

function extractQuestions(survey) {
  return (survey?.pages ?? []).flatMap((page) => page.questions)
}

function isCrossTabEligible(question) {
  return [
    'multiple_choice_single',
    'multiple_choice_multi',
    'dropdown',
    'yes_no',
    'image_choice',
    'rating_scale',
    'star_rating',
    'nps',
  ].includes(question.question_type)
}

export default function SurveyAnalyticsPage() {
  const { surveyId = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const isResponsesTab = location.pathname.endsWith('/responses')

  const [filters, setFilters] = useState({})
  const [filterDialogOpen, setFilterDialogOpen] = useState(false)
  const [crossTabOpen, setCrossTabOpen] = useState(false)
  const [activeReportId, setActiveReportId] = useState('')
  const [cardPreferences, setCardPreferences] = useState({})
  const [crossTabState, setCrossTabState] = useState({ row: '', col: '', view: 'table' })
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [newReportName, setNewReportName] = useState('')
  const [appliedReportId, setAppliedReportId] = useState('')

  const surveyQuery = useQuery({
    queryKey: ['survey', surveyId],
    queryFn: () => fetchSurvey(surveyId),
  })

  const collectorsQuery = useQuery({
    queryKey: ['survey-collectors', surveyId],
    queryFn: () => listCollectors(surveyId),
  })

  const summaryQuery = useQuery({
    queryKey: ['analytics-summary', surveyId, filters],
    queryFn: () => fetchAnalyticsSummary(surveyId, filters, true),
    enabled: Boolean(surveyId),
  })

  const questionAnalyticsQuery = useQuery({
    queryKey: ['analytics-questions', surveyId, filters],
    queryFn: () => fetchQuestionAnalytics(surveyId, filters, true),
    enabled: Boolean(surveyId),
  })

  const reportsQuery = useQuery({
    queryKey: ['saved-reports', surveyId],
    queryFn: () => listSavedReports(surveyId),
    enabled: Boolean(surveyId),
  })

  const reportMutation = useMutation({
    mutationFn: async ({ reportId, payload }) => {
      if (reportId) {
        return updateSavedReport(surveyId, reportId, payload)
      }
      return createSavedReport(surveyId, payload)
    },
    onSuccess: (report) => {
      setActiveReportId(report.id)
      setAppliedReportId(report.id)
      queryClient.invalidateQueries({ queryKey: ['saved-reports', surveyId] })
      toast({
        title: 'Report saved',
        description: 'Your analytics layout and filters were saved.',
        variant: 'success',
      })
    },
  })

  const deleteReportMutation = useMutation({
    mutationFn: (reportId) => deleteSavedReport(surveyId, reportId),
    onSuccess: () => {
      setActiveReportId('')
      setAppliedReportId('')
      queryClient.invalidateQueries({ queryKey: ['saved-reports', surveyId] })
      toast({
        title: 'Report deleted',
        description: 'The saved report was removed.',
        variant: 'success',
      })
    },
  })

  const survey = surveyQuery.data
  const collectors = useMemo(() => collectorsQuery.data ?? [], [collectorsQuery.data])
  const questions = useMemo(() => extractQuestions(survey), [survey])

  const questionLookup = useMemo(
    () => Object.fromEntries(questions.map((question) => [question.id, question.text])),
    [questions]
  )
  const collectorLookup = useMemo(
    () => Object.fromEntries(collectors.map((collector) => [collector.id, collector.name])),
    [collectors]
  )
  const filterChips = useMemo(
    () => buildResponseFilterChips(filters, questionLookup, collectorLookup),
    [collectorLookup, filters, questionLookup]
  )
  const questionOptions = useMemo(
    () =>
      questions
        .filter((question) => isCrossTabEligible(question))
        .map((question) => ({
          value: question.id,
          label: question.text,
        })),
    [questions]
  )

  useEffect(() => {
    if (!activeReportId || !reportsQuery.data?.length || appliedReportId === activeReportId) {
      return
    }

    const report = reportsQuery.data.find((entry) => entry.id === activeReportId)
    if (!report) {
      return
    }

    const config = report.config || createDefaultReportConfig()
    setFilters(config.filters || {})
    setCardPreferences(config.card_preferences || {})
    setCrossTabState(config.cross_tab || { row: '', col: '', view: 'table' })
    if (config.active_tab === 'responses') {
      navigate(`/surveys/${surveyId}/analyze/responses`)
    } else {
      navigate(`/surveys/${surveyId}/analyze`)
    }
    setAppliedReportId(activeReportId)
  }, [activeReportId, appliedReportId, navigate, reportsQuery.data, surveyId])

  const applyFilter = ({ type, payload }) => {
    setFilters((current) => {
      if (type === 'answer') {
        return {
          ...current,
          answer_filters: [...(current.answer_filters ?? []), payload],
        }
      }
      return {
        ...current,
        ...payload,
      }
    })
  }

  const removeFilterChip = (chip) => {
    if (chip.key === 'date') {
      setFilters((current) => {
        const next = { ...current }
        delete next.date_from
        delete next.date_to
        return next
      })
      return
    }

    if (chip.key === 'duration') {
      setFilters((current) => {
        const next = { ...current }
        delete next.duration_min_seconds
        delete next.duration_max_seconds
        return next
      })
      return
    }

    if (chip.answerIndex != null) {
      setFilters((current) => ({
        ...current,
        answer_filters: (current.answer_filters ?? []).filter((_, index) => index !== chip.answerIndex),
      }))
      return
    }

    setFilters((current) => {
      const next = { ...current }
      delete next[chip.key]
      return next
    })
  }

  const currentConfig = useMemo(
    () => ({
      filters,
      card_preferences: cardPreferences,
      cross_tab: crossTabState,
      active_tab: isResponsesTab ? 'responses' : 'overview',
    }),
    [cardPreferences, crossTabState, filters, isResponsesTab]
  )

  const handleSaveReport = () => {
    if (activeReportId) {
      reportMutation.mutate({
        reportId: activeReportId,
        payload: {
          config: currentConfig,
        },
      })
      return
    }
    setSaveDialogOpen(true)
  }

  const handleCreateReport = () => {
    if (!newReportName.trim()) {
      return
    }

    reportMutation.mutate({
      payload: {
        name: newReportName.trim(),
        config: currentConfig,
      },
    })
    setSaveDialogOpen(false)
    setNewReportName('')
  }

  const handleShareResults = async () => {
    const shareUrl = `${window.location.origin}${location.pathname}`
    await navigator.clipboard.writeText(shareUrl)
    toast({
      title: 'Analytics link copied',
      description: 'The current analytics route was copied to the clipboard.',
      variant: 'success',
    })
  }

  const handleExport = (format) => {
    toast({
      title: `${format.toUpperCase()} export is a Phase 7 flow`,
      description: 'The export dropdown is wired, but file generation is implemented in the next phase.',
      variant: 'warning',
    })
  }

  if (surveyQuery.isLoading) {
    return (
      <div className="theme-app-gradient min-h-[calc(100vh-4rem)] px-4 py-6">
        <div className="mx-auto max-w-[1600px] space-y-4">
          <Skeleton className="h-20 w-full rounded-[2rem]" />
          <Skeleton className="h-36 w-full rounded-[2rem]" />
          <Skeleton className="h-[420px] w-full rounded-[2rem]" />
        </div>
      </div>
    )
  }

  if (surveyQuery.isError || !survey) {
    return (
      <div className="theme-app-gradient flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
        <Card className="max-w-xl rounded-[2rem] border-rose-200 bg-rose-50">
          <CardContent className="space-y-4 p-8 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-rose-900">
              Analytics workspace unavailable
            </h1>
            <p className="text-sm leading-6 text-rose-700">
              {surveyQuery.error?.message || 'The survey analytics page could not be loaded.'}
            </p>
            <Button className="rounded-full" onClick={() => navigate('/dashboard')}>
              Back to dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="theme-app-gradient min-h-[calc(100vh-4rem)] px-4 py-5">
      <div className="mx-auto max-w-[1600px] space-y-4">
        <div className="theme-panel rounded-[2rem] px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" size="icon" className="rounded-2xl" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{survey.status}</Badge>
                <Badge variant="outline">/{survey.slug}</Badge>
                <Badge variant="outline">{survey.pages.length} pages</Badge>
              </div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                {survey.title}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <CustomSelect
                value={activeReportId}
                onChange={(value) => {
                  setActiveReportId(value)
                  setAppliedReportId('')
                }}
                options={(reportsQuery.data ?? []).map((report) => ({
                  value: report.id,
                  label: report.name,
                }))}
                placeholder="Saved reports"
                triggerClassName="h-10 w-[12rem] rounded-full"
              />

              {activeReportId ? (
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => {
                    if (window.confirm('Delete the selected saved report?')) {
                      deleteReportMutation.mutate(activeReportId)
                    }
                  }}
                >
                  Remove report
                </Button>
              ) : null}

              <Button type="button" variant="outline" className="rounded-full" onClick={() => setFilterDialogOpen(true)}>
                <Filter className="mr-2 h-4 w-4" />
                Filter
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" className="rounded-full">
                    <FileDown className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-2xl">
                  <DropdownMenuItem onSelect={() => handleExport('pdf')}>PDF</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => handleExport('xlsx')}>XLSX</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => handleExport('pptx')}>PPTX</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button type="button" variant="outline" className="rounded-full" onClick={handleShareResults}>
                <Share2 className="mr-2 h-4 w-4" />
                Share Results
              </Button>

              <Button type="button" className="rounded-full" onClick={handleSaveReport}>
                {reportMutation.isPending ? (
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Report
              </Button>
            </div>
          </div>
        </div>

        <AnalyticsSummaryBar
          summary={summaryQuery.data}
          loading={summaryQuery.isLoading}
          filtersActive={Boolean(filterChips.length)}
        />

        <div className="theme-panel rounded-[2rem] px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            {filterChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                className="theme-chip-secondary"
                onClick={() => removeFilterChip(chip)}
              >
                {chip.label} ×
              </button>
            ))}
            <Button type="button" variant="outline" className="rounded-full" onClick={() => setFilterDialogOpen(true)}>
              <Copy className="mr-2 h-4 w-4" />
              Add Filter
            </Button>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={!isResponsesTab ? 'default' : 'outline'}
                className="rounded-full"
                onClick={() => navigate(`/surveys/${surveyId}/analyze`)}
              >
                <BarChart3 className="mr-2 h-4 w-4" />
                Overview
              </Button>
              <Button
                type="button"
                variant={isResponsesTab ? 'default' : 'outline'}
                className="rounded-full"
                onClick={() => navigate(`/surveys/${surveyId}/analyze/responses`)}
              >
                <Rows3 className="mr-2 h-4 w-4" />
                Responses
              </Button>
              <Button type="button" variant="outline" className="rounded-full" onClick={() => setCrossTabOpen(true)}>
                Cross-Tab
              </Button>
            </div>
          </div>
        </div>

        {isResponsesTab ? (
          <ResponseBrowser
            surveyId={surveyId}
            externalSearch={filters.text_search || ''}
            collectorLookup={collectorLookup}
          />
        ) : (
          <div className="space-y-4">
            {questionAnalyticsQuery.isLoading ? (
              <>
                <Skeleton className="h-[360px] w-full rounded-[2rem]" />
                <Skeleton className="h-[360px] w-full rounded-[2rem]" />
              </>
            ) : (
              (questionAnalyticsQuery.data ?? []).map((analytics) => (
                <QuestionAnalyticsCard
                  key={analytics.question.id}
                  analytics={analytics}
                  preference={cardPreferences[analytics.question.id]}
                  onPreferenceChange={(questionId, nextPreference) =>
                    setCardPreferences((current) => ({
                      ...current,
                      [questionId]: nextPreference,
                    }))
                  }
                  onWordClick={(word) => {
                    setFilters((current) => ({
                      ...current,
                      text_search: word,
                    }))
                    navigate(`/surveys/${surveyId}/analyze/responses`)
                  }}
                />
              ))
            )}
          </div>
        )}
      </div>

      <FilterBuilderDialog
        open={filterDialogOpen}
        onOpenChange={setFilterDialogOpen}
        survey={survey}
        collectors={collectors}
        onApply={applyFilter}
      />

      <CrossTabPanel
        open={crossTabOpen}
        onOpenChange={setCrossTabOpen}
        surveyId={surveyId}
        questionOptions={questionOptions}
        filters={filters}
        value={crossTabState}
        onChange={setCrossTabState}
        onAddToReport={(nextCrossTab) => {
          setCrossTabState(nextCrossTab)
          toast({
            title: 'Cross-tab added',
            description: 'The current cross-tab configuration will be saved with the report.',
            variant: 'success',
          })
        }}
      />

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Save analytics report</DialogTitle>
          </DialogHeader>
          <Input
            value={newReportName}
            onChange={(event) => setNewReportName(event.target.value)}
            placeholder="Q1 customer analytics"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleCreateReport}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

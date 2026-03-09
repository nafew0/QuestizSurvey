import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Monitor, Smartphone, Tablet, WandSparkles } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { SURVEY_DEVICE_MODES } from '@/constants/surveyBuilder'
import { buildSurveyThemeCss, normalizeSurveyTheme } from '@/lib/surveyTheme'
import {
  getInitialQuestionValue,
  questionValueHasContent,
  resolveNextPreviewStep,
} from '@/utils/surveyBuilder'

import QuestionRenderer from './QuestionRenderer'

const DEVICE_ICONS = {
  desktop: Monitor,
  tablet: Tablet,
  mobile: Smartphone,
}

function buildInitialAnswers(survey) {
  return survey.pages.reduce((acc, page) => {
    page.questions.forEach((question) => {
      acc[question.id] = getInitialQuestionValue(question)
    })
    return acc
  }, {})
}

export default function SurveyPreview({ survey }) {
  const [deviceMode, setDeviceMode] = useState('desktop')
  const [answers, setAnswers] = useState(() => buildInitialAnswers(survey))
  const [stage, setStage] = useState(survey.welcome_page?.enabled ? 'welcome' : 'page')
  const [pageHistory, setPageHistory] = useState(survey.pages.length > 0 ? [0] : [])
  const [errors, setErrors] = useState({})
  const [disqualifyMessage, setDisqualifyMessage] = useState(null)

  const currentPageIndex = pageHistory[pageHistory.length - 1] ?? 0
  const currentPage = survey.pages[currentPageIndex]
  const deviceClass = SURVEY_DEVICE_MODES.find((mode) => mode.value === deviceMode)?.className
  const theme = useMemo(() => normalizeSurveyTheme(survey.theme), [survey.theme])
  const themeCss = useMemo(
    () => buildSurveyThemeCss(theme, '.preview-survey-theme'),
    [theme]
  )

  const progressValue = useMemo(() => {
    if (stage !== 'page' || !survey.pages.length) {
      return 0
    }

    return ((currentPageIndex + 1) / survey.pages.length) * 100
  }, [currentPageIndex, stage, survey.pages.length])

  const updateAnswer = (questionId, value) => {
    setAnswers((current) => ({
      ...current,
      [questionId]: value,
    }))

    setErrors((current) => {
      if (!current[questionId]) {
        return current
      }

      const nextErrors = { ...current }
      delete nextErrors[questionId]
      return nextErrors
    })
  }

  const validatePage = () => {
    if (!currentPage) {
      return true
    }

    const nextErrors = {}
    currentPage.questions.forEach((question) => {
      if (!question.required) {
        return
      }

      if (!questionValueHasContent(question, answers[question.id])) {
        nextErrors[question.id] = 'This question is required in preview mode.'
      }
    })

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handlePrevious = () => {
    if (stage === 'thankyou' || stage === 'disqualify') {
      setStage('page')
      return
    }

    if (stage === 'page' && pageHistory.length > 1) {
      setPageHistory((current) => current.slice(0, -1))
      return
    }

    if (stage === 'page' && survey.welcome_page?.enabled) {
      setStage('welcome')
    }
  }

  const handleNext = () => {
    if (stage === 'welcome') {
      setStage('page')
      setPageHistory([0])
      return
    }

    if (!validatePage()) {
      return
    }

    const resolution = resolveNextPreviewStep({
      pages: survey.pages,
      currentPageIndex,
      answers,
    })

    if (resolution.type === 'page') {
      setPageHistory((current) => [...current, resolution.pageIndex])
      return
    }

    if (resolution.type === 'disqualify') {
      setDisqualifyMessage(resolution.message)
      setStage('disqualify')
      return
    }

    setStage('thankyou')
  }

  return (
    <div className="preview-survey-theme survey-theme-root theme-app-gradient min-h-screen px-4 py-8 text-foreground">
      <style>{themeCss}</style>
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="survey-theme-shell flex flex-col gap-4 rounded-[2rem] p-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Badge variant="warning">Preview Mode</Badge>
              <p className="text-sm text-muted-foreground">Responses are not saved</p>
            </div>
            {theme.logo_url ? (
              <div className="survey-theme-logo-row pt-1">
                <img src={theme.logo_url} alt={`${survey.title} logo`} className="survey-theme-logo" />
              </div>
            ) : null}
            <h1 className="text-2xl font-semibold tracking-tight">{survey.title}</h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Review branching, pacing, and question layout across device widths before going live.
            </p>
          </div>

          <div className="theme-panel-soft flex flex-wrap gap-2 rounded-2xl p-2">
            {SURVEY_DEVICE_MODES.map((mode) => {
              const Icon = DEVICE_ICONS[mode.value]
              return (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => setDeviceMode(mode.value)}
                  className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium transition ${
                    deviceMode === mode.value
                      ? 'bg-white text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {mode.label}
                </button>
              )
            })}
          </div>
        </header>

        {stage === 'page' ? (
          <div className="survey-theme-panel p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Progress
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Page {currentPageIndex + 1} of {survey.pages.length}
                </p>
              </div>
              <p className="text-sm font-semibold text-[rgb(var(--theme-secondary-ink-rgb))]">{Math.round(progressValue)}%</p>
            </div>
            <Progress value={progressValue} className="survey-theme-progress-track" />
          </div>
        ) : null}

        <div className={`mx-auto transition-all ${deviceClass}`}>
          <div className="survey-theme-shell p-6 md:p-8">
            {stage === 'welcome' ? (
              <div className="space-y-6 text-center">
                <Badge variant="default" className="mx-auto">
                  Welcome Page
                </Badge>
                <div className="space-y-4">
                  <h2 className="text-3xl font-semibold tracking-tight">
                    {survey.welcome_page?.title || survey.title}
                  </h2>
                  <p className="mx-auto max-w-2xl text-base leading-8 text-muted-foreground">
                    {survey.welcome_page?.desc ||
                      survey.description ||
                      'Preview the survey introduction exactly as respondents will see it.'}
                  </p>
                </div>
                <Button type="button" size="lg" className="survey-theme-control px-8" onClick={handleNext}>
                  Start preview
                </Button>
              </div>
            ) : null}

            {stage === 'page' && currentPage ? (
              <div className="space-y-8">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">Page {currentPage.order}</Badge>
                    <p className="text-sm text-muted-foreground">
                      Skip logic updates live as you answer.
                    </p>
                  </div>
                  {currentPage.title ? (
                    <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                      {currentPage.title}
                    </h2>
                  ) : null}
                  {currentPage.description ? (
                    <p className="text-sm leading-7 text-muted-foreground">{currentPage.description}</p>
                  ) : null}
                </div>

                <div className="survey-theme-questions">
                  {currentPage.questions.map((question) => (
                    <div key={question.id} className="space-y-2">
                      <QuestionRenderer
                        question={question}
                        value={answers[question.id]}
                        onChange={(value) => updateAnswer(question.id, value)}
                      />
                      {errors[question.id] ? (
                        <p className="text-sm font-medium text-rose-500">{errors[question.id]}</p>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePrevious}
                    disabled={!survey.welcome_page?.enabled && pageHistory.length === 1}
                    className="survey-theme-control"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Previous
                  </Button>
                  <Button type="button" onClick={handleNext} className="survey-theme-control">
                    {currentPageIndex >= survey.pages.length - 1 ? 'Finish preview' : 'Next page'}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}

            {stage === 'thankyou' ? (
              <div className="space-y-6 text-center">
                <Badge variant="success" className="mx-auto">
                  Thank You
                </Badge>
                <div className="space-y-4">
                  <h2 className="text-3xl font-semibold tracking-tight">
                    {survey.thank_you_page?.title || 'Preview complete'}
                  </h2>
                  <p className="mx-auto max-w-2xl text-base leading-8 text-muted-foreground">
                    {survey.thank_you_page?.desc ||
                      'This is the completion state respondents will see after submitting the survey.'}
                  </p>
                </div>
                <div className="flex justify-center gap-3">
                  <Button type="button" variant="outline" className="survey-theme-control" onClick={handlePrevious}>
                    Review last page
                  </Button>
                  <Button
                    type="button"
                    className="survey-theme-control"
                    onClick={() => {
                      setAnswers(buildInitialAnswers(survey))
                      setErrors({})
                      setDisqualifyMessage(null)
                      setStage(survey.welcome_page?.enabled ? 'welcome' : 'page')
                      setPageHistory([0])
                    }}
                  >
                    <WandSparkles className="mr-2 h-4 w-4" />
                    Restart preview
                  </Button>
                </div>
              </div>
            ) : null}

            {stage === 'disqualify' ? (
              <div className="space-y-6 text-center">
                <Badge variant="danger" className="mx-auto">
                  Logic Exit
                </Badge>
                <div className="space-y-4">
                  <h2 className="text-3xl font-semibold tracking-tight">Disqualification path</h2>
                  <p className="mx-auto max-w-2xl text-base leading-8 text-muted-foreground">
                    {disqualifyMessage}
                  </p>
                </div>
                <Button type="button" variant="outline" className="survey-theme-control" onClick={handlePrevious}>
                  Return to survey
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Monitor, Smartphone, Tablet, WandSparkles } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { SURVEY_DEVICE_MODES } from '@/constants/surveyBuilder'
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.14),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-xl shadow-slate-900/10 backdrop-blur md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Badge variant="warning">Preview Mode</Badge>
              <p className="text-sm text-slate-500">Responses are not saved</p>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">{survey.title}</h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-500">
              Review branching, pacing, and question layout across device widths before going live.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 rounded-2xl bg-slate-100 p-2">
            {SURVEY_DEVICE_MODES.map((mode) => {
              const Icon = DEVICE_ICONS[mode.value]
              return (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => setDeviceMode(mode.value)}
                  className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium transition ${
                    deviceMode === mode.value
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
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
          <div className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-lg shadow-slate-900/10 backdrop-blur">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Progress
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Page {currentPageIndex + 1} of {survey.pages.length}
                </p>
              </div>
              <p className="text-sm font-semibold text-slate-700">{Math.round(progressValue)}%</p>
            </div>
            <Progress value={progressValue} />
          </div>
        ) : null}

        <div className={`mx-auto transition-all ${deviceClass}`}>
          <div className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-2xl shadow-slate-900/10 backdrop-blur md:p-8">
            {stage === 'welcome' ? (
              <div className="space-y-6 text-center">
                <Badge variant="default" className="mx-auto">
                  Welcome Page
                </Badge>
                <div className="space-y-4">
                  <h2 className="text-4xl font-semibold tracking-tight">
                    {survey.welcome_page?.title || survey.title}
                  </h2>
                  <p className="mx-auto max-w-2xl text-base leading-8 text-slate-500">
                    {survey.welcome_page?.desc ||
                      survey.description ||
                      'Preview the survey introduction exactly as respondents will see it.'}
                  </p>
                </div>
                <Button type="button" size="lg" className="rounded-2xl px-8" onClick={handleNext}>
                  Start preview
                </Button>
              </div>
            ) : null}

            {stage === 'page' && currentPage ? (
              <div className="space-y-8">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">Page {currentPage.order}</Badge>
                    <p className="text-sm text-slate-500">
                      Skip logic updates live as you answer.
                    </p>
                  </div>
                  {currentPage.title ? (
                    <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
                      {currentPage.title}
                    </h2>
                  ) : null}
                  {currentPage.description ? (
                    <p className="text-sm leading-7 text-slate-500">{currentPage.description}</p>
                  ) : null}
                </div>

                <div className="space-y-5">
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
                    className="rounded-2xl"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Previous
                  </Button>
                  <Button type="button" onClick={handleNext} className="rounded-2xl">
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
                  <h2 className="text-4xl font-semibold tracking-tight">
                    {survey.thank_you_page?.title || 'Preview complete'}
                  </h2>
                  <p className="mx-auto max-w-2xl text-base leading-8 text-slate-500">
                    {survey.thank_you_page?.desc ||
                      'This is the completion state respondents will see after submitting the survey.'}
                  </p>
                </div>
                <div className="flex justify-center gap-3">
                  <Button type="button" variant="outline" className="rounded-2xl" onClick={handlePrevious}>
                    Review last page
                  </Button>
                  <Button
                    type="button"
                    className="rounded-2xl"
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
                  <h2 className="text-4xl font-semibold tracking-tight">Disqualification path</h2>
                  <p className="mx-auto max-w-2xl text-base leading-8 text-slate-500">
                    {disqualifyMessage}
                  </p>
                </div>
                <Button type="button" variant="outline" className="rounded-2xl" onClick={handlePrevious}>
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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Copy,
  LoaderCircle,
  LockKeyhole,
} from 'lucide-react'

import QuestionRenderer from '@/components/survey/QuestionRenderer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useSiteTheme } from '@/contexts/SiteThemeContext'
import { useToast } from '@/hooks/useToast'
import { buildSurveyThemeCss, normalizeSurveyTheme } from '@/lib/surveyTheme'
import {
  fetchPublicSurvey,
  submitPublicSurvey,
  updatePublicSurvey,
} from '@/services/publicSurveys'
import { buildQuestionNumberLookup } from '@/utils/questionNumbers'
import { normalizeSurvey, resolveNextPreviewStep } from '@/utils/surveyBuilder'
import {
  buildInitialPublicAnswers,
  buildResumePageHistory,
  hasRespondedCookie,
  restorePublicAnswers,
  serializePublicAnswers,
  setRespondedCookie,
  validateSurveyPage,
} from '@/utils/publicSurvey'

const BLOCKED_STATE_MAP = {
  already_completed: {
    badge: 'Already completed',
    badgeVariant: 'warning',
    title: 'You have already completed this survey.',
    description:
      'This link has already been used from this browser or connection. Thanks for sending your response.',
    Icon: CheckCircle2,
  },
  response_limit_reached: {
    badge: 'Closed',
    badgeVariant: 'warning',
    title: 'This survey is no longer accepting responses.',
    description:
      'The response limit has been reached, so new submissions are currently blocked.',
    Icon: LockKeyhole,
  },
  survey_closed: {
    badge: 'Closed',
    badgeVariant: 'warning',
    title: 'This survey is no longer accepting responses.',
    description:
      'The collection window has ended, so the survey is closed to new submissions.',
    Icon: LockKeyhole,
  },
  survey_inactive: {
    badge: 'Unavailable',
    badgeVariant: 'outline',
    title: 'This survey is not accepting responses right now.',
    description:
      'The survey owner has paused or unpublished it, so the public form is temporarily unavailable.',
    Icon: AlertCircle,
  },
  invalid_resume: {
    badge: 'Resume link',
    badgeVariant: 'outline',
    title: 'This resume link is invalid or has expired.',
    description:
      'Open the original survey link to start a new response, or ask the owner for a fresh resume link.',
    Icon: AlertCircle,
  },
  not_found: {
    badge: 'Not found',
    badgeVariant: 'outline',
    title: 'This survey could not be found.',
    description:
      'The public link may be incorrect, expired, or removed by the survey owner.',
    Icon: AlertCircle,
  },
  invalid_invitation: {
    badge: 'Invitation link',
    badgeVariant: 'outline',
    title: 'This invitation link is invalid.',
    description:
      'Ask the survey owner for a fresh invitation link or open the public survey link instead.',
    Icon: AlertCircle,
  },
  unavailable: {
    badge: 'Unavailable',
    badgeVariant: 'outline',
    title: 'The survey is unavailable right now.',
    description:
      'Please try again in a moment. If the issue continues, contact the survey owner.',
    Icon: AlertCircle,
  },
}

function getBlockedState(error, resumeToken = '') {
  const status = error?.response?.status
  const code = error?.response?.data?.code
  const detail = error?.response?.data?.detail

  if (status === 404) {
    return {
      ...(BLOCKED_STATE_MAP[
        code === 'invalid_invitation'
          ? 'invalid_invitation'
          : resumeToken
            ? 'invalid_resume'
            : 'not_found'
      ]),
      detail,
    }
  }

  const state = BLOCKED_STATE_MAP[code] ?? BLOCKED_STATE_MAP.unavailable

  return {
    ...state,
    detail,
  }
}

function PublicStateCard({ state }) {
  const Icon = state.Icon ?? AlertCircle

  return (
    <div className="theme-app-gradient min-h-screen px-4 py-10 text-foreground">
      <div className="mx-auto max-w-2xl">
        <div className="theme-panel rounded-[2rem] px-6 py-8 text-center sm:px-8">
          <div className="theme-icon-accent mx-auto flex h-14 w-14 items-center justify-center rounded-2xl">
            <Icon className="h-6 w-6" />
          </div>
          <Badge variant={state.badgeVariant} className="mt-5">
            {state.badge}
          </Badge>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
            {state.title}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
            {state.detail || state.description}
          </p>
        </div>
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="theme-app-gradient flex min-h-screen items-center justify-center px-4 py-10 text-foreground">
      <div className="theme-panel flex items-center gap-3 rounded-2xl px-5 py-4">
        <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
        <span className="text-sm font-medium text-muted-foreground">
          Loading survey
        </span>
      </div>
    </div>
  )
}

function PasswordGate({ password, setPassword, errorMessage, onUnlock, loading }) {
  return (
    <div className="theme-app-gradient min-h-screen px-4 py-10 text-foreground">
      <div className="mx-auto max-w-2xl">
        <div className="theme-panel rounded-[2rem] px-6 py-8 text-center sm:px-8">
          <div className="theme-icon-secondary mx-auto flex h-14 w-14 items-center justify-center rounded-2xl">
            <LockKeyhole className="h-6 w-6" />
          </div>
          <Badge variant="outline" className="mt-5">
            Password required
          </Badge>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
            This survey link is protected.
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
            Enter the survey password to continue.
          </p>
          <div className="mx-auto mt-6 max-w-md space-y-3 text-left">
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter password"
              className="h-12 w-full rounded-2xl border border-input bg-background px-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {errorMessage ? (
              <p className="text-sm font-medium text-rose-500">{errorMessage}</p>
            ) : null}
            <Button
              type="button"
              className="w-full rounded-2xl"
              disabled={loading}
              onClick={onUnlock}
            >
              {loading ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Unlock survey
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PublicSurveyPage() {
  const { slug = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { activeColors } = useSiteTheme()
  const { toast } = useToast()

  const [survey, setSurvey] = useState(null)
  const [answers, setAnswers] = useState({})
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [stage, setStage] = useState('loading')
  const [pageHistory, setPageHistory] = useState([])
  const [resumeToken, setResumeToken] = useState('')
  const [blockedState, setBlockedState] = useState(null)
  const [disqualifyMessage, setDisqualifyMessage] = useState('')
  const [accessKey, setAccessKey] = useState('')
  const [passwordDraft, setPasswordDraft] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const skipSearchReloadRef = useRef(false)

  const resumeParam = searchParams.get('resume')?.trim() || ''
  const inviteParam = searchParams.get('invite')?.trim() || ''
  const currentPageIndex = pageHistory[pageHistory.length - 1] ?? 0
  const currentPage = survey?.pages?.[currentPageIndex] ?? null

  const surveyTheme = useMemo(
    () =>
      normalizeSurveyTheme(survey?.theme, {
        primary: activeColors.primary,
        accent: activeColors.accent,
      }),
    [activeColors.accent, activeColors.primary, survey?.theme]
  )

  const themeCss = useMemo(
    () => buildSurveyThemeCss(surveyTheme, '.public-survey-theme'),
    [surveyTheme]
  )

  const progressValue = useMemo(() => {
    if (!survey?.pages?.length || stage !== 'page') {
      return 0
    }

    return ((currentPageIndex + 1) / survey.pages.length) * 100
  }, [currentPageIndex, stage, survey?.pages])
  const questionNumbers = useMemo(
    () => buildQuestionNumberLookup(survey?.pages ?? []),
    [survey?.pages]
  )

  const syncResumeParam = useCallback(
    (nextToken) => {
      skipSearchReloadRef.current = true
      const params = new URLSearchParams(window.location.search)

      if (nextToken) {
        params.set('resume', nextToken)
      } else {
        params.delete('resume')
      }

      setSearchParams(params, { replace: true })
    },
    [setSearchParams]
  )

  useEffect(() => {
    if (skipSearchReloadRef.current) {
      skipSearchReloadRef.current = false
      return
    }

    let cancelled = false

    const loadSurvey = async () => {
      setLoading(true)
      setBlockedState(null)
      setPasswordError('')

      if (hasRespondedCookie(slug) && !resumeParam) {
        if (!cancelled) {
          setStage('blocked')
          setBlockedState(BLOCKED_STATE_MAP.already_completed)
          setLoading(false)
        }
        return
      }

      try {
        const responseData = await fetchPublicSurvey(slug, {
          resumeToken: resumeParam,
          invitationToken: inviteParam,
          accessKey,
        })
        if (cancelled) {
          return
        }

        const nextSurvey = normalizeSurvey(responseData)
        const restoredAnswers = responseData.response
          ? restorePublicAnswers(nextSurvey, responseData.response)
          : buildInitialPublicAnswers(nextSurvey)

        const nextResumeToken =
          responseData.response?.resume_token || resumeParam || ''
        const nextHistory = responseData.response
          ? buildResumePageHistory(
              nextSurvey,
              restoredAnswers,
              responseData.response.current_page
            )
          : nextSurvey.pages.length
            ? [0]
            : []

        setSurvey(nextSurvey)
        setAnswers(restoredAnswers)
        setErrors({})
        setDisqualifyMessage('')
        setResumeToken(nextResumeToken)
        setPageHistory(nextHistory)
        setPasswordError('')

        if (responseData.response?.status === 'completed') {
          setRespondedCookie(nextSurvey.slug)
          setStage('thankyou')
          if (resumeParam) {
            syncResumeParam('')
          }
        } else if (!nextSurvey.pages.length) {
          setStage('thankyou')
        } else if (responseData.response || !nextSurvey.welcome_page?.enabled) {
          setStage('page')
        } else {
          setStage('welcome')
        }
      } catch (error) {
        if (cancelled) {
          return
        }

        const code = error?.response?.data?.code
        if (code === 'password_required' || code === 'password_invalid') {
          setStage('password')
          setPasswordError(
            error?.response?.data?.detail ||
              'The password for this survey link is incorrect.'
          )
          setLoading(false)
          return
        }

        setSurvey(null)
        setStage('blocked')
        setBlockedState(getBlockedState(error, resumeParam))
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadSurvey()

    return () => {
      cancelled = true
    }
  }, [accessKey, inviteParam, resumeParam, slug, syncResumeParam])

  useEffect(() => {
    if (stage === 'loading') {
      return
    }

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [currentPageIndex, stage])

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

  const persistResponse = async ({
    nextStatus,
    currentPageId,
    showSavedToast = false,
    copyResumeLink = false,
  }) => {
    if (!survey) {
      return null
    }

    setSaving(true)

    try {
      const payload = {
        status: nextStatus,
        current_page: currentPageId || null,
        answers: serializePublicAnswers(survey, answers),
        invitation_token: inviteParam || undefined,
        access_key: accessKey || undefined,
      }

      let responseData = null

      if (resumeToken) {
        responseData = await updatePublicSurvey(slug, {
          ...payload,
          resume_token: resumeToken,
        })
      } else {
        responseData = await submitPublicSurvey(slug, payload)
      }

      const nextToken = responseData.resume_token || resumeToken

      if (nextToken) {
        setResumeToken(nextToken)
      }

      if (nextStatus === 'completed') {
        setRespondedCookie(survey.slug)
        syncResumeParam('')
      } else if (nextToken && resumeParam !== nextToken) {
        syncResumeParam(nextToken)
      }

      if (showSavedToast) {
        toast({
          title: 'Progress saved',
          description: 'Your progress has been saved.',
          variant: 'success',
        })
      }

      if (copyResumeLink && nextToken) {
        const resumeUrl = new URL(`${window.location.origin}/s/${survey.slug}`)
        resumeUrl.searchParams.set('resume', nextToken)
        if (inviteParam) {
          resumeUrl.searchParams.set('invite', inviteParam)
        }

        try {
          await navigator.clipboard.writeText(resumeUrl.toString())
          toast({
            title: 'Resume link copied',
            description: 'The survey link with your saved progress is on your clipboard.',
            variant: 'success',
          })
        } catch (error) {
          toast({
            title: 'Progress saved',
            description: 'Copy the resume link directly from your browser address bar.',
            variant: 'info',
          })
        }
      }

      return responseData
    } catch (error) {
      if ([403, 404, 410].includes(error?.response?.status)) {
        setStage('blocked')
        setBlockedState(getBlockedState(error, resumeToken || resumeParam))
      } else {
        toast({
          title: 'Save failed',
          description:
            error?.response?.data?.detail ||
            'We could not save your response. Please try again.',
          variant: 'error',
        })
      }

      return null
    } finally {
      setSaving(false)
    }
  }

  const handlePrevious = () => {
    if (stage !== 'page') {
      return
    }

    if (pageHistory.length > 1) {
      setPageHistory((current) => current.slice(0, -1))
      return
    }

    if (survey?.welcome_page?.enabled) {
      setStage('welcome')
    }
  }

  const handleNext = async () => {
    if (!survey) {
      return
    }

    if (stage === 'welcome') {
      if (!survey.pages.length) {
        setStage('thankyou')
        return
      }

      setStage('page')
      setPageHistory([0])
      return
    }

    if (!currentPage) {
      return
    }

    const nextErrors = validateSurveyPage(currentPage, answers)
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    const resolution = resolveNextPreviewStep({
      pages: survey.pages,
      currentPageIndex,
      answers,
    })

    if (resolution.type === 'page') {
      const nextPage = survey.pages[resolution.pageIndex]
      if (!nextPage) {
        return
      }

      const savedResponse = await persistResponse({
        nextStatus: 'in_progress',
        currentPageId: nextPage.id,
        showSavedToast: true,
      })

      if (!savedResponse) {
        return
      }

      setPageHistory((current) => [...current, resolution.pageIndex])
      return
    }

    const savedResponse = await persistResponse({
      nextStatus: 'completed',
      currentPageId: currentPage.id,
    })

    if (!savedResponse) {
      return
    }

    if (resolution.type === 'disqualify') {
      setDisqualifyMessage(
        resolution.message || 'This survey ended early based on your answer.'
      )
      setStage('disqualify')
      return
    }

    setStage('thankyou')
  }

  const handleSaveAndCopy = async () => {
    if (!survey || !currentPage) {
      return
    }

    await persistResponse({
      nextStatus: 'in_progress',
      currentPageId: currentPage.id,
      copyResumeLink: true,
    })
  }

  const handleUnlock = () => {
    if (!passwordDraft.trim()) {
      setPasswordError('Enter the survey password to continue.')
      return
    }

    setPasswordError('')
    setAccessKey(passwordDraft.trim())
  }

  if (loading) {
    return <LoadingState />
  }

  if (blockedState) {
    return <PublicStateCard state={blockedState} />
  }

  if (stage === 'password') {
    return (
      <PasswordGate
        password={passwordDraft}
        setPassword={setPasswordDraft}
        errorMessage={passwordError}
        onUnlock={handleUnlock}
        loading={loading}
      />
    )
  }

  if (!survey) {
    return <PublicStateCard state={BLOCKED_STATE_MAP.unavailable} />
  }

  return (
    <div
      className="public-survey-theme survey-theme-root theme-app-gradient min-h-screen px-4 py-6 text-foreground sm:px-6 sm:py-8"
    >
      <style>{themeCss}</style>
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="survey-theme-shell px-5 py-5 sm:px-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Public survey</Badge>
                {resumeToken && stage === 'page' ? (
                  <Badge variant="outline">Progress saved</Badge>
                ) : null}
                {stage === 'page' && survey.settings?.numbering !== false && currentPage ? (
                  <Badge variant="default">
                    Page {currentPageIndex + 1} of {survey.pages.length}
                  </Badge>
                ) : null}
              </div>
              <div>
                {surveyTheme.logo_url ? (
                  <div className="survey-theme-logo-row pb-3">
                    <img
                      src={surveyTheme.logo_url}
                      alt={`${survey.title} logo`}
                      className="survey-theme-logo"
                    />
                  </div>
                ) : null}
                <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                  {survey.title}
                </h1>
                {survey.description ? (
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
                    {survey.description}
                  </p>
                ) : null}
              </div>
            </div>

            {stage === 'page' && survey.settings?.save_continue !== false ? (
              <Button
                type="button"
                variant="outline"
                className="survey-theme-control"
                onClick={handleSaveAndCopy}
                disabled={saving}
              >
                {saving ? (
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Copy className="mr-2 h-4 w-4" />
                )}
                Save and finish later
              </Button>
            ) : null}
          </div>
        </header>

        {stage === 'page' && currentPage && survey.settings?.progress_bar !== false ? (
          <div className="survey-theme-panel px-5 py-4 sm:px-6">
            <div className="mb-3 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Progress
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {Math.round(progressValue)}% complete
                </p>
              </div>
              <p className="text-sm font-semibold text-[rgb(var(--theme-secondary-ink-rgb))]">
                {currentPageIndex + 1}/{survey.pages.length}
              </p>
            </div>
            <Progress value={progressValue} className="survey-theme-progress-track" />
          </div>
        ) : null}

        <div className="survey-theme-shell px-5 py-6 sm:px-7 sm:py-7">
          {stage === 'welcome' ? (
            <div className="space-y-6 text-center">
              <Badge variant="default" className="mx-auto">
                Welcome
              </Badge>
              <div className="space-y-4">
                <h2 className="text-3xl font-semibold tracking-tight text-foreground">
                  {survey.welcome_page?.title || survey.title}
                </h2>
                <p className="mx-auto max-w-2xl text-sm leading-8 text-muted-foreground">
                  {survey.welcome_page?.desc ||
                    survey.description ||
                    'Start the survey when you are ready.'}
                </p>
              </div>
              <Button type="button" size="lg" className="survey-theme-control px-8" onClick={handleNext}>
                Start survey
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          ) : null}

          {stage === 'page' && currentPage ? (
            <div className="space-y-7">
              <div className="space-y-2">
                {currentPage.title ? (
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                    {currentPage.title}
                  </h2>
                ) : null}
                {currentPage.description ? (
                  <p className="text-sm leading-7 text-muted-foreground">
                    {currentPage.description}
                  </p>
                ) : null}
              </div>

              <div className="survey-theme-questions">
                {currentPage.questions.map((question) => (
                  <div key={question.id} className="space-y-2">
                    <QuestionRenderer
                      question={question}
                      value={answers[question.id]}
                      onChange={(value) => updateAnswer(question.id, value)}
                      disabled={saving}
                      numberLabel={
                        survey.settings?.numbering !== false ? questionNumbers[question.id] : null
                      }
                      frameClassName={
                        errors[question.id]
                          ? 'border-rose-300 bg-rose-50/40 shadow-none'
                          : ''
                      }
                    />
                    {errors[question.id] ? (
                      <p className="px-1 text-sm font-medium text-rose-500">
                        {errors[question.id]}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  className="survey-theme-control"
                  onClick={handlePrevious}
                  disabled={
                    saving ||
                    (pageHistory.length === 1 && !survey.welcome_page?.enabled)
                  }
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Previous
                </Button>

                <Button
                  type="button"
                  className="survey-theme-control"
                  onClick={handleNext}
                  disabled={saving}
                >
                  {saving ? (
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {currentPageIndex >= survey.pages.length - 1
                    ? 'Submit survey'
                    : 'Next page'}
                  {!saving ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
                </Button>
              </div>
            </div>
          ) : null}

          {stage === 'thankyou' ? (
            <div className="space-y-6 text-center">
              <Badge variant="success" className="mx-auto">
                Thank you
              </Badge>
              <div className="space-y-4">
                <h2 className="text-3xl font-semibold tracking-tight text-foreground">
                  {survey.thank_you_page?.title || 'Thank you for your response'}
                </h2>
                <p className="mx-auto max-w-2xl text-sm leading-8 text-muted-foreground">
                  {survey.thank_you_page?.desc ||
                    'Your response has been recorded successfully.'}
                </p>
              </div>
            </div>
          ) : null}

          {stage === 'disqualify' ? (
            <div className="space-y-6 text-center">
              <Badge variant="warning" className="mx-auto">
                Survey complete
              </Badge>
              <div className="space-y-4">
                <h2 className="text-3xl font-semibold tracking-tight text-foreground">
                  Thanks for your response
                </h2>
                <p className="mx-auto max-w-2xl text-sm leading-8 text-muted-foreground">
                  {disqualifyMessage ||
                    'This survey ended early based on your answer path.'}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import {
  ArrowLeft,
  BarChart3,
  Eye,
  LoaderCircle,
  Rocket,
  Save,
  Share2,
  XCircle,
} from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'

import QuestionSettingsPanel from '@/components/builder/QuestionSettingsPanel'
import QuestionTypePalette from '@/components/builder/QuestionTypePalette'
import SurveyBuilderCanvas from '@/components/builder/SurveyBuilderCanvas'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useSurveyBuilder } from '@/hooks/useSurveyBuilder'
import { STATUS_BADGE_VARIANTS } from '@/constants/surveyBuilder'
import { cn } from '@/lib/utils'
import { getStatusLabel } from '@/utils/surveyBuilder'

export default function SurveyBuilder() {
  const navigate = useNavigate()
  const { surveyId } = useParams()
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false)
  const [closingSurvey, setClosingSurvey] = useState(false)
  const {
    survey,
    loading,
    error,
    savingState,
    improvingQuestions,
    pendingQuestionImprovement,
    selectedQuestionId,
    selectedQuestion,
    selectedPageId,
    selectedPage,
    setSelectedQuestionId,
    setSelectedPageId,
    updateSurveyField,
    updatePageField,
    updateQuestionField,
    updateQuestionRichText,
    updateChoiceField,
    addChoice,
    removeChoice,
    moveChoice,
    createNewPage,
    removePage,
    movePage,
    createNewQuestion,
    removeQuestion,
    duplicateQuestionById,
    moveQuestion,
    improveQuestionById,
    applyQuestionImprovement,
    dismissQuestionImprovement,
    publishCurrentSurvey,
    closeCurrentSurvey,
  } = useSurveyBuilder(surveyId)

  const isSaving =
    savingState.survey ||
    Object.values(savingState.pages).some(Boolean) ||
    Object.values(savingState.questions).some(Boolean)

  const actionButtonClass =
    'h-11 rounded-2xl border px-4 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5'

  const handleConfirmClose = async () => {
    setClosingSurvey(true)

    try {
      await closeCurrentSurvey()
      setCloseConfirmOpen(false)
    } finally {
      setClosingSurvey(false)
    }
  }

  if (loading) {
    return (
      <div className="theme-app-gradient flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="theme-panel flex items-center gap-3 rounded-2xl px-5 py-4">
          <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm font-medium text-muted-foreground">Loading survey builder</span>
        </div>
      </div>
    )
  }

  if (error || !survey) {
    return (
      <div className="theme-app-gradient flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
        <div className="max-w-lg rounded-[2rem] border border-rose-200 bg-rose-50 p-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-rose-900">
            Survey builder unavailable
          </h1>
          <p className="mt-3 text-sm leading-7 text-rose-700">{error || 'The requested survey could not be loaded.'}</p>
          <Button className="mt-6 rounded-2xl" onClick={() => navigate('/dashboard')}>
            Back to dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="theme-app-gradient h-full overflow-hidden overscroll-none px-3 py-2">
      <div className="mx-auto flex h-full max-w-[1800px] flex-col gap-2.5">
        <header className="theme-panel rounded-[1.5rem] px-4 py-2.5">
          <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-xl"
                onClick={() => navigate('/dashboard')}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>

              <div className="flex min-w-0 flex-wrap items-center gap-2 xl:flex-nowrap">
                <input
                  value={survey.title}
                  onChange={(event) => updateSurveyField('title', event.target.value)}
                  className="min-w-0 flex-1 border-none bg-transparent p-0 text-base font-semibold tracking-tight text-foreground focus:outline-none md:text-[1.15rem] xl:max-w-[20rem]"
                />

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={STATUS_BADGE_VARIANTS[survey.status]}>
                    {getStatusLabel(survey.status)}
                  </Badge>
                  <Badge variant="outline">/{survey.slug}</Badge>
                  <Badge variant="outline">
                    {survey.pages.length} page{survey.pages.length === 1 ? '' : 's'}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <div
                className={cn(
                  'flex h-11 items-center gap-2 rounded-2xl border px-4 shadow-sm',
                  isSaving
                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                )}
              >
                {isSaving ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span className="text-sm font-semibold">
                  {isSaving ? 'Saving changes' : 'All changes saved'}
                </span>
              </div>

              <Button
                type="button"
                variant="outline"
                className={cn(
                  actionButtonClass,
                  'border-orange-200 bg-orange-50 text-orange-700 hover:border-orange-300 hover:bg-orange-100 hover:text-orange-800'
                )}
                onClick={() => navigate(`/surveys/${survey.id}/analyze`)}
              >
                <BarChart3 className="mr-2 h-4 w-4" />
                Analyze
              </Button>

              <Button
                type="button"
                variant="outline"
                className={cn(
                  actionButtonClass,
                  'border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-300 hover:bg-sky-100 hover:text-sky-800'
                )}
                onClick={() => navigate(`/surveys/${survey.id}/distribute`)}
              >
                <Share2 className="mr-2 h-4 w-4" />
                Distribute
              </Button>

              <Button
                type="button"
                variant="outline"
                className={cn(
                  actionButtonClass,
                  'border-violet-200 bg-violet-50 text-violet-700 hover:border-violet-300 hover:bg-violet-100 hover:text-violet-800'
                )}
                onClick={() => navigate(`/surveys/${survey.id}/preview`)}
              >
                <Eye className="mr-2 h-4 w-4" />
                Preview
              </Button>

              {survey.status === 'active' ? (
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    actionButtonClass,
                    'border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100 hover:text-rose-800'
                  )}
                  onClick={() => setCloseConfirmOpen(true)}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Close
                </Button>
              ) : (
                <Button
                  type="button"
                  className={cn(
                    actionButtonClass,
                    'border-emerald-600 bg-emerald-600 text-white shadow-[0_18px_34px_rgba(5,150,105,0.24)] hover:bg-emerald-500 hover:text-white'
                  )}
                  onClick={publishCurrentSurvey}
                >
                  <Rocket className="mr-2 h-4 w-4" />
                  Publish
                </Button>
              )}
            </div>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[250px_minmax(0,1fr)_320px]">
          <div className="min-h-0">
            <QuestionTypePalette />
          </div>

          <div className="builder-survey-theme survey-theme-root theme-panel min-h-0 overflow-hidden rounded-[2rem] bg-transparent">
            <div className="h-full overflow-y-auto p-4">
              <SurveyBuilderCanvas
                survey={survey}
                selectedQuestionId={selectedQuestionId}
                selectedPageId={selectedPageId}
                onSelectQuestion={setSelectedQuestionId}
                onSelectPage={setSelectedPageId}
                onPageFieldChange={updatePageField}
                onQuestionFieldChange={updateQuestionField}
                onQuestionRichTextChange={updateQuestionRichText}
                onAddPage={createNewPage}
                onMovePage={movePage}
                onDeletePage={removePage}
                onAddQuestion={createNewQuestion}
                onMoveQuestion={moveQuestion}
                onDuplicateQuestion={duplicateQuestionById}
                onDeleteQuestion={removeQuestion}
                onChoiceFieldChange={updateChoiceField}
                onAddChoice={addChoice}
                onRemoveChoice={removeChoice}
                onMoveChoice={moveChoice}
                onImproveQuestion={improveQuestionById}
                improvingQuestions={improvingQuestions}
                pendingQuestionImprovement={pendingQuestionImprovement}
                onApplyQuestionImprovement={applyQuestionImprovement}
                onDismissQuestionImprovement={dismissQuestionImprovement}
              />
            </div>
          </div>

          <div className="min-h-0">
            <QuestionSettingsPanel
              survey={survey}
              selectedPage={selectedPage}
              question={selectedQuestion}
              onSurveyFieldChange={updateSurveyField}
              onPageFieldChange={updatePageField}
              onQuestionFieldChange={updateQuestionField}
              onQuestionRichTextChange={updateQuestionRichText}
              onImproveQuestion={improveQuestionById}
              improvingQuestions={improvingQuestions}
            />
          </div>
        </div>
      </div>

      <Dialog open={closeConfirmOpen} onOpenChange={setCloseConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Close this survey?</DialogTitle>
            <DialogDescription>
              This will immediately stop new responses from being submitted. Existing responses will remain available in analytics and exports.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl"
              onClick={() => setCloseConfirmOpen(false)}
              disabled={closingSurvey}
            >
              Keep survey open
            </Button>
            <Button
              type="button"
              className="rounded-2xl border border-rose-600 bg-rose-600 text-white hover:bg-rose-500"
              onClick={handleConfirmClose}
              disabled={closingSurvey}
            >
              {closingSurvey ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="mr-2 h-4 w-4" />
              )}
              Close survey
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

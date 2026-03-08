import { ArrowLeft, BarChart3, Eye, LoaderCircle, Rocket, Save, Share2, XCircle } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'

import QuestionSettingsPanel from '@/components/builder/QuestionSettingsPanel'
import QuestionTypePalette from '@/components/builder/QuestionTypePalette'
import SurveyBuilderCanvas from '@/components/builder/SurveyBuilderCanvas'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useSurveyBuilder } from '@/hooks/useSurveyBuilder'
import { STATUS_BADGE_VARIANTS } from '@/constants/surveyBuilder'
import { getStatusLabel } from '@/utils/surveyBuilder'

export default function SurveyBuilder() {
  const navigate = useNavigate()
  const { surveyId } = useParams()
  const {
    survey,
    loading,
    error,
    savingState,
    selectedQuestionId,
    selectedQuestion,
    selectedPageId,
    selectedPage,
    setSelectedQuestionId,
    setSelectedPageId,
    updateSurveyField,
    updatePageField,
    updateQuestionField,
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
    publishCurrentSurvey,
    closeCurrentSurvey,
  } = useSurveyBuilder(surveyId)

  const isSaving =
    savingState.survey ||
    Object.values(savingState.pages).some(Boolean) ||
    Object.values(savingState.questions).some(Boolean)

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
              <div className="theme-panel-soft flex h-10 items-center gap-2 rounded-xl px-3">
                {isSaving ? (
                  <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  <Save className="h-4 w-4 text-[rgb(var(--theme-secondary-rgb))]" />
                )}
                <span className="text-sm font-medium text-[rgb(var(--theme-secondary-ink-rgb))]">
                  {isSaving ? 'Saving' : 'Synced'}
                </span>
              </div>

              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl"
                onClick={() => navigate(`/surveys/${survey.id}/analyze`)}
              >
                <BarChart3 className="mr-2 h-4 w-4" />
                Analyze
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl"
                onClick={() => navigate(`/surveys/${survey.id}/distribute`)}
              >
                <Share2 className="mr-2 h-4 w-4" />
                Distribute
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl"
                onClick={() => navigate(`/surveys/${survey.id}/preview`)}
              >
                <Eye className="mr-2 h-4 w-4" />
                Preview
              </Button>

              {survey.status === 'active' ? (
                <Button type="button" variant="outline" className="h-10 rounded-xl" onClick={closeCurrentSurvey}>
                  <XCircle className="mr-2 h-4 w-4" />
                  Close
                </Button>
              ) : (
                <Button type="button" className="h-10 rounded-xl" onClick={publishCurrentSurvey}>
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

          <div className="theme-panel min-h-0 overflow-hidden rounded-[2rem] bg-white/55">
            <div className="h-full overflow-y-auto p-4">
              <SurveyBuilderCanvas
                survey={survey}
                selectedQuestionId={selectedQuestionId}
                selectedPageId={selectedPageId}
                onSelectQuestion={setSelectedQuestionId}
                onSelectPage={setSelectedPageId}
                onPageFieldChange={updatePageField}
                onQuestionFieldChange={updateQuestionField}
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
            />
          </div>
        </div>
      </div>
    </div>
  )
}

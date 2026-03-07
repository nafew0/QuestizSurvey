import { ArrowLeft, Eye, LoaderCircle, Rocket, Save, XCircle } from 'lucide-react'
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
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-lg shadow-slate-900/5">
          <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm font-medium text-slate-700">Loading survey builder</span>
        </div>
      </div>
    )
  }

  if (error || !survey) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-slate-50 px-4">
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
    <div className="min-h-[calc(100vh-4rem)] bg-[linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] px-3 py-3 xl:h-[calc(100vh-4rem)] xl:overflow-hidden">
      <div className="mx-auto flex max-w-[1800px] flex-col gap-4 xl:h-full">
        <header className="rounded-[1.75rem] border border-white/70 bg-white/90 px-5 py-4 shadow-xl shadow-slate-900/10 backdrop-blur">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0 rounded-2xl"
                onClick={() => navigate('/dashboard')}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>

              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={STATUS_BADGE_VARIANTS[survey.status]}>
                    {getStatusLabel(survey.status)}
                  </Badge>
                  <Badge variant="outline">/{survey.slug}</Badge>
                  <Badge variant="outline">
                    {survey.pages.length} page{survey.pages.length === 1 ? '' : 's'}
                  </Badge>
                </div>

                <input
                  value={survey.title}
                  onChange={(event) => updateSurveyField('title', event.target.value)}
                  className="w-full max-w-[44rem] border-none bg-transparent p-0 text-3xl font-semibold tracking-tight text-slate-950 focus:outline-none md:text-[2.65rem]"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <div className="flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4">
                {isSaving ? (
                  <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  <Save className="h-4 w-4 text-slate-500" />
                )}
                <span className="text-sm font-medium text-slate-600">
                  {isSaving ? 'Saving' : 'Synced'}
                </span>
              </div>

              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-2xl"
                onClick={() => navigate(`/surveys/${survey.id}/preview`)}
              >
                <Eye className="mr-2 h-4 w-4" />
                Preview
              </Button>

              {survey.status === 'active' ? (
                <Button type="button" variant="outline" className="h-11 rounded-2xl" onClick={closeCurrentSurvey}>
                  <XCircle className="mr-2 h-4 w-4" />
                  Close
                </Button>
              ) : (
                <Button type="button" className="h-11 rounded-2xl" onClick={publishCurrentSurvey}>
                  <Rocket className="mr-2 h-4 w-4" />
                  Publish
                </Button>
              )}
            </div>
          </div>
        </header>

        <div className="grid gap-4 xl:min-h-0 xl:flex-1 xl:grid-cols-[260px_minmax(0,1fr)_320px]">
          <div className="xl:min-h-0">
            <QuestionTypePalette />
          </div>

          <div className="min-h-[26rem] overflow-hidden rounded-[2rem] border border-slate-200 bg-white/50 shadow-xl shadow-slate-900/5 xl:min-h-0 xl:h-full">
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

          <div className="xl:min-h-0">
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

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
    <div className="min-h-[calc(100vh-4rem)] bg-[linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] px-4 py-6">
      <div className="mx-auto max-w-[1800px] space-y-5">
        <header className="sticky top-4 z-20 rounded-[2rem] border border-white/70 bg-white/90 px-6 py-5 shadow-xl shadow-slate-900/10 backdrop-blur">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="rounded-2xl"
                onClick={() => navigate('/dashboard')}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>

              <div className="space-y-3">
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
                  className="w-full border-none bg-transparent p-0 text-4xl font-semibold tracking-tight text-slate-950 focus:outline-none"
                />
                <p className="text-sm text-slate-500">
                  {isSaving ? 'Autosaving changes...' : 'All changes synced with the API.'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2">
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
                className="rounded-2xl"
                onClick={() => navigate(`/surveys/${survey.id}/preview`)}
              >
                <Eye className="mr-2 h-4 w-4" />
                Preview
              </Button>

              {survey.status === 'active' ? (
                <Button type="button" variant="outline" className="rounded-2xl" onClick={closeCurrentSurvey}>
                  <XCircle className="mr-2 h-4 w-4" />
                  Close
                </Button>
              ) : (
                <Button type="button" className="rounded-2xl" onClick={publishCurrentSurvey}>
                  <Rocket className="mr-2 h-4 w-4" />
                  Publish
                </Button>
              )}
            </div>
          </div>
        </header>

        <div className="grid gap-5 xl:grid-cols-[290px_minmax(0,1fr)_360px]">
          <div className="h-[calc(100vh-10.5rem)]">
            <QuestionTypePalette />
          </div>

          <div className="h-[calc(100vh-10.5rem)] overflow-y-auto rounded-[2rem] border border-slate-200 bg-white/50 p-4 shadow-xl shadow-slate-900/5">
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
            />
          </div>

          <div className="h-[calc(100vh-10.5rem)]">
            <QuestionSettingsPanel
              survey={survey}
              selectedPage={selectedPage}
              question={selectedQuestion}
              onSurveyFieldChange={updateSurveyField}
              onPageFieldChange={updatePageField}
              onQuestionFieldChange={updateQuestionField}
              onChoiceFieldChange={updateChoiceField}
              addChoice={addChoice}
              removeChoice={removeChoice}
              moveChoice={moveChoice}
            />
          </div>
        </div>
      </div>
    </div>
  )
}


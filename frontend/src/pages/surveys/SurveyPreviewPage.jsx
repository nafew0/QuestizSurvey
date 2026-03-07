import { ArrowLeft, LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import SurveyPreview from '@/components/survey/SurveyPreview'
import { Button } from '@/components/ui/button'
import { fetchSurvey } from '@/services/surveys'
import { normalizeSurvey } from '@/utils/surveyBuilder'

export default function SurveyPreviewPage() {
  const { surveyId } = useParams()
  const navigate = useNavigate()
  const [survey, setSurvey] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const nextSurvey = await fetchSurvey(surveyId)
        setSurvey(normalizeSurvey(nextSurvey))
      } catch (err) {
        setError(err.response?.data?.detail || 'Unable to load preview.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [surveyId])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-lg shadow-slate-900/5">
          <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm font-medium text-slate-700">Loading preview</span>
        </div>
      </div>
    )
  }

  if (error || !survey) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-lg rounded-[2rem] border border-rose-200 bg-rose-50 p-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-rose-900">
            Preview unavailable
          </h1>
          <p className="mt-3 text-sm leading-7 text-rose-700">{error || 'This survey preview could not be loaded.'}</p>
          <Button className="mt-6 rounded-2xl" onClick={() => navigate(`/surveys/${surveyId}/edit`)}>
            Back to builder
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="fixed left-4 top-4 z-20">
        <Button
          type="button"
          variant="outline"
          className="rounded-2xl bg-white/80 backdrop-blur"
          onClick={() => navigate(`/surveys/${surveyId}/edit`)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to builder
        </Button>
      </div>
      <SurveyPreview survey={survey} />
    </div>
  )
}


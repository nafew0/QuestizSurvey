import api from './api'

function buildAnalyticsParams(filters = {}, includeInsights = true) {
  const params = {}
  if (filters && Object.keys(filters).length) {
    params.filters = JSON.stringify(filters)
  }
  if (includeInsights) {
    params.include_insights = 'true'
  }
  return params
}

export async function fetchAnalyticsSummary(surveyId, filters = {}, includeInsights = true) {
  const response = await api.get(`/surveys/${surveyId}/analytics/summary/`, {
    params: buildAnalyticsParams(filters, includeInsights),
  })
  return response.data
}

export async function fetchQuestionAnalytics(surveyId, filters = {}, includeInsights = true) {
  const response = await api.get(`/surveys/${surveyId}/analytics/questions/`, {
    params: buildAnalyticsParams(filters, includeInsights),
  })
  return response.data
}

export async function fetchQuestionInsights(surveyId, questionId, filters = {}) {
  const response = await api.post(
    `/surveys/${surveyId}/analytics/questions/${questionId}/insights/`,
    { filters }
  )
  return response.data
}

export async function fetchCrossTab(surveyId, rowQuestionId, colQuestionId, filters = {}, includeInsights = true) {
  const params = buildAnalyticsParams(filters, includeInsights)
  params.row = rowQuestionId
  params.col = colQuestionId
  const response = await api.get(`/surveys/${surveyId}/analytics/crosstab/`, { params })
  return response.data
}

export async function listSurveyResponses(surveyId, options = {}) {
  const { filters = {}, page, ordering, q, answer, search } = options
  const params = {}

  if (filters && Object.keys(filters).length) {
    params.filters = JSON.stringify(filters)
  }
  if (page) {
    params.page = page
  }
  if (ordering) {
    params.ordering = ordering
  }
  if (q) {
    params.q = q
  }
  if (answer) {
    params.answer = answer
  }
  if (search) {
    params.search = search
  }

  const response = await api.get(`/surveys/${surveyId}/responses/`, { params })
  return response.data
}

export async function fetchSurveyResponse(surveyId, responseId) {
  const response = await api.get(`/surveys/${surveyId}/responses/${responseId}/`)
  return response.data
}

export async function deleteSurveyResponse(surveyId, responseId) {
  await api.delete(`/surveys/${surveyId}/responses/${responseId}/`)
}

export async function bulkDeleteSurveyResponses(surveyId, ids) {
  const response = await api.post(`/surveys/${surveyId}/responses/bulk-delete/`, { ids })
  return response.data
}

export async function listSavedReports(surveyId) {
  const response = await api.get(`/surveys/${surveyId}/reports/`)
  return response.data
}

export async function createSavedReport(surveyId, payload) {
  const response = await api.post(`/surveys/${surveyId}/reports/`, payload)
  return response.data
}

export async function updateSavedReport(surveyId, reportId, payload) {
  const response = await api.patch(`/surveys/${surveyId}/reports/${reportId}/`, payload)
  return response.data
}

export async function deleteSavedReport(surveyId, reportId) {
  await api.delete(`/surveys/${surveyId}/reports/${reportId}/`)
}

export async function createExportJob(surveyId, payload) {
  const response = await api.post(`/surveys/${surveyId}/exports/`, payload)
  return response.data
}

export async function fetchExportJob(surveyId, jobId) {
  const response = await api.get(`/surveys/${surveyId}/exports/${jobId}/`)
  return response.data
}

export async function fetchPublicReportData(reportId, password = '') {
  const response = await api.post(`/reports/${reportId}/data/`, password ? { password } : {})
  return response.data
}

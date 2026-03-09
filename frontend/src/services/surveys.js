import api from './api'

export async function listSurveys() {
  const response = await api.get('/surveys/')
  return response.data.results ?? response.data
}

export async function createSurvey(payload) {
  const response = await api.post('/surveys/', payload)
  return response.data
}

export async function fetchSurvey(surveyId) {
  const response = await api.get(`/surveys/${surveyId}/`)
  return response.data
}

export async function updateSurvey(surveyId, payload) {
  const response = await api.patch(`/surveys/${surveyId}/`, payload)
  return response.data
}

export async function uploadSurveyThemeAsset(surveyId, { assetType, file, clear = false }) {
  const formData = new FormData()
  formData.append('asset_type', assetType)
  formData.append('clear', clear ? 'true' : 'false')

  if (file) {
    formData.append('asset', file)
  }

  const response = await api.post(`/surveys/${surveyId}/theme-assets/`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return response.data
}

export async function deleteSurvey(surveyId) {
  await api.delete(`/surveys/${surveyId}/`)
}

export async function duplicateSurvey(surveyId) {
  const response = await api.post(`/surveys/${surveyId}/duplicate/`)
  return response.data
}

export async function publishSurvey(surveyId) {
  const response = await api.post(`/surveys/${surveyId}/publish/`)
  return response.data
}

export async function closeSurvey(surveyId) {
  const response = await api.post(`/surveys/${surveyId}/close/`)
  return response.data
}

export async function createPage(surveyId, payload) {
  const response = await api.post(`/surveys/${surveyId}/pages/`, payload)
  return response.data
}

export async function updatePage(surveyId, pageId, payload) {
  const response = await api.put(`/surveys/${surveyId}/pages/${pageId}/`, payload)
  return response.data
}

export async function deletePage(surveyId, pageId) {
  await api.delete(`/surveys/${surveyId}/pages/${pageId}/`)
}

export async function reorderPages(surveyId, pages) {
  const response = await api.patch(`/surveys/${surveyId}/pages/reorder/`, { pages })
  return response.data
}

export async function createQuestion(surveyId, pageId, payload) {
  const response = await api.post(`/surveys/${surveyId}/pages/${pageId}/questions/`, payload)
  return response.data
}

export async function updateQuestion(surveyId, pageId, questionId, payload) {
  const response = await api.put(
    `/surveys/${surveyId}/pages/${pageId}/questions/${questionId}/`,
    payload
  )
  return response.data
}

export async function deleteQuestion(surveyId, pageId, questionId) {
  await api.delete(`/surveys/${surveyId}/pages/${pageId}/questions/${questionId}/`)
}

export async function reorderQuestions(surveyId, pageId, questions) {
  const response = await api.patch(
    `/surveys/${surveyId}/pages/${pageId}/questions/reorder/`,
    { questions }
  )
  return response.data
}

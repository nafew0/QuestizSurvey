import api from '@/services/api'

export async function fetchPublicSurvey(slug, resumeToken = '') {
  const response = await api.get(`/public/surveys/${slug}/`, {
    params: resumeToken ? { resume_token: resumeToken } : undefined,
  })
  return response.data
}

export async function submitPublicSurvey(slug, payload) {
  const response = await api.post(`/public/surveys/${slug}/`, payload)
  return response.data
}

export async function updatePublicSurvey(slug, payload) {
  const response = await api.put(`/public/surveys/${slug}/`, payload)
  return response.data
}

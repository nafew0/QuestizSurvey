import api from '@/services/api'

export async function fetchPublicSurvey(
  slug,
  { resumeToken = '', invitationToken = '', accessKey = '' } = {}
) {
  const params = {}

  if (resumeToken) {
    params.resume_token = resumeToken
  }

  if (invitationToken) {
    params.invite = invitationToken
  }

  if (accessKey) {
    params.access_key = accessKey
  }

  const response = await api.get(`/public/surveys/${slug}/`, {
    params: Object.keys(params).length ? params : undefined,
    preserveAuthError: true,
  })
  return response.data
}

export async function submitPublicSurvey(slug, payload) {
  const response = await api.post(`/public/surveys/${slug}/`, payload, {
    preserveAuthError: true,
  })
  return response.data
}

export async function updatePublicSurvey(slug, payload) {
  const response = await api.put(`/public/surveys/${slug}/`, payload, {
    preserveAuthError: true,
  })
  return response.data
}

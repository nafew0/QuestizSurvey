import api from './api'

export async function listCollectors(surveyId) {
  const response = await api.get(`/surveys/${surveyId}/collectors/`)
  return response.data.results ?? response.data
}

export async function createCollector(surveyId, payload) {
  const response = await api.post(`/surveys/${surveyId}/collectors/`, payload)
  return response.data
}

export async function updateCollector(surveyId, collectorId, payload) {
  const response = await api.patch(
    `/surveys/${surveyId}/collectors/${collectorId}/`,
    payload
  )
  return response.data
}

export async function listCollectorInvitations(surveyId, collectorId) {
  const response = await api.get(
    `/surveys/${surveyId}/collectors/${collectorId}/invitations/`
  )
  return response.data
}

export async function sendCollectorEmails(surveyId, collectorId, payload) {
  const response = await api.post(
    `/surveys/${surveyId}/collectors/${collectorId}/send-emails/`,
    payload
  )
  return response.data
}

export async function sendCollectorReminders(surveyId, collectorId, payload = {}) {
  const response = await api.post(
    `/surveys/${surveyId}/collectors/${collectorId}/send-reminders/`,
    payload
  )
  return response.data
}

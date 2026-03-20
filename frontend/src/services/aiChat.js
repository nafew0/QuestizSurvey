import api from './api'

export async function getSurveyAIInsights(surveyId, filters = {}) {
  const response = await api.post(`/surveys/${surveyId}/ai/insights/`, { filters })
  return response.data
}

export async function getChatSessions(surveyId) {
  const response = await api.get(`/surveys/${surveyId}/ai/chats/`)
  return response.data
}

export async function createChatSession(surveyId) {
  const response = await api.post(`/surveys/${surveyId}/ai/chats/`, {})
  return response.data
}

export async function getChatSession(surveyId, sessionId) {
  const response = await api.get(`/surveys/${surveyId}/ai/chats/${sessionId}/`)
  return response.data
}

export async function sendChatMessage(surveyId, sessionId, message, filters = {}) {
  const response = await api.post(`/surveys/${surveyId}/ai/chats/${sessionId}/messages/`, {
    message,
    filters,
  })
  return response.data
}

export async function deleteChatSession(surveyId, sessionId) {
  await api.delete(`/surveys/${surveyId}/ai/chats/${sessionId}/`)
}

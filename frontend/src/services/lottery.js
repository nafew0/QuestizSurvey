import api from './api'

export async function fetchSurveyLottery(surveyId) {
  const response = await api.get(`/surveys/${surveyId}/lottery/`)
  return response.data
}

export async function updateSurveyLottery(surveyId, payload) {
  const response = await api.patch(`/surveys/${surveyId}/lottery/`, payload)
  return response.data
}

export async function drawSurveyLotteryWinner(surveyId, payload) {
  const response = await api.post(`/surveys/${surveyId}/lottery/draw/`, payload)
  return response.data
}

export async function resetSurveyLottery(surveyId) {
  const response = await api.post(`/surveys/${surveyId}/lottery/reset/`)
  return response.data
}

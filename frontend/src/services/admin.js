import api from './api'

function buildParams(params = {}) {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return
    }
    searchParams.set(key, value)
  })

  return searchParams
}

export async function getAdminDashboard() {
  const response = await api.get('/admin/dashboard/')
  return response.data
}

export async function getAdminUsers(params = {}) {
  const response = await api.get(`/admin/users/?${buildParams(params).toString()}`)
  return response.data
}

export async function getAdminUserDetail(userId) {
  const response = await api.get(`/admin/users/${userId}/`)
  return response.data
}

export async function updateAdminUser(userId, payload) {
  const response = await api.patch(`/admin/users/${userId}/`, payload)
  return response.data
}

export async function sendAdminPasswordReset(userId) {
  const response = await api.post(`/admin/users/${userId}/send-password-reset/`)
  return response.data
}

export async function getAdminPayments(params = {}) {
  const response = await api.get(`/admin/payments/?${buildParams(params).toString()}`)
  return response.data
}

export async function exportAdminPayments(params = {}) {
  const response = await api.get(`/admin/payments/export/?${buildParams(params).toString()}`, {
    responseType: 'blob',
  })
  return response.data
}

export async function getAdminSettings() {
  const response = await api.get('/admin/settings/')
  return response.data
}

export async function updateAdminSettings(payload) {
  const response = await api.patch('/admin/settings/', payload)
  return response.data
}

export async function testAdminAI(payload) {
  const response = await api.post('/admin/settings/test-ai/', payload)
  return response.data
}

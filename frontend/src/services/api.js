import axios from 'axios'

function resolveApiUrl() {
  const configuredUrl = import.meta.env.VITE_API_URL?.trim()
  if (!configuredUrl) {
    return '/api'
  }
  return configuredUrl.replace(/\/+$/, '')
}

export const API_URL = resolveApiUrl()

export function resolveApiAssetUrl(value) {
  if (!value) {
    return ''
  }

  if (
    /^https?:\/\//i.test(value) ||
    value.startsWith('data:') ||
    value.startsWith('blob:')
  ) {
    return value
  }

  const normalizedPath = value.startsWith('/') ? value : `/${value}`

  try {
    if (/^https?:\/\//i.test(API_URL)) {
      return new URL(normalizedPath, API_URL).toString()
    }
  } catch (error) {
    console.error('Failed to resolve API asset URL:', error)
  }

  return normalizedPath
}

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const accessToken = localStorage.getItem('accessToken')
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    const preserveAuthError = Boolean(originalRequest?.preserveAuthError)

    // If error is 401 and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        const refreshToken = localStorage.getItem('refreshToken')

        if (!refreshToken) {
          return Promise.reject(error)
        }

        // Try to refresh the token
        const response = await axios.post(
          `${API_URL}/auth/token/refresh/`,
          { refresh: refreshToken }
        )

        const { access } = response.data

        // Update stored token
        localStorage.setItem('accessToken', access)

        // Update the failed request with new token
        originalRequest.headers.Authorization = `Bearer ${access}`

        // Retry the original request
        return api(originalRequest)
      } catch (refreshError) {
        // Refresh failed, clear tokens and redirect to login
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        if (!preserveAuthError) {
          window.location.href = '/login'
          return Promise.reject(refreshError)
        }
        return Promise.reject(error)
      }
    }

    return Promise.reject(error)
  }
)

export default api

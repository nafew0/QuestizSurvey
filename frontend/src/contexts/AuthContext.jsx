/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useEffect, useContext } from 'react'
import api, {
  clearAccessToken,
  refreshAccessToken,
  setAccessToken,
} from '../services/api'

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Initialize auth state from the refresh cookie.
  useEffect(() => {
    const initializeAuth = async () => {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')

      try {
        await refreshAccessToken()
        const response = await api.get('/auth/user/')
        setUser(response.data)
      } catch (err) {
        clearAccessToken()
        setUser(null)
      }
      setLoading(false)
    }

    initializeAuth()
  }, [])

  const clearAuthState = () => {
    clearAccessToken()
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    setUser(null)
  }

  const extractErrorMessage = (err, fallbackMessage) => {
    const payload = err.response?.data

    if (typeof payload?.detail === 'string') {
      return payload.detail
    }

    if (typeof payload?.error === 'string') {
      return payload.error
    }

    if (typeof payload === 'string') {
      return payload
    }

    if (payload && typeof payload === 'object') {
      const firstValue = Object.values(payload)[0]

      if (Array.isArray(firstValue) && firstValue.length > 0) {
        return firstValue[0]
      }

      if (typeof firstValue === 'string') {
        return firstValue
      }
    }

    return fallbackMessage
  }

  // Login function
  const login = async (username, password) => {
    try {
      setError(null)
      const response = await api.post('/auth/login/', { username, password })

      const { user, access_token: accessToken } = response.data

      setAccessToken(accessToken)

      setUser(user)
      return { success: true, user }
    } catch (err) {
      const errorMessage = extractErrorMessage(err, 'Login failed')
      setError(errorMessage)
      return {
        success: false,
        error: errorMessage,
        emailVerificationRequired: Boolean(err.response?.data?.email_verification_required),
        emailHint: err.response?.data?.email_hint || '',
      }
    }
  }

  // Register function
  const register = async (userData) => {
    try {
      setError(null)
      const response = await api.post('/auth/register/', userData)

      const {
        user,
        access_token: accessToken,
        email_verification_required: emailVerificationRequired,
        email_hint: emailHint,
        message,
      } = response.data

      if (accessToken) {
        setAccessToken(accessToken)
        setUser(user)
      } else {
        clearAuthState()
      }

      return {
        success: true,
        user,
        message,
        emailVerificationRequired: Boolean(emailVerificationRequired),
        emailHint: emailHint || '',
      }
    } catch (err) {
      const errorMessage = extractErrorMessage(err, 'Registration failed')
      setError(errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  const resendVerificationEmail = async (identifier) => {
    try {
      setError(null)
      const response = await api.post('/auth/resend-verification-email/', { identifier })
      return {
        success: true,
        message: response.data?.detail || 'If an eligible account exists, a verification email will arrive shortly.',
      }
    } catch (err) {
      const errorMessage = extractErrorMessage(err, 'Could not resend verification email')
      setError(errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  // Logout function
  const logout = async () => {
    try {
      await api.post('/auth/logout/', {})
    } catch (err) {
      console.error('Logout error:', err)
    } finally {
      clearAuthState()
    }
  }

  // Update user function
  const updateUser = async (userData) => {
    try {
      setError(null)
      const isFormData = userData instanceof FormData
      const response = await api.patch('/auth/user/update/', userData, {
        headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
      })
      setUser(response.data)
      return { success: true, user: response.data }
    } catch (err) {
      const errorMessage = extractErrorMessage(err, 'Update failed')
      setError(errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  // Refresh user data
  const refreshUser = async () => {
    try {
      const response = await api.get('/auth/user/')
      setUser(response.data)
    } catch (err) {
      console.error('Failed to refresh user:', err)
    }
  }

  const value = {
    user,
    loading,
    error,
    login,
    register,
    resendVerificationEmail,
    logout,
    updateUser,
    refreshUser,
    isAuthenticated: !!user,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthContext

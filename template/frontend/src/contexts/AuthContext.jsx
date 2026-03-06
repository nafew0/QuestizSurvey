import { createContext, useState, useEffect, useContext } from 'react'
import api from '../services/api'

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

  // Initialize auth state from localStorage
  useEffect(() => {
    const initializeAuth = async () => {
      const accessToken = localStorage.getItem('accessToken')
      const refreshToken = localStorage.getItem('refreshToken')

      if (accessToken && refreshToken) {
        try {
          // Fetch user data
          const response = await api.get('/auth/user/')
          setUser(response.data)
        } catch (err) {
          console.error('Failed to fetch user:', err)
          // Clear invalid tokens
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
        }
      }
      setLoading(false)
    }

    initializeAuth()
  }, [])

  // Login function
  const login = async (username, password) => {
    try {
      setError(null)
      const response = await api.post('/auth/login/', { username, password })

      const { user, tokens } = response.data

      // Store tokens
      localStorage.setItem('accessToken', tokens.access)
      localStorage.setItem('refreshToken', tokens.refresh)

      setUser(user)
      return { success: true }
    } catch (err) {
      const errorMessage = err.response?.data?.detail || 'Login failed'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  // Register function
  const register = async (userData) => {
    try {
      setError(null)
      const response = await api.post('/auth/register/', userData)

      const { user, tokens } = response.data

      // Store tokens
      localStorage.setItem('accessToken', tokens.access)
      localStorage.setItem('refreshToken', tokens.refresh)

      setUser(user)
      return { success: true }
    } catch (err) {
      const errorMessage = err.response?.data?.username?.[0] ||
                          err.response?.data?.email?.[0] ||
                          err.response?.data?.password?.[0] ||
                          'Registration failed'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  // Logout function
  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken')
      if (refreshToken) {
        await api.post('/auth/logout/', { refresh_token: refreshToken })
      }
    } catch (err) {
      console.error('Logout error:', err)
    } finally {
      // Clear tokens and user state
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      setUser(null)
    }
  }

  // Update user function
  const updateUser = async (userData) => {
    try {
      setError(null)
      const response = await api.patch('/auth/user/update/', userData)
      setUser(response.data)
      return { success: true }
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Update failed'
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
    logout,
    updateUser,
    refreshUser,
    isAuthenticated: !!user,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthContext

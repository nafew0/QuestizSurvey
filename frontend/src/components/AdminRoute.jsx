import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from '@/contexts/AuthContext'

export default function AdminRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="theme-app-gradient flex min-h-screen items-center justify-center">
        <div className="theme-panel rounded-2xl px-5 py-4 text-sm font-medium text-muted-foreground">
          Loading admin workspace...
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    )
  }

  if (!user.can_access_admin) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

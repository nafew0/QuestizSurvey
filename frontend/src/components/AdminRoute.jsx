import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from '@/contexts/AuthContext'
import api from '@/services/api'

const GATE_CHECKING = 'checking'
const GATE_GRANTED = 'granted'
const GATE_DENIED = 'denied'

function AdminLoading() {
  return (
    <div className="theme-app-gradient flex min-h-screen items-center justify-center">
      <div className="theme-panel rounded-2xl px-5 py-4 text-sm font-medium text-muted-foreground">
        Loading admin workspace...
      </div>
    </div>
  )
}

export default function AdminRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [gateStatus, setGateStatus] = useState(GATE_CHECKING)

  useEffect(() => {
    if (loading) {
      return undefined
    }

    if (!user) {
      setGateStatus(GATE_DENIED)
      return undefined
    }

    let cancelled = false
    setGateStatus(GATE_CHECKING)

    api
      .get('/admin/_gate/', { preserveAuthError: true })
      .then((response) => {
        if (cancelled) return
        setGateStatus(response.status === 204 ? GATE_GRANTED : GATE_DENIED)
      })
      .catch(() => {
        if (cancelled) return
        setGateStatus(GATE_DENIED)
      })

    return () => {
      cancelled = true
    }
  }, [loading, user])

  if (loading || gateStatus === GATE_CHECKING) {
    return <AdminLoading />
  }

  if (!user) {
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    )
  }

  if (gateStatus !== GATE_GRANTED) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

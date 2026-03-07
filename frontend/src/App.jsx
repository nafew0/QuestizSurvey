import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './hooks/useToast'
import ProtectedRoute from './components/ProtectedRoute'
import Navbar from './components/Navbar'

const Home = lazy(() => import('./pages/Home'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Profile = lazy(() => import('./pages/Profile'))
const SurveyBuilder = lazy(() => import('./pages/surveys/SurveyBuilder'))
const SurveyPreviewPage = lazy(() => import('./pages/surveys/SurveyPreviewPage'))

function AppFallback() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-slate-50">
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-medium text-slate-600 shadow-lg shadow-slate-900/5">
        Loading workspace...
      </div>
    </div>
  )
}

function App() {
  const location = useLocation()
  const hideNavbar = location.pathname.includes('/preview')

  return (
    <AuthProvider>
      <ToastProvider>
        <div className="min-h-screen bg-background">
          {hideNavbar ? null : <Navbar />}
          <main>
            <Suspense fallback={<AppFallback />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/surveys"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/surveys/:surveyId/edit"
                  element={
                    <ProtectedRoute>
                      <SurveyBuilder />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/surveys/:surveyId/preview"
                  element={
                    <ProtectedRoute>
                      <SurveyPreviewPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  }
                />

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </main>
        </div>
      </ToastProvider>
    </AuthProvider>
  )
}

export default App

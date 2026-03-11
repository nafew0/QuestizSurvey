import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { SiteThemeProvider } from './contexts/SiteThemeContext'
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
const PublicSurveyPage = lazy(() => import('./pages/surveys/PublicSurveyPage'))
const SurveyDistributePage = lazy(() => import('./pages/surveys/SurveyDistributePage'))
const SurveyAnalyticsPage = lazy(() => import('./pages/surveys/SurveyAnalyticsPage'))
const SurveyLotteryPage = lazy(() => import('./pages/surveys/SurveyLotteryPage'))
const PublicReportPage = lazy(() => import('./pages/reports/PublicReportPage'))

function AppFallback() {
  return (
    <div className="theme-app-gradient flex min-h-[calc(100vh-4rem)] items-center justify-center">
      <div className="theme-panel rounded-2xl px-5 py-4 text-sm font-medium text-muted-foreground">
        Loading workspace...
      </div>
    </div>
  )
}

function App() {
  const location = useLocation()
  const isBuilderRoute = /^\/surveys\/[^/]+\/edit\/?$/.test(location.pathname)
  const isPublicSurveyRoute = /^\/s\/[^/]+\/?$/.test(location.pathname)
  const isPublicReportRoute = /^\/reports\/[^/]+\/?$/.test(location.pathname)
  const hideNavbar =
    location.pathname.includes('/preview') || isPublicSurveyRoute || isPublicReportRoute

  return (
    <AuthProvider>
      <SiteThemeProvider>
        <ToastProvider>
          <div className="min-h-screen bg-background">
            {hideNavbar ? null : <Navbar />}
            <main className={isBuilderRoute ? 'h-[calc(100dvh-4rem)] overflow-hidden overscroll-none' : undefined}>
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
                    path="/surveys/:surveyId/distribute"
                    element={
                      <ProtectedRoute>
                        <SurveyDistributePage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/surveys/:surveyId/analyze"
                    element={
                      <ProtectedRoute>
                        <SurveyAnalyticsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/surveys/:surveyId/analyze/responses"
                    element={
                      <ProtectedRoute>
                        <SurveyAnalyticsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/surveys/:surveyId/lottery"
                    element={
                      <ProtectedRoute>
                        <SurveyLotteryPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/s/:slug" element={<PublicSurveyPage />} />
                  <Route path="/reports/:reportId" element={<PublicReportPage />} />
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
      </SiteThemeProvider>
    </AuthProvider>
  )
}

export default App

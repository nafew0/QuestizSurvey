import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight, ClipboardList, Rocket, Shield } from "lucide-react"

const Home = () => {
  const { isAuthenticated, user } = useAuth()

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.16),_transparent_24%),radial-gradient(circle_at_bottom_right,_rgba(249,115,22,0.12),_transparent_30%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)]">
      <div className="container mx-auto px-4 py-16">
        <div className="mb-16 space-y-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 shadow-lg shadow-slate-900/5 backdrop-blur">
            Phase 2
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            Survey builder ready
          </div>
          <h1 className="text-5xl font-bold tracking-tight md:text-6xl">
            Shape research with <span className="text-primary">Questiz</span>
          </h1>
          <p className="mx-auto max-w-3xl text-xl leading-8 text-muted-foreground">
            Design multi-page surveys, add skip logic, and preview the respondent journey in a purpose-built builder powered by your Django API.
          </p>

          {isAuthenticated ? (
            <div className="space-y-4">
              <p className="text-lg">
                Welcome back, <strong>{user?.username}</strong>.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Link to="/dashboard">
                  <Button size="lg" className="rounded-2xl px-8 text-lg">
                    Open Survey Workspace
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link to="/profile">
                  <Button size="lg" variant="outline" className="rounded-2xl px-8 text-lg">
                    Manage Profile
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex justify-center gap-4">
              <Link to="/register">
                <Button size="lg" className="rounded-2xl px-8 text-lg">
                  Get Started
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline" className="rounded-2xl px-8 text-lg">
                  Login
                </Button>
              </Link>
            </div>
          )}
        </div>

        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
          <Card className="rounded-[2rem] border-white/70 bg-white/80 shadow-xl shadow-slate-900/5">
            <CardHeader>
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                <ClipboardList className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Survey Workspace</CardTitle>
              <CardDescription>
                Create surveys, organize pages, and move questions through a drag-and-drop builder shell.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="rounded-[2rem] border-white/70 bg-white/80 shadow-xl shadow-slate-900/5">
            <CardHeader>
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                <Rocket className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Preview Mode</CardTitle>
              <CardDescription>
                Test welcome screens, page progression, and skip logic paths before public launch.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="rounded-[2rem] border-white/70 bg-white/80 shadow-xl shadow-slate-900/5">
            <CardHeader>
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Authenticated Builder</CardTitle>
              <CardDescription>
                JWT-backed access, per-user survey ownership, and builder autosave against the Phase 1 API.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default Home

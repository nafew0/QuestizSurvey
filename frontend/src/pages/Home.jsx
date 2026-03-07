import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight, ClipboardList, Rocket, Shield } from "lucide-react"

const Home = () => {
  const { isAuthenticated, user } = useAuth()

  return (
    <div className="theme-app-gradient min-h-[calc(100vh-4rem)]">
      <div className="container mx-auto px-4 py-16">
        <div className="mb-16 space-y-6 text-center">
          <div className="theme-chip-secondary mx-auto w-fit items-center gap-2 shadow-sm">
            Phase 2
            <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--theme-secondary-rgb))]" />
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
          <Card className="theme-panel rounded-[2rem]">
            <CardHeader>
              <div className="theme-icon-primary mb-2 flex h-12 w-12 items-center justify-center rounded-2xl">
                <ClipboardList className="h-6 w-6" />
              </div>
              <CardTitle>Survey Workspace</CardTitle>
              <CardDescription>
                Create surveys, organize pages, and move questions through a drag-and-drop builder shell.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="theme-panel rounded-[2rem]">
            <CardHeader>
              <div className="theme-icon-secondary mb-2 flex h-12 w-12 items-center justify-center rounded-2xl">
                <Rocket className="h-6 w-6" />
              </div>
              <CardTitle>Preview Mode</CardTitle>
              <CardDescription>
                Test welcome screens, page progression, and skip logic paths before public launch.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="theme-panel rounded-[2rem]">
            <CardHeader>
              <div className="theme-icon-accent mb-2 flex h-12 w-12 items-center justify-center rounded-2xl">
                <Shield className="h-6 w-6" />
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

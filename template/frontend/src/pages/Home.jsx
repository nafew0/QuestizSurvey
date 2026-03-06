import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Code2, Rocket, Shield } from "lucide-react"

const Home = () => {
  const { isAuthenticated, user } = useAuth()

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="text-center space-y-6 mb-16">
        <h1 className="text-5xl font-bold tracking-tight">
          Welcome to <span className="text-primary">questizsurvey</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          A modern Django + React application with authentication powered by shadcn/ui
        </p>

        {isAuthenticated ? (
          <div className="space-y-4">
            <p className="text-lg">
              Welcome back, <strong>{user?.username}</strong>!
            </p>
            <Link to="/dashboard">
              <Button size="lg" className="text-lg px-8">
                Go to Dashboard
              </Button>
            </Link>
          </div>
        ) : (
          <div className="flex gap-4 justify-center">
            <Link to="/register">
              <Button size="lg" className="text-lg px-8">
                Get Started
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline" className="text-lg px-8">
                Login
              </Button>
            </Link>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        <Card>
          <CardHeader>
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
              <Code2 className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Django Backend</CardTitle>
            <CardDescription>
              Powerful REST API with JWT authentication and PostgreSQL database
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
              <Rocket className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>React Frontend</CardTitle>
            <CardDescription>
              Modern UI with React 19, Vite, Tailwind CSS, and shadcn/ui
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Ready to Use</CardTitle>
            <CardDescription>
              Complete authentication system with login, register, and profile management
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  )
}

export default Home

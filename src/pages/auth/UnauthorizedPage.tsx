import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { roleHomePath } from '@/components/auth/RouteGuards'

export function UnauthorizedPage() {
  const { firebaseUser, role } = useAuth()
  const destination = firebaseUser && role ? roleHomePath(role) : '/login'
  const label = firebaseUser && role ? 'Go to dashboard' : 'Return to sign in'

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center p-4">
      <ShieldAlert className="h-16 w-16 text-destructive" />
      <h1 className="text-3xl font-bold">Access Denied</h1>
      <p className="text-muted-foreground max-w-sm">
        You don&apos;t have permission to view this page. If you believe this is an error, contact your administrator.
      </p>
      <Button asChild>
        <Link to={destination}>{label}</Link>
      </Button>
    </div>
  )
}

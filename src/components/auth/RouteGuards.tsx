import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import type { UserRole } from '@/types'

interface RequireAuthProps {
  children: React.ReactNode
  allowedRoles?: UserRole[]
}

export function RequireAuth({ children, allowedRoles }: RequireAuthProps) {
  const { firebaseUser, roles, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="border-primary h-10 w-10 animate-spin rounded-full border-4 border-t-transparent" />
      </div>
    )
  }

  if (!firebaseUser) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Check if any of the user's roles satisfies the route requirement
  if (allowedRoles && !allowedRoles.some((r) => roles.includes(r))) {
    return <Navigate to="/unauthorized" replace />
  }

  return <>{children}</>
}

export function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const { firebaseUser, role, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="border-primary h-10 w-10 animate-spin rounded-full border-4 border-t-transparent" />
      </div>
    )
  }

  if (firebaseUser && role) {
    return <Navigate to={roleHomePath(role)} replace />
  }

  // Authed but role not resolved yet (e.g. Google redirect creating Firestore doc)
  if (firebaseUser && !role) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="border-primary h-10 w-10 animate-spin rounded-full border-4 border-t-transparent" />
      </div>
    )
  }

  return <>{children}</>
}

export function roleHomePath(role: UserRole): string {
  switch (role) {
    case 'super_admin':    return '/admin'
    case 'business_owner': return '/owner'
    case 'manager':        return '/manager'
    case 'tenant':         return '/tenant'
  }
}

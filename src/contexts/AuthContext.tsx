import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  type User,
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import type { AppUser, UserRole, CustomClaims } from '@/types'

interface AuthContextValue {
  firebaseUser: User | null
  appUser: AppUser | null
  claims: CustomClaims | null
  role: UserRole | null      // active/current role
  roles: UserRole[]          // all assigned roles
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signUp: (email: string, password: string, displayName: string) => Promise<void>
  logOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  refreshClaims: () => Promise<void>
  switchRole: (role: UserRole) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const ROLE_PRIORITY: UserRole[] = ['super_admin', 'business_owner', 'manager', 'tenant']

function highestRole(roleList: UserRole[]): UserRole {
  return ROLE_PRIORITY.find((r) => roleList.includes(r)) ?? 'tenant'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null)
  const [appUser, setAppUser] = useState<AppUser | null>(null)
  const [claims, setClaims] = useState<CustomClaims | null>(null)
  const [activeRole, setActiveRole] = useState<UserRole | null>(null)
  const [roles, setRoles] = useState<UserRole[]>([])
  const [loading, setLoading] = useState(true)

  async function loadUserData(user: User) {
    // Force refresh to get latest custom claims
    const tokenResult = await user.getIdTokenResult(true)
    const userClaims = tokenResult.claims as unknown as CustomClaims
    setClaims(userClaims)

    // Load AppUser from Firestore
    const userRef = doc(db, 'users', user.uid)
    const snap = await getDoc(userRef)
    if (snap.exists()) {
      const data = snap.data()
      const loadedUser = { id: snap.id, ...data } as AppUser
      setAppUser(loadedUser)

      // Resolve all roles (fall back to single role for legacy docs)
      const userRoles: UserRole[] = data.roles ?? [data.role as UserRole]
      setRoles(userRoles)

      // Restore persisted active role if still valid, otherwise pick highest
      const saved = localStorage.getItem('activeRole') as UserRole | null
      const active = saved && userRoles.includes(saved) ? saved : highestRole(userRoles)
      setActiveRole(active)
    }
  }

  function switchRole(newRole: UserRole) {
    setActiveRole(newRole)
    localStorage.setItem('activeRole', newRole)
  }

  async function refreshClaims() {
    if (!firebaseUser) return
    await loadUserData(firebaseUser)
  }

  useEffect(() => {
    // Handle redirect result from Google SSO
    getRedirectResult(auth).then(async (result) => {
      if (result?.user) {
        const userRef = doc(db, 'users', result.user.uid)
        const snap = await getDoc(userRef)
        if (!snap.exists()) {
          const now = serverTimestamp()
          await setDoc(userRef, {
            role: 'tenant' as UserRole,
            roles: ['tenant'] as UserRole[],
            displayName: result.user.displayName ?? '',
            email: result.user.email ?? '',
            createdAt: now,
            updatedAt: now,
          })
        }
        // Always reload user data after redirect — onAuthStateChanged may have
        // fired before the Firestore doc existed, leaving role=null
        await loadUserData(result.user)
      }
    }).catch(() => {})

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user)
      if (user) {
        await loadUserData(user)
      } else {
        setAppUser(null)
        setClaims(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  async function signIn(email: string, password: string) {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    await loadUserData(cred.user)
  }

  async function signInWithGoogle() {
    const provider = new GoogleAuthProvider()
    await signInWithRedirect(auth, provider)
    // Page will redirect to Google; result handled in useEffect via getRedirectResult
  }

  async function signUp(email: string, password: string, displayName: string) {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(cred.user, { displayName })

    // Create user document with default tenant role (owner registers through admin invite)
    const now = serverTimestamp()
    await setDoc(doc(db, 'users', cred.user.uid), {
      role: 'tenant' as UserRole,
      roles: ['tenant'] as UserRole[],
      displayName,
      email,
      createdAt: now,
      updatedAt: now,
    })

    await loadUserData(cred.user)
  }

  async function logOut() {
    await signOut(auth)
    localStorage.removeItem('activeRole')
    setFirebaseUser(null)
    setAppUser(null)
    setClaims(null)
    setActiveRole(null)
    setRoles([])
  }

  async function resetPassword(email: string) {
    await sendPasswordResetEmail(auth, email)
  }

  const role = activeRole ?? claims?.role ?? appUser?.role ?? null

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        appUser,
        claims,
        role,
        roles,
        loading,
        signIn,
        signInWithGoogle,
        signUp,
        logOut,
        resetPassword,
        refreshClaims,
        switchRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

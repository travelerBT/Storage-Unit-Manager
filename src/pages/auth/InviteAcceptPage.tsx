import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Warehouse } from 'lucide-react'
import type { UserRole } from '@/types'

const schema = z.object({
  displayName: z.string().min(2, 'Full name is required'),
  password:    z.string().min(6, 'Password must be at least 6 characters'),
  confirm:     z.string(),
}).refine((d) => d.password === d.confirm, {
  message: 'Passwords do not match',
  path: ['confirm'],
})
type FormValues = z.infer<typeof schema>

export function InviteAcceptPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('tenant')
  const [inviteBusinessId, setInviteBusinessId] = useState<string | undefined>()
  const [inviteFacilityIds, setInviteFacilityIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const { signUp, refreshClaims } = useAuth()
  const navigate = useNavigate()

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    async function validateToken() {
      if (!token) {
        toast.error('Invalid invite link.')
        void navigate('/login')
        return
      }
      try {
        const snap = await getDoc(doc(db, 'invites', token))
        if (!snap.exists() || snap.data().used) {
          toast.error('This invite link has expired or already been used.')
          void navigate('/login')
          return
        }
        const data = snap.data()
        setInviteEmail(data.email as string)
        setInviteRole((data.role as UserRole) ?? 'tenant')
        setInviteBusinessId(data.businessId as string | undefined)
        setInviteFacilityIds((data.facilityIds as string[]) ?? [])
      } catch {
        toast.error('Could not validate invite. Please contact your administrator.')
        void navigate('/login')
      } finally {
        setChecking(false)
      }
    }
    void validateToken()
  }, [token, navigate])

  async function onSubmit({ displayName, password }: FormValues) {
    setLoading(true)
    try {
      await signUp(inviteEmail, password, displayName)

      // Promote the user doc to the correct role so Firestore rules work immediately.
      // JWT claims are updated on next sign-in by the cloud function.
      const { auth: firebaseAuth } = await import('@/lib/firebase')
      const uid = firebaseAuth.currentUser?.uid
      if (uid && (inviteRole !== 'tenant' || inviteBusinessId)) {
        const updates: Record<string, unknown> = {
          role: inviteRole,
          updatedAt: serverTimestamp(),
        }
        if (inviteBusinessId) updates.businessId = inviteBusinessId
        if (inviteFacilityIds.length) updates.facilityIds = inviteFacilityIds
        await updateDoc(doc(db, 'users', uid), updates)
      }

      // Mark invite used
      if (token) {
        await updateDoc(doc(db, 'invites', token), { used: true })
      }

      await refreshClaims()
      toast.success('Account created! Welcome to SpotSlot.')
    } catch {
      toast.error('Could not create account. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Warehouse className="h-5 w-5" />
        </div>
        <span className="text-2xl font-bold tracking-tight">SpotSlot</span>
      </div>

      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">Accept invitation</CardTitle>
          <CardDescription>
            You&apos;ve been invited to join SpotSlot as <strong>{inviteEmail}</strong>
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="displayName">Full name</Label>
              <Input id="displayName" placeholder="Jane Smith" {...register('displayName')} />
              {errors.displayName && <p className="text-destructive text-xs">{errors.displayName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Create a password</Label>
              <Input id="password" type="password" {...register('password')} />
              {errors.password && <p className="text-destructive text-xs">{errors.password.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input id="confirm" type="password" {...register('confirm')} />
              {errors.confirm && <p className="text-destructive text-xs">{errors.confirm.message}</p>}
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Set up account
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}

import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { usersService, facilityService } from '@/lib/services'
import { callFunction } from '@/lib/firebase/functions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Mail, Phone, Building2, ShieldCheck, Save, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { updateDoc, doc, serverTimestamp, arrayUnion, arrayRemove } from 'firebase/firestore'
import { db } from '@/lib/firebase'

// ─── Types ───────────────────────────────────────────────────────────────────

interface SetRolePayload {
  uid: string
  role: string
  businessId: string
  facilityIds: string[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OwnerManagerDetailPage() {
  const { managerId } = useParams<{ managerId: string }>()
  const { appUser } = useAuth()
  const qc = useQueryClient()

  const { data: manager, isLoading } = useQuery({
    queryKey: ['user', managerId],
    queryFn: () => usersService.getById(managerId!),
    enabled: !!managerId,
  })

  const { data: facilities = [] } = useQuery({
    queryKey: ['facilities-business', appUser?.businessId],
    queryFn: () => facilityService.listByBusiness(appUser!.businessId!),
    enabled: !!appUser?.businessId,
  })

  // Local checked state mirrors manager's facilityIds; reset when manager loads
  const [selectedIds, setSelectedIds]     = useState<string[]>([])
  const [initializedFor, setInitializedFor] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  // One-time initialisation when manager data first arrives (avoid useEffect setState warning)
  if (manager && manager.id !== initializedFor) {
    setSelectedIds(manager.facilityIds ?? [])
    setInitializedFor(manager.id)
    setDirty(false)
  }

  function toggle(facilityId: string) {
    setSelectedIds((prev) =>
      prev.includes(facilityId) ? prev.filter((id) => id !== facilityId) : [...prev, facilityId],
    )
    setDirty(true)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!managerId || !appUser?.businessId) return

      const prev = manager?.facilityIds ?? []
      const added   = selectedIds.filter((id) => !prev.includes(id))
      const removed = prev.filter((id) => !selectedIds.includes(id))

      // 1. Update the manager's user doc
      await updateDoc(doc(db, 'users', managerId), {
        role:        'manager',
        businessId:  appUser.businessId,
        facilityIds: selectedIds,
        updatedAt:   serverTimestamp(),
      })

      // 2. Update each facility's managerIds array
      await Promise.all([
        ...added.map((id) =>
          updateDoc(doc(db, 'facilities', id), { managerIds: arrayUnion(managerId) }),
        ),
        ...removed.map((id) =>
          updateDoc(doc(db, 'facilities', id), { managerIds: arrayRemove(managerId) }),
        ),
      ])

      // 3. Try to update JWT claims via setUserRole callable (may fail if already set,
      //    but Firestore doc changes take effect immediately for rule enforcement).
      try {
        const setRole = callFunction<SetRolePayload, { success: boolean }>('setUserRole')
        await setRole({
          uid:         managerId,
          role:        'manager',
          businessId:  appUser.businessId,
          facilityIds: selectedIds,
        })
      } catch {
        // Non-fatal — Firestore rules fall back to user doc role
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['user', managerId] })
      void qc.invalidateQueries({ queryKey: ['users-business', appUser?.businessId] })
      facilities.forEach((f) => {
        void qc.invalidateQueries({ queryKey: ['facility', f.id] })
      })
      toast.success('Manager updated')
      setDirty(false)
    },
    onError: () => toast.error('Failed to save changes'),
  })

  const promoteToManagerMutation = useMutation({
    mutationFn: async () => {
      if (!managerId || !appUser?.businessId) return
      await updateDoc(doc(db, 'users', managerId), {
        role:       'manager',
        businessId: appUser.businessId,
        updatedAt:  serverTimestamp(),
      })
      try {
        const setRole = callFunction<SetRolePayload, { success: boolean }>('setUserRole')
        await setRole({ uid: managerId, role: 'manager', businessId: appUser.businessId, facilityIds: [] })
      } catch { /* non-fatal */ }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['user', managerId] })
      void qc.invalidateQueries({ queryKey: ['users-business', appUser?.businessId] })
      toast.success('User promoted to manager')
    },
    onError: () => toast.error('Failed to promote user'),
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    )
  }

  if (!manager) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">User not found.</p>
        <Button variant="link" asChild>
          <Link to="/owner/managers">Back to Managers</Link>
        </Button>
      </div>
    )
  }

  const initials = manager.displayName?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() ?? '?'
  const isManager = manager.role === 'manager'

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" asChild className="-ml-2 shrink-0">
          <Link to="/owner/managers"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex items-center gap-4 flex-1 flex-wrap">
          <Avatar className="h-12 w-12">
            <AvatarFallback className="text-sm">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{manager.displayName}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              {isManager ? (
                <Badge variant="outline" className="bg-emerald-100 text-emerald-800 text-xs">Manager</Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">{manager.role}</Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">

        {/* Contact info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-3.5 w-3.5 shrink-0" />{manager.email}
            </div>
            {manager.phone ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-3.5 w-3.5 shrink-0" />{manager.phone}
              </div>
            ) : (
              <p className="text-muted-foreground text-xs">No phone on file</p>
            )}
          </CardContent>
        </Card>

        {/* Promote card — shown if user isn't a manager yet */}
        {!isManager && (
          <Card className="border-amber-200 bg-amber-50 lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-amber-800">
                <ShieldCheck className="h-4 w-4" />Promote to Manager
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-amber-700">
                This user has the <strong>{manager.role}</strong> role. Promote them to manager to grant
                facility access and enable manager features.
              </p>
              <Button
                onClick={() => promoteToManagerMutation.mutate()}
                disabled={promoteToManagerMutation.isPending}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {promoteToManagerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Promote to Manager
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Facility assignment */}
        <Card className={isManager ? 'lg:col-span-2' : 'lg:col-span-2'}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />Facility Access
              </CardTitle>
              {dirty && (
                <Button
                  size="sm"
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending
                    ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Saving…</>
                    : <><Save className="mr-2 h-3.5 w-3.5" />Save Changes</>}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {facilities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No facilities found for your business.</p>
            ) : (
              <div className="space-y-3">
                {facilities.map((f, idx) => (
                  <div key={f.id}>
                    {idx > 0 && <Separator />}
                    <div className="flex items-start gap-3 pt-2">
                      <Checkbox
                        id={`facility-${f.id}`}
                        checked={selectedIds.includes(f.id)}
                        onCheckedChange={() => toggle(f.id)}
                        disabled={!isManager}
                      />
                      <label htmlFor={`facility-${f.id}`} className="cursor-pointer flex-1">
                        <p className="text-sm font-medium">{f.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {f.address}, {f.city}, {f.state} {f.zip}
                        </p>
                      </label>
                    </div>
                  </div>
                ))}
                {!isManager && (
                  <p className="text-xs text-muted-foreground pt-1">
                    Promote this user to manager first to assign facilities.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  )
}

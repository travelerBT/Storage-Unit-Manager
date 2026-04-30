import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { usersService, facilityService } from '@/lib/services'
import { callFunction } from '@/lib/firebase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Mail, Phone, Building2, UserPlus, Copy, Check, ChevronRight, ArrowLeft, Loader2 } from 'lucide-react'
import { doc, setDoc, updateDoc, serverTimestamp, arrayUnion, arrayRemove } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { toast } from 'sonner'

type ManagerUser = {
  id: string
  displayName?: string
  email?: string
  phone?: string
  role?: string
  roles?: string[]
  businessId?: string
  facilityIds?: string[]
}

interface SetRolePayload {
  uid: string
  role: string
  businessId: string
  facilityIds: string[]
}

type DialogStep = 'select' | 'facilities' | 'link'

export function ManagersPage() {
  const { appUser } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()

  // Dialog state
  const [open, setOpen]                           = useState(false)
  const [step, setStep]                           = useState<DialogStep>('select')
  const [tab, setTab]                             = useState<'existing' | 'new'>('existing')
  const [inviteEmail, setInviteEmail]             = useState('')
  const [targetManager, setTargetManager]         = useState<ManagerUser | null>(null)
  const [selectedFacilityIds, setSelectedFacilityIds] = useState<string[]>([])
  const [inviteLink, setInviteLink]               = useState<string | null>(null)
  const [copied, setCopied]                       = useState(false)
  const [checking, setChecking]                   = useState(false)

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users-business', appUser?.businessId],
    queryFn: () => usersService.listByBusiness(appUser!.businessId!),
    enabled: !!appUser?.businessId,
  })

  const { data: facilities = [] } = useQuery({
    queryKey: ['facilities-business', appUser?.businessId],
    queryFn: () => facilityService.listByBusiness(appUser!.businessId!),
    enabled: !!appUser?.businessId,
  })

  const managers = users.filter((u) =>
    u.role === 'manager' || (u.roles ?? []).includes('manager'),
  )
  const facilityMap = Object.fromEntries(facilities.map((f) => [f.id, f.name]))

  function openDialog() {
    setStep('select')
    setTab(managers.length > 0 ? 'existing' : 'new')
    setInviteEmail('')
    setTargetManager(null)
    setSelectedFacilityIds([])
    setInviteLink(null)
    setCopied(false)
    setOpen(true)
  }

  function closeDialog() {
    setOpen(false)
  }

  function selectExistingManager(m: ManagerUser) {
    setTargetManager(m)
    setSelectedFacilityIds(m.facilityIds ?? [])
    setStep('facilities')
  }

  async function handleEmailContinue() {
    const email = inviteEmail.trim()
    if (!email || !appUser?.businessId) return
    setChecking(true)
    try {
      const existing = users.find((u) => u.email === email)
      if (existing) {
        setTargetManager(existing)
        setSelectedFacilityIds(existing.facilityIds ?? [])
        toast.info(`Found account for ${email} — assign facilities below.`)
      } else {
        setTargetManager(null)
        setSelectedFacilityIds([])
      }
      setStep('facilities')
    } finally {
      setChecking(false)
    }
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!targetManager || !appUser?.businessId) return
      const prev    = targetManager.facilityIds ?? []
      const added   = selectedFacilityIds.filter((id: string) => !prev.includes(id))
      const removed = prev.filter((id: string) => !selectedFacilityIds.includes(id))

      await updateDoc(doc(db, 'users', targetManager.id), {
        role:        'manager',
        roles:       ['manager'],
        businessId:  appUser.businessId,
        facilityIds: selectedFacilityIds,
        updatedAt:   serverTimestamp(),
      })

      await Promise.all([
        ...added.map((id: string) =>
          updateDoc(doc(db, 'facilities', id), { managerIds: arrayUnion(targetManager.id) }),
        ),
        ...removed.map((id: string) =>
          updateDoc(doc(db, 'facilities', id), { managerIds: arrayRemove(targetManager.id) }),
        ),
      ])

      try {
        const setRole = callFunction<SetRolePayload, { success: boolean }>('setUserRole')
        await setRole({
          uid:         targetManager.id,
          role:        'manager',
          businessId:  appUser.businessId,
          facilityIds: selectedFacilityIds,
        })
      } catch { /* non-fatal */ }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users-business', appUser?.businessId] })
      facilities.forEach((f) => void qc.invalidateQueries({ queryKey: ['facility', f.id] }))
      toast.success('Facility assignments saved')
      closeDialog()
    },
    onError: () => toast.error('Failed to save assignments'),
  })

  async function handleGenerateInvite() {
    if (!inviteEmail.trim() || !appUser?.businessId) return
    setChecking(true)
    try {
      const token = crypto.randomUUID()
      await setDoc(doc(db, 'invites', token), {
        email:       inviteEmail.trim(),
        role:        'manager',
        businessId:  appUser.businessId,
        facilityIds: selectedFacilityIds,
        used:        false,
        createdAt:   serverTimestamp(),
      })
      void qc.invalidateQueries({ queryKey: ['users-business', appUser.businessId] })
      setInviteLink(`${window.location.origin}/invite?token=${token}`)
      setStep('link')
    } catch {
      toast.error('Failed to create invite. Please try again.')
    } finally {
      setChecking(false)
    }
  }

  function handleCopy() {
    if (!inviteLink) return
    void navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    toast.success('Invite link copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  function toggleFacility(id: string) {
    setSelectedFacilityIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const dialogTitle =
    step === 'select'     ? 'Add Manager' :
    step === 'facilities' ? 'Assign Facilities' :
    'Invite Link'

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Managers</h1>
          <p className="text-muted-foreground text-sm">
            {isLoading ? '…' : `${managers.length} manager${managers.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button onClick={openDialog}>
          <UserPlus className="mr-2 h-4 w-4" />Add Manager
        </Button>
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {managers.map((m) => {
          const initials = m.displayName?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() ?? '?'
          const assignedNames = (m.facilityIds ?? []).map((id: string) => facilityMap[id]).filter(Boolean)
          return (
            <Card
              key={m.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => void navigate(`/owner/managers/${m.id}`)}
            >
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium leading-tight">{m.displayName}</p>
                      <Badge variant="outline" className="bg-emerald-100 text-emerald-800 text-xs mt-0.5">
                        Manager
                      </Badge>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                </div>
                <div className="space-y-1 text-sm">
                  <div className="text-muted-foreground flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{m.email}</span>
                  </div>
                  {m.phone && (
                    <div className="text-muted-foreground flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 shrink-0" />{m.phone}
                    </div>
                  )}
                </div>
                <div className="text-muted-foreground text-xs flex items-center gap-1.5">
                  <Building2 className="h-3 w-3 shrink-0" />
                  {assignedNames.length === 0 ? 'No facilities assigned' : assignedNames.join(', ')}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  asChild
                  onClick={(e) => e.stopPropagation()}
                >
                  <Link to={`/owner/managers/${m.id}`}>View Details</Link>
                </Button>
              </CardContent>
            </Card>
          )
        })}
        {!isLoading && managers.length === 0 && (
          <div className="col-span-full text-muted-foreground py-12 text-center text-sm">
            No managers yet. Click <strong>Add Manager</strong> to invite one.
          </div>
        )}
      </div>

      {/* Add Manager Dialog */}
      <Dialog open={open} onOpenChange={(o) => { if (!o) closeDialog() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {step !== 'select' && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 -ml-1 shrink-0"
                  onClick={() => setStep('select')}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
              )}
              {dialogTitle}
            </DialogTitle>
          </DialogHeader>

          {/* Step 1 — select mode */}
          {step === 'select' && (
            <Tabs value={tab} onValueChange={(v) => setTab(v as 'existing' | 'new')} className="pt-1">
              <TabsList className="w-full">
                <TabsTrigger value="existing" className="flex-1" disabled={managers.length === 0}>
                  Existing Manager
                </TabsTrigger>
                <TabsTrigger value="new" className="flex-1">Invite New</TabsTrigger>
              </TabsList>

              <TabsContent value="existing" className="pt-3">
                <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                  {managers.map((m) => {
                    const initials = m.displayName?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() ?? '?'
                    const count = (m.facilityIds ?? []).length
                    return (
                      <button
                        key={m.id}
                        type="button"
                        className="w-full flex items-center gap-3 rounded-lg border p-3 text-left hover:bg-accent transition-colors"
                        onClick={() => selectExistingManager(m)}
                      >
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{m.displayName}</p>
                          <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {count} {count === 1 ? 'facility' : 'facilities'}
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      </button>
                    )
                  })}
                </div>
              </TabsContent>

              <TabsContent value="new" className="space-y-4 pt-3">
                <p className="text-sm text-muted-foreground">
                  Enter the email address. If they already have an account they'll be set up directly;
                  otherwise an invite link will be generated.
                </p>
                <div className="space-y-1.5">
                  <Label>Email address</Label>
                  <Input
                    type="email"
                    placeholder="manager@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleEmailContinue() }}
                    autoFocus
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleEmailContinue}
                  disabled={!inviteEmail.trim() || checking}
                >
                  {checking
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Checking…</>
                    : 'Continue'}
                </Button>
              </TabsContent>
            </Tabs>
          )}

          {/* Step 2 — facility assignment */}
          {step === 'facilities' && (
            <div className="space-y-4 pt-1">
              <div>
                <p className="text-sm font-medium">
                  {targetManager ? (targetManager.displayName ?? targetManager.email) : inviteEmail}
                </p>
                <p className="text-xs text-muted-foreground">
                  {targetManager
                    ? 'Select the facilities this manager can access.'
                    : 'Select facilities to pre-assign when they accept the invite.'}
                </p>
              </div>

              {facilities.length === 0 ? (
                <p className="text-sm text-muted-foreground">No facilities found. Add facilities first.</p>
              ) : (
                <div className="space-y-0.5 max-h-64 overflow-y-auto pr-1">
                  {facilities.map((f, i) => (
                    <div key={f.id}>
                      {i > 0 && <Separator />}
                      <div className="flex items-start gap-3 py-2.5">
                        <Checkbox
                          id={`fac-${f.id}`}
                          checked={selectedFacilityIds.includes(f.id)}
                          onCheckedChange={() => toggleFacility(f.id)}
                        />
                        <label htmlFor={`fac-${f.id}`} className="cursor-pointer flex-1">
                          <p className="text-sm font-medium">{f.name}</p>
                          <p className="text-xs text-muted-foreground">{f.city}, {f.state}</p>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {targetManager ? (
                <Button
                  className="w-full"
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>
                    : 'Save Assignments'}
                </Button>
              ) : (
                <Button
                  className="w-full"
                  onClick={handleGenerateInvite}
                  disabled={checking}
                >
                  {checking
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</>
                    : 'Generate Invite Link'}
                </Button>
              )}
            </div>
          )}

          {/* Step 3 — invite link */}
          {step === 'link' && (
            <div className="space-y-4 pt-1">
              <p className="text-sm text-muted-foreground">
                Share this link with <strong>{inviteEmail}</strong>.
                {selectedFacilityIds.length > 0
                  ? ` They'll be assigned to ${selectedFacilityIds.length} facilit${selectedFacilityIds.length === 1 ? 'y' : 'ies'} automatically when they register.`
                  : ' They can be assigned to facilities after they register.'}
              </p>
              <div className="flex items-center gap-2">
                <Input readOnly value={inviteLink ?? ''} className="text-xs font-mono" />
                <Button size="icon" variant="outline" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <Button variant="outline" className="w-full" onClick={closeDialog}>
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

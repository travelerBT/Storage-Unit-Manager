import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { usersService, facilityService } from '@/lib/services'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Mail, Phone, Building2, UserPlus, Copy, Check, ChevronRight } from 'lucide-react'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { toast } from 'sonner'

export function ManagersPage() {
  const { appUser } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [inviteOpen, setInviteOpen]   = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteLink, setInviteLink]   = useState<string | null>(null)
  const [copied, setCopied]           = useState(false)
  const [inviting, setInviting]       = useState(false)

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

  const managers = users.filter((u) => u.role === 'manager')
  const facilityMap = Object.fromEntries(facilities.map((f) => [f.id, f.name]))

  async function handleInvite() {
    if (!inviteEmail.trim() || !appUser?.businessId) return
    setInviting(true)
    try {
      const existing = users.find((u) => u.email === inviteEmail.trim())
      if (existing) {
        toast.info(
          existing.role === 'manager'
            ? 'That email is already a manager. Opening their profile.'
            : 'User found. Open their profile to assign facilities and promote to manager.',
        )
        setInviteOpen(false)
        void navigate(`/owner/managers/${existing.id}`)
        return
      }
      const token = crypto.randomUUID()
      await setDoc(doc(db, 'invites', token), {
        email:      inviteEmail.trim(),
        role:       'manager',
        businessId: appUser.businessId,
        used:       false,
        createdAt:  serverTimestamp(),
      })
      void qc.invalidateQueries({ queryKey: ['users-business', appUser.businessId] })
      setInviteLink(`${window.location.origin}/invite?token=${token}`)
    } catch {
      toast.error('Failed to create invite. Please try again.')
    } finally {
      setInviting(false)
    }
  }

  function handleCopy() {
    if (!inviteLink) return
    void navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    toast.success('Invite link copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  function resetDialog() {
    setInviteEmail('')
    setInviteLink(null)
    setCopied(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Managers</h1>
          <p className="text-muted-foreground text-sm">
            {isLoading ? '…' : `${managers.length} manager${managers.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button onClick={() => { resetDialog(); setInviteOpen(true) }}>
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
          const initials = m.displayName?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() ?? '?'
          const assignedNames = (m.facilityIds ?? []).map((id) => facilityMap[id]).filter(Boolean)
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

      {/* Invite Manager dialog */}
      <Dialog open={inviteOpen} onOpenChange={(o) => { setInviteOpen(o); if (!o) resetDialog() }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Manager</DialogTitle>
          </DialogHeader>

          {!inviteLink ? (
            <div className="space-y-4 pt-1">
              <p className="text-sm text-muted-foreground">
                Enter the manager's email. If they already have an account you'll be taken to their profile
                to assign facilities. Otherwise an invite link will be generated.
              </p>
              <div className="space-y-1.5">
                <Label>Email address</Label>
                <Input
                  type="email"
                  placeholder="manager@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleInvite() }}
                />
              </div>
              <Button
                className="w-full"
                onClick={handleInvite}
                disabled={!inviteEmail.trim() || inviting}
              >
                {inviting ? 'Checking…' : 'Continue'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4 pt-1">
              <p className="text-sm text-muted-foreground">
                Share this link with the manager. Once they register, open their profile to assign facilities
                and activate their manager access.
              </p>
              <div className="flex items-center gap-2">
                <Input readOnly value={inviteLink} className="text-xs font-mono" />
                <Button size="icon" variant="outline" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <Button variant="outline" className="w-full" onClick={() => { setInviteOpen(false); resetDialog() }}>
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

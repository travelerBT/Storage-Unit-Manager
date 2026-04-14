import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { tenantService, usersService } from '@/lib/services'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Search, UserPlus, Copy, Check } from 'lucide-react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { toast } from 'sonner'
import type { TenantStatus } from '@/types'

const STATUS_OPTIONS: { value: TenantStatus | 'all'; label: string }[] = [
  { value: 'all',        label: 'All Statuses' },
  { value: 'active',     label: 'Active' },
  { value: 'delinquent', label: 'Delinquent' },
  { value: 'pending',    label: 'Pending' },
  { value: 'moved_out',  label: 'Moved Out' },
]

export function OwnerTenantsPage() {
  const { appUser } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState<TenantStatus | 'all'>('all')
  const [inviteOpen, setInviteOpen]     = useState(false)
  const [inviteEmail, setInviteEmail]   = useState('')
  const [inviteLink, setInviteLink]     = useState<string | null>(null)
  const [copied, setCopied]             = useState(false)
  const [inviting, setInviting]         = useState(false)

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['tenants-business', appUser?.businessId],
    queryFn: () => tenantService.listByBusiness(appUser!.businessId!),
    enabled: !!appUser?.businessId,
  })

  const tenantUserIds = tenants.map((t) => t.userId)

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users-by-ids', tenantUserIds.join(',')],
    queryFn: async () => {
      const results = await Promise.all(tenantUserIds.map((id) => usersService.getById(id)))
      return results.filter(Boolean) as Awaited<ReturnType<typeof usersService.getById>>[]
    },
    enabled: tenantUserIds.length > 0,
  })

  const userMap = Object.fromEntries((allUsers.filter(Boolean) as NonNullable<(typeof allUsers)[number]>[]).map((u) => [u.id, u]))

  const filtered = tenants.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false
    if (!search) return true
    const user = userMap[t.userId]
    const name = (user?.displayName ?? '').toLowerCase()
    const email = (user?.email ?? '').toLowerCase()
    const q = search.toLowerCase()
    return name.includes(q) || email.includes(q)
  })

  const activeCount    = tenants.filter((t) => t.status === 'active').length
  const delinquentCount = tenants.filter((t) => t.status === 'delinquent').length

  async function handleInvite() {
    if (!inviteEmail.trim() || !appUser?.businessId) return
    setInviting(true)
    try {
      // Check if the user already has an account
      const existing = allUsers.filter(Boolean).find((u) => u!.email === inviteEmail.trim())
      if (existing) {
        // Already registered — navigate directly to their tenant detail if a tenant doc exists
        const existingTenant = tenants.find((t) => t.userId === existing.id)
        if (existingTenant) {
          toast.info('That email already has a tenant profile. Opening their details.')
          setInviteOpen(false)
          void navigate(`/owner/tenants/${existingTenant.id}`)
          return
        }
        toast.info('User found. They can now be assigned to a unit from the unit detail page.')
        setInviteOpen(false)
        return
      }
      // Create invite doc
      const token = crypto.randomUUID()
      await setDoc(doc(db, 'invites', token), {
        email:      inviteEmail.trim(),
        role:       'tenant',
        businessId: appUser.businessId,
        used:       false,
        createdAt:  serverTimestamp(),
      })
      void qc.invalidateQueries({ queryKey: ['tenants-business', appUser.businessId] })
      const link = `${window.location.origin}/invite?token=${token}`
      setInviteLink(link)
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

  function resetInviteDialog() {
    setInviteEmail('')
    setInviteLink(null)
    setCopied(false)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tenants</h1>
          <p className="text-muted-foreground text-sm">
            {tenants.length} total
            {activeCount > 0     && ` · ${activeCount} active`}
            {delinquentCount > 0 && ` · ${delinquentCount} delinquent`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {delinquentCount > 0 && (
            <Badge variant="destructive">{delinquentCount} overdue</Badge>
          )}
          <Button onClick={() => { resetInviteDialog(); setInviteOpen(true) }}>
            <UserPlus className="mr-2 h-4 w-4" />Add Tenant
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
          <Input
            placeholder="Search by name or email…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as TenantStatus | 'all')}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tenant</TableHead>
              <TableHead>Units</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Move-in</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell>
                </TableRow>
              ))
            )}
            {!isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground text-center py-12">
                  {search || statusFilter !== 'all' ? 'No tenants match your filters.' : 'No tenants yet.'}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((t) => {
              const user = userMap[t.userId]
              const initials = user?.displayName
                ?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() ?? '?'
              return (
                <TableRow
                  key={t.id}
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() => void navigate(`/owner/tenants/${t.id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{user?.displayName ?? t.userId}</div>
                        <div className="text-muted-foreground text-xs">{user?.email ?? '—'}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {t.unitIds.length} unit{t.unitIds.length !== 1 ? 's' : ''}
                  </TableCell>
                  <TableCell><StatusBadge status={t.status} /></TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {t.moveInDate?.toDate().toLocaleDateString() ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" asChild onClick={(e) => e.stopPropagation()}>
                      <Link to={`/owner/tenants/${t.id}`}>View</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Invite Tenant dialog */}
      <Dialog open={inviteOpen} onOpenChange={(o) => { setInviteOpen(o); if (!o) resetInviteDialog() }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Tenant</DialogTitle>
          </DialogHeader>

          {!inviteLink ? (
            <div className="space-y-4 pt-1">
              <p className="text-sm text-muted-foreground">
                Enter the tenant's email. If they already have an account you'll be directed to their profile.
                Otherwise an invite link will be generated for them to register.
              </p>
              <div className="space-y-1.5">
                <Label>Email address</Label>
                <Input
                  type="email"
                  placeholder="tenant@example.com"
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
                Share this link with the tenant. They'll create their account and appear in your tenant list
                once assigned to a unit.
              </p>
              <div className="flex items-center gap-2">
                <Input readOnly value={inviteLink} className="text-xs font-mono" />
                <Button size="icon" variant="outline" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <Button variant="outline" className="w-full" onClick={() => { setInviteOpen(false); resetInviteDialog() }}>
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { tenantService, usersService, leaseService, unitService, invoiceService } from '@/lib/services'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Mail, Phone, Calendar } from 'lucide-react'

export function TenantDetailPage() {
  const { tenantId } = useParams<{ tenantId: string }>()

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['tenant', tenantId],
    queryFn: () => tenantService.getById(tenantId!),
    enabled: !!tenantId,
  })
  const { data: allUsers = [] } = useQuery({
    queryKey: ['users-all'],
    queryFn: () => usersService.listAll(),
  })
  const { data: leases = [] } = useQuery({
    queryKey: ['leases-tenant', tenantId],
    queryFn: () => leaseService.listByTenant(tenantId!),
    enabled: !!tenantId,
  })
  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices-tenant', tenantId],
    queryFn: () => invoiceService.listByTenant(tenantId!),
    enabled: !!tenantId,
  })
  const { data: units = [] } = useQuery({
    queryKey: ['units-tenant', tenantId],
    queryFn: async () => {
      if (!tenant) return []
      return Promise.all(tenant.unitIds.map((id) => unitService.getById(id)))
    },
    enabled: !!tenant,
  })

  const user = allUsers.find((u) => u.id === tenant?.userId)

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-40 w-full" /></div>
  if (!tenant) return <p className="text-muted-foreground">Tenant not found.</p>

  const activeLease = leases.find((l) => l.status === 'active')
  const overdueTotal = invoices.filter((i) => i.status === 'overdue').reduce((s, i) => s + i.totalDue, 0)

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/manager/tenants"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{user?.displayName ?? tenantId}</h1>
          <p className="text-muted-foreground text-sm">Tenant profile</p>
        </div>
        <StatusBadge status={tenant.status} className="ml-auto" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Contact Info</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {user?.email && <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-3.5 w-3.5" />{user.email}</div>}
            {user?.phone && <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3.5 w-3.5" />{user.phone}</div>}
            {tenant.moveInDate && <div className="flex items-center gap-2 text-muted-foreground"><Calendar className="h-3.5 w-3.5" />Moved in {tenant.moveInDate.toDate().toLocaleDateString()}</div>}
            {tenant.emergencyContact && (
              <>
                <Separator />
                <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Emergency Contact</p>
                <p>{tenant.emergencyContact.name} — {tenant.emergencyContact.relationship}</p>
                <p className="text-muted-foreground">{tenant.emergencyContact.phone}</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Financial Summary</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Active Lease" value={activeLease ? `$${activeLease.monthlyRent}/mo` : 'No active lease'} />
            <Row label="Total Invoices" value={invoices.length.toString()} />
            <Row label="Overdue Balance" value={`$${overdueTotal.toLocaleString()}`} className={overdueTotal > 0 ? 'text-red-600' : 'text-emerald-600'} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Units</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {units.filter(Boolean).map((u) => u && (
              <div key={u.id} className="flex items-center justify-between">
                <Link to={`/manager/units/${u.id}`} className="text-primary hover:underline">Unit {u.unitNumber}</Link>
                <StatusBadge status={u.status} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Recent Invoices</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {invoices.slice(0, 5).map((inv) => (
              <div key={inv.id} className="flex items-center justify-between">
                <span className="font-mono text-xs text-muted-foreground">{inv.invoiceNumber}</span>
                <div className="flex items-center gap-2">
                  <span>${inv.totalDue.toLocaleString()}</span>
                  <StatusBadge status={inv.status} />
                </div>
              </div>
            ))}
            {invoices.length === 0 && <p className="text-muted-foreground text-xs">No invoices</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${className ?? ''}`}>{value}</span>
    </div>
  )
}

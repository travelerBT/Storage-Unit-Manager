import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  tenantService, usersService, unitService, facilityService,
  invoiceService, leaseService,
} from '@/lib/services'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft, Mail, Phone, Calendar, Building2, Warehouse, DollarSign, Receipt,
} from 'lucide-react'
import type { Invoice, Unit, Facility } from '@/types'

// ─── Component ────────────────────────────────────────────────────────────────

export function OwnerTenantDetailPage() {
  const { tenantId } = useParams<{ tenantId: string }>()

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['tenant', tenantId],
    queryFn: () => tenantService.getById(tenantId!),
    enabled: !!tenantId,
  })

  const { data: user } = useQuery({
    queryKey: ['user', tenantId],
    queryFn: () => usersService.getById(tenantId!),
    enabled: !!tenantId,
  })

  const { data: units = [] } = useQuery({
    queryKey: ['units-tenant', tenantId],
    queryFn: async () => {
      if (!tenant?.unitIds.length) return []
      const results = await Promise.all(tenant.unitIds.map((id) => unitService.getById(id)))
      return results.filter(Boolean) as Unit[]
    },
    enabled: !!tenant,
  })

  // Collect unique facilityIds from units
  const facilityIds = [...new Set(units.map((u) => u.facilityId))]

  const { data: facilities = [] } = useQuery({
    queryKey: ['facilities-tenant-detail', tenantId, facilityIds.join(',')],
    queryFn: async () => {
      const results = await Promise.all(facilityIds.map((id) => facilityService.getById(id)))
      return results.filter(Boolean) as Facility[]
    },
    enabled: facilityIds.length > 0,
  })

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices-tenant', tenantId],
    queryFn: () => invoiceService.listByTenant(tenantId!),
    enabled: !!tenantId,
  })

  const { data: leases = [] } = useQuery({
    queryKey: ['leases-tenant', tenantId],
    queryFn: () => leaseService.listByTenant(tenantId!),
    enabled: !!tenantId,
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">Tenant not found.</p>
        <Button variant="link" asChild>
          <Link to="/owner/tenants">Back to Tenants</Link>
        </Button>
      </div>
    )
  }

  const facilityMap = Object.fromEntries(facilities.map((f) => [f.id, f]))
  const unitsByFacility = units.reduce<Record<string, Unit[]>>((acc, u) => {
    if (!acc[u.facilityId]) acc[u.facilityId] = []
    acc[u.facilityId].push(u)
    return acc
  }, {})

  const activeLeases   = leases.filter((l) => l.status === 'active')
  const totalBilled    = invoices.reduce((s, i) => s + i.totalDue, 0)
  const totalPaid      = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + (i.paidAmount ?? i.totalDue), 0)
  const outstanding    = invoices.filter((i) => ['pending', 'overdue', 'partial'].includes(i.status)).reduce((s, i) => s + i.totalDue, 0)
  const overdueBalance = invoices.filter((i) => i.status === 'overdue').reduce((s, i) => s + i.totalDue, 0)

  const displayName = user?.displayName ?? user?.email ?? tenantId!

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" asChild className="-ml-2 shrink-0">
          <Link to="/owner/tenants"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">{displayName}</h1>
            <StatusBadge status={tenant.status} />
          </div>
          <div className="flex items-center gap-4 mt-1 flex-wrap">
            {user?.email && (
              <span className="text-muted-foreground text-sm flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />{user.email}
              </span>
            )}
            {user?.phone && (
              <span className="text-muted-foreground text-sm flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" />{user.phone}
              </span>
            )}
            {tenant.moveInDate && (
              <span className="text-muted-foreground text-sm flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Since {tenant.moveInDate.toDate().toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Warehouse className="h-4 w-4 text-muted-foreground" />}
          label="Active Units"
          value={units.length.toString()}
        />
        <StatCard
          icon={<Building2 className="h-4 w-4 text-muted-foreground" />}
          label="Facilities"
          value={facilityIds.length.toString()}
        />
        <StatCard
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
          label="Monthly Rent"
          value={`$${activeLeases.reduce((s, l) => s + l.monthlyRent, 0).toLocaleString()}`}
        />
        <StatCard
          icon={<Receipt className="h-4 w-4 text-muted-foreground" />}
          label="Outstanding"
          value={`$${outstanding.toLocaleString()}`}
          valueClass={overdueBalance > 0 ? 'text-destructive' : undefined}
        />
      </div>

      {/* Units grouped by facility */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Warehouse className="h-4 w-4 text-muted-foreground" />Units
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {facilityIds.length === 0 && (
            <p className="text-sm text-muted-foreground">No units assigned.</p>
          )}
          {facilityIds.map((fid, idx) => {
            const facility = facilityMap[fid]
            const facilityUnits = unitsByFacility[fid] ?? []
            return (
              <div key={fid}>
                {idx > 0 && <Separator className="mb-4" />}
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {facility?.name ?? fid}
                  </span>
                  {facility && (
                    <span className="text-xs text-muted-foreground">
                      {facility.city}, {facility.state}
                    </span>
                  )}
                  <Badge variant="secondary" className="text-xs ml-auto">
                    {facilityUnits.length} unit{facilityUnits.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
                <div className="space-y-1.5 pl-5">
                  {facilityUnits.map((u) => (
                    <div key={u.id} className="flex items-center justify-between text-sm">
                      <Link
                        to={`/owner/facilities/${fid}/units/${u.id}`}
                        className="text-primary hover:underline font-medium"
                      >
                        Unit {u.unitNumber}{u.building ? ` (${u.building})` : ''}
                      </Link>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground text-xs">
                          ${u.pricePerMonth.toLocaleString()}/mo
                        </span>
                        <StatusBadge status={u.status} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Financial summary */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Billing Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            <Row label="Total invoiced" value={`$${totalBilled.toLocaleString()}`} />
            <Row label="Total paid"     value={`$${totalPaid.toLocaleString()}`} />
            <Separator />
            <Row
              label="Outstanding"
              value={`$${outstanding.toLocaleString()}`}
              valueClass={outstanding > 0 ? 'text-amber-600 font-semibold' : 'text-emerald-600'}
            />
            {overdueBalance > 0 && (
              <Row
                label="Overdue"
                value={`$${overdueBalance.toLocaleString()}`}
                valueClass="text-destructive font-semibold"
              />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Active Leases</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            {activeLeases.length === 0 && (
              <p className="text-muted-foreground text-xs">No active leases.</p>
            )}
            {activeLeases.map((l) => {
              const unit = units.find((u) => u.id === l.unitId)
              const facility = facilityMap[l.facilityId]
              return (
                <div key={l.id} className="flex items-center justify-between gap-2">
                  <div>
                    <span className="font-medium">
                      {facility?.name ?? l.facilityId}
                    </span>
                    {unit && (
                      <span className="text-muted-foreground ml-1">
                        · Unit {unit.unitNumber}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span>${l.monthlyRent.toLocaleString()}/mo</span>
                    <span className="text-muted-foreground text-xs">
                      from {l.startDate.toDate().toLocaleDateString()}
                    </span>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {/* Full billing history */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4 text-muted-foreground" />Billing History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No invoices yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="pb-2 text-left font-medium text-muted-foreground">Invoice #</th>
                    <th className="pb-2 text-left font-medium text-muted-foreground">Facility</th>
                    <th className="pb-2 text-left font-medium text-muted-foreground">Unit</th>
                    <th className="pb-2 text-left font-medium text-muted-foreground">Period</th>
                    <th className="pb-2 text-left font-medium text-muted-foreground">Due</th>
                    <th className="pb-2 text-right font-medium text-muted-foreground">Amount</th>
                    <th className="pb-2 text-right font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invoices.map((inv: Invoice) => {
                    const invUnit     = units.find((u) => u.id === inv.unitId)
                    const invFacility = facilityMap[inv.facilityId]
                    return (
                      <tr key={inv.id}>
                        <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">
                          {inv.invoiceNumber}
                        </td>
                        <td className="py-2 pr-3">
                          {invFacility ? (
                            <Link
                              to={`/owner/facilities/${inv.facilityId}`}
                              className="hover:underline text-primary"
                            >
                              {invFacility.name}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground text-xs">{inv.facilityId}</span>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          {invUnit ? (
                            <Link
                              to={`/owner/facilities/${inv.facilityId}/units/${inv.unitId}`}
                              className="hover:underline text-primary"
                            >
                              Unit {invUnit.unitNumber}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground text-xs">{inv.unitId}</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground text-xs">
                          {inv.periodStart.toDate().toLocaleDateString()} – {inv.periodEnd.toDate().toLocaleDateString()}
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground text-xs">
                          {inv.dueDate.toDate().toLocaleDateString()}
                        </td>
                        <td className="py-2 text-right font-medium">
                          ${inv.totalDue.toLocaleString()}
                        </td>
                        <td className="py-2 pl-3 text-right">
                          <StatusBadge status={inv.status} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  )
}

// ─── Helper components ────────────────────────────────────────────────────────

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={`font-medium text-right ${valueClass ?? ''}`}>{value}</span>
    </div>
  )
}

function StatCard({
  icon, label, value, valueClass,
}: {
  icon: React.ReactNode
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-1.5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}{label}
      </div>
      <p className={`text-2xl font-bold tracking-tight ${valueClass ?? ''}`}>{value}</p>
    </div>
  )
}

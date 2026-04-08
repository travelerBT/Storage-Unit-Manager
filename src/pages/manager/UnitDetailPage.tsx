import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { unitService, tenantService } from '@/lib/services'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, KeyRound, User } from 'lucide-react'
import type { UnitStatus } from '@/types'

export function UnitDetailPage() {
  const { unitId } = useParams<{ unitId: string }>()
  const qc = useQueryClient()

  const { data: unit, isLoading } = useQuery({
    queryKey: ['unit', unitId],
    queryFn: () => unitService.getById(unitId!),
    enabled: !!unitId,
  })

  const { data: tenant } = useQuery({
    queryKey: ['tenant', unit?.currentTenantId],
    queryFn: () => tenantService.getById(unit!.currentTenantId!),
    enabled: !!unit?.currentTenantId,
  })

  const updateStatus = useMutation({
    mutationFn: (status: UnitStatus) => unitService.update(unitId!, { status }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['unit', unitId] })
      void qc.invalidateQueries({ queryKey: ['units'] })
      toast.success('Unit status updated')
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!unit) return <p className="text-muted-foreground">Unit not found.</p>

  const typeLabel: Record<string, string> = {
    standard: 'Standard', climate_controlled: 'Climate Controlled',
    drive_up: 'Drive-Up', outdoor: 'Outdoor', wine: 'Wine', vehicle: 'Vehicle',
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/manager/units"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Unit {unit.unitNumber}</h1>
          <p className="text-muted-foreground text-sm">{typeLabel[unit.type]}</p>
        </div>
        <StatusBadge status={unit.status} className="ml-auto" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Unit Details</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Dimensions"    value={`${unit.width}' × ${unit.height}' (${unit.sqft} sq ft)`} />
            <Row label="Monthly Rent"  value={`$${unit.pricePerMonth.toLocaleString()}/mo`} />
            <Row label="Security Dep." value={`$${unit.securityDeposit.toLocaleString()}`} />
            <Row label="Building"      value={unit.building ?? '—'} />
            <Row label="Floor"         value={unit.floor?.toString() ?? '—'} />
            {unit.features.length > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Features</span>
                <div className="flex flex-wrap gap-1 justify-end">
                  {unit.features.map((f) => <Badge key={f} variant="outline" className="text-xs">{f}</Badge>)}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-muted-foreground" />Access
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Gate Code"     value={unit.gateCode ?? '—'} />
            <Row label="Access Notes"  value={unit.accessNotes ?? '—'} />
          </CardContent>
        </Card>

        {/* Tenant */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />Current Tenant
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {tenant ? (
              <div className="space-y-2">
                <p className="font-medium">Tenant ID: {tenant.userId}</p>
                <StatusBadge status={tenant.status} />
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/manager/tenants/${tenant.id}`}>View Tenant →</Link>
                </Button>
              </div>
            ) : (
              <div className="text-muted-foreground space-y-3">
                <p>No tenant assigned</p>
                <Button size="sm" asChild>
                  <Link to="/manager/tenants/new">Assign Tenant</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status change */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Change Status</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Select value={unit.status} onValueChange={(v) => updateStatus.mutate(v as UnitStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="occupied">Occupied</SelectItem>
                <SelectItem value="reserved">Reserved</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="delinquent">Delinquent</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

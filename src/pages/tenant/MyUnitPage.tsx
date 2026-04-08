import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { tenantService, unitService, leaseService } from '@/lib/services'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Home, FileText, Key } from 'lucide-react'

export function MyUnitPage() {
  const { firebaseUser } = useAuth()

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['my-tenants', firebaseUser?.uid],
    queryFn: () => tenantService.listByUser(firebaseUser!.uid),
    enabled: !!firebaseUser,
  })
  const tenant = tenants[0]

  const { data: units = [] } = useQuery({
    queryKey: ['my-units', tenant?.id],
    queryFn: () => Promise.all(tenant!.unitIds.map((id) => unitService.getById(id))),
    enabled: !!tenant,
  })
  const { data: leases = [] } = useQuery({
    queryKey: ['my-leases', tenant?.id],
    queryFn: () => leaseService.listByTenant(tenant!.id),
    enabled: !!tenant,
  })

  const unit = units[0]
  const activeLease = leases.find((l) => l.status === 'active')

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-48 w-full" /></div>
  if (!unit) return (
    <div className="text-center py-16 text-muted-foreground">
      <Home className="h-12 w-12 mx-auto mb-3 opacity-30" />
      <p>No unit assigned to your account.</p>
    </div>
  )

  return (
    <div className="max-w-xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">My Unit</h1>
        <p className="text-muted-foreground text-sm">Unit {unit.unitNumber}</p>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Home className="h-4 w-4" />Unit Details</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Unit Number" value={unit.unitNumber} />
          <Row label="Size" value={`${unit.sqft} sq ft`} />
          <Row label="Monthly Rate" value={`$${unit.pricePerMonth.toLocaleString()}`} />
          <Row label="Type" value={unit.type.replace(/_/g, ' ')} />
          {unit.features.length > 0 && <Row label="Features" value={unit.features.join(', ')} />}
          <Row label="Status" value={<StatusBadge status={unit.status} />} />
        </CardContent>
      </Card>

      {unit.gateCode && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Key className="h-4 w-4" />Gate Code</CardTitle></CardHeader>
          <CardContent>
            <p className="font-mono text-2xl tracking-widest text-center bg-muted rounded-md py-3 px-4">{unit.gateCode}</p>
            <p className="text-xs text-muted-foreground text-center mt-2">Do not share this code</p>
          </CardContent>
        </Card>
      )}

      {activeLease && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" />Active Lease</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Start Date" value={activeLease.startDate.toDate().toLocaleDateString()} />
            <Row label="End Date" value={activeLease.endDate?.toDate().toLocaleDateString() ?? 'Month-to-month'} />
            <Row label="Monthly Rent" value={`$${activeLease.monthlyRent.toLocaleString()}`} />
            <Row label="Security Deposit" value={`$${activeLease.securityDeposit.toLocaleString()}`} />
            <Separator />
            {activeLease.signedAt ? (
              <p className="text-xs text-green-600">Signed on {activeLease.signedAt.toDate().toLocaleDateString()}</p>
            ) : (
              <p className="text-xs text-amber-600">Lease not yet signed</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium capitalize">{value}</span>
    </div>
  )
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { facilityService, unitService } from '@/lib/services'
import { callFunction } from '@/lib/firebase'
import { StatCard } from '@/components/shared/StatCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Building2, Warehouse, Users, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'

const setupSchema = z.object({
  name:    z.string().min(1, 'Business name is required'),
  email:   z.string().email('Enter a valid email').optional().or(z.literal('')),
  phone:   z.string().optional(),
  address: z.string().optional(),
})
type SetupValues = z.infer<typeof setupSchema>

function BusinessSetup() {
  const { refreshClaims } = useAuth()
  const qc = useQueryClient()

  const { register, handleSubmit, formState: { errors } } = useForm<SetupValues>({
    resolver: zodResolver(setupSchema),
  })

  const setup = useMutation({
    mutationFn: async (data: SetupValues) => {
      const setupBusiness = callFunction<
        { name: string; email: string; phone: string; address: string },
        { businessId: string }
      >('setupBusiness')
      const result = await setupBusiness({
        name: data.name,
        email: data.email ?? '',
        phone: data.phone ?? '',
        address: data.address ?? '',
      })
      return result.data.businessId
    },
    onSuccess: async () => {
      await refreshClaims()
      await qc.invalidateQueries({ queryKey: ['facilities'] })
      toast.success('Business created!')
    },
    onError: (err) => {
      console.error('Failed to create business:', err)
      toast.error('Failed to create business')
    },
  })

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Set up your business
          </CardTitle>
          <p className="text-muted-foreground text-sm">Create your business profile to get started.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((d) => setup.mutate(d))} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Business Name *</Label>
              <Input placeholder="Acme Storage Co." {...register('name')} />
              {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" placeholder="info@yourbusiness.com" {...register('email')} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input placeholder="(555) 000-0000" {...register('phone')} />
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input placeholder="123 Main St, City, State" {...register('address')} />
            </div>
            <Button type="submit" className="w-full" disabled={setup.isPending}>
              {setup.isPending ? 'Creating…' : 'Create Business'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export function OwnerDashboard() {
  const { appUser } = useAuth()

  const { data: facilities = [] } = useQuery({
    queryKey: ['facilities', appUser?.businessId],
    queryFn: () => facilityService.listByBusiness(appUser!.businessId!),
    enabled: !!appUser?.businessId,
  })

  // Derive live unit counts per facility (denormalized fields on facility docs go stale)
  const { data: unitCounts = {} } = useQuery({
    queryKey: ['dashboard-unit-counts', facilities.map((f) => f.id)],
    queryFn: async () => {
      const results = await Promise.all(
        facilities.map((f) =>
          unitService.listByFacility(f.id).then((units) => ({
            facilityId: f.id,
            total:    units.length,
            occupied: units.filter((u) => u.status === 'occupied').length,
          }))
        )
      )
      return Object.fromEntries(results.map((r) => [r.facilityId, r]))
    },
    enabled: facilities.length > 0,
  })

  // Show setup screen if businessId isn't linked yet
  if (!appUser?.businessId) return <BusinessSetup />

  const totalUnits    = facilities.reduce((s, f) => s + (unitCounts[f.id]?.total    ?? f.totalUnits),    0)
  const totalOccupied = facilities.reduce((s, f) => s + (unitCounts[f.id]?.occupied ?? f.occupiedUnits), 0)
  const occupancyRate = totalUnits > 0 ? Math.round((totalOccupied / totalUnits) * 100) : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Portfolio Overview</h1>
        <p className="text-muted-foreground text-sm">Across all your facilities</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Facilities"        value={facilities.length}  icon={Building2}  iconClassName="bg-blue-100 text-blue-700" />
        <StatCard title="Total Units"       value={totalUnits}         icon={Warehouse}  iconClassName="bg-amber-100 text-amber-700" />
        <StatCard title="Occupied Units"    value={totalOccupied}      icon={Users}      iconClassName="bg-emerald-100 text-emerald-700" />
        <StatCard title="Occupancy Rate"    value={`${occupancyRate}%`} icon={TrendingUp} iconClassName="bg-violet-100 text-violet-700" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Facilities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {facilities.length === 0 && (
            <div className="text-muted-foreground py-6 text-center text-sm">
              No facilities yet.{' '}
              <Link to="/owner/facilities" className="text-primary hover:underline">Add your first facility →</Link>
            </div>
          )}
          {facilities.map((f) => {
            const liveTotal    = unitCounts[f.id]?.total    ?? f.totalUnits
            const liveOccupied = unitCounts[f.id]?.occupied ?? f.occupiedUnits
            const rate = liveTotal > 0 ? Math.round((liveOccupied / liveTotal) * 100) : 0
            return (
              <div key={f.id} className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-medium">{f.name}</p>
                  <p className="text-muted-foreground text-xs">{f.city}, {f.state} · {liveOccupied}/{liveTotal} units · {rate}% occupied</p>
                </div>
                <StatusBadge status={f.subscriptionStatus} />
              </div>
            )
          })}
          {facilities.length > 0 && (
            <Button variant="outline" size="sm" asChild>
              <Link to="/owner/facilities">Manage facilities</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

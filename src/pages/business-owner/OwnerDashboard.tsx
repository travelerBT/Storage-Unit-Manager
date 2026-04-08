import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { facilityService } from '@/lib/services'
import { StatCard } from '@/components/shared/StatCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Warehouse, Users, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export function OwnerDashboard() {
  const { appUser } = useAuth()

  const { data: facilities = [] } = useQuery({
    queryKey: ['facilities', appUser?.businessId],
    queryFn: () => facilityService.listByBusiness(appUser!.businessId!),
    enabled: !!appUser?.businessId,
  })

  const totalUnits    = facilities.reduce((s, f) => s + f.totalUnits, 0)
  const totalOccupied = facilities.reduce((s, f) => s + f.occupiedUnits, 0)
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
            const rate = f.totalUnits > 0 ? Math.round((f.occupiedUnits / f.totalUnits) * 100) : 0
            return (
              <div key={f.id} className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-medium">{f.name}</p>
                  <p className="text-muted-foreground text-xs">{f.city}, {f.state} · {f.occupiedUnits}/{f.totalUnits} units · {rate}% occupied</p>
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

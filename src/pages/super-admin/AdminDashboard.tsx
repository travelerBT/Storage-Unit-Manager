import { useQuery } from '@tanstack/react-query'
import { businessService } from '@/lib/services'
import { facilityService } from '@/lib/services'
import { usersService } from '@/lib/services'
import { StatCard } from '@/components/shared/StatCard'
import { Building2, Users, Warehouse, ShieldCheck } from 'lucide-react'

export function AdminDashboard() {
  const { data: businesses = [] } = useQuery({
    queryKey: ['businesses'],
    queryFn: () => businessService.listAll(),
  })
  const { data: facilities = [] } = useQuery({
    queryKey: ['facilities-all'],
    queryFn: () => facilityService.listAll(),
  })
  const { data: users = [] } = useQuery({
    queryKey: ['users-all'],
    queryFn: () => usersService.listAll(),
  })

  const activeBusinesses = businesses.filter((b) => b.subscriptionStatus === 'active').length
  const totalUnits = facilities.reduce((s, f) => s + f.totalUnits, 0)
  const totalOccupied = facilities.reduce((s, f) => s + f.occupiedUnits, 0)
  const occupancyRate = totalUnits > 0 ? Math.round((totalOccupied / totalUnits) * 100) : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Platform Overview</h1>
        <p className="text-muted-foreground text-sm">Real-time metrics across all businesses</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Businesses"
          value={businesses.length}
          description={`${activeBusinesses} active`}
          icon={Building2}
          iconClassName="bg-violet-100 text-violet-700"
        />
        <StatCard
          title="Total Facilities"
          value={facilities.length}
          icon={Warehouse}
          iconClassName="bg-blue-100 text-blue-700"
        />
        <StatCard
          title="Platform Users"
          value={users.length}
          icon={Users}
          iconClassName="bg-emerald-100 text-emerald-700"
        />
        <StatCard
          title="Platform Occupancy"
          value={`${occupancyRate}%`}
          description={`${totalOccupied} / ${totalUnits} units`}
          icon={ShieldCheck}
          iconClassName="bg-amber-100 text-amber-700"
        />
      </div>
    </div>
  )
}

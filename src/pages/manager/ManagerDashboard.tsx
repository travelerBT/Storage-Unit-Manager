import { useQuery } from '@tanstack/react-query'
import { useFacility } from '@/contexts/FacilityContext'
import { unitService, tenantService, invoiceService, maintenanceService } from '@/lib/services'
import { StatCard } from '@/components/shared/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, FileText, Wrench, TrendingUp, AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'

export function ManagerDashboard() {
  const { facilityId, facility } = useFacility()

  const { data: units = [] } = useQuery({
    queryKey: ['units', facilityId],
    queryFn: () => unitService.listByFacility(facilityId!),
    enabled: !!facilityId,
  })
  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants', facilityId],
    queryFn: () => tenantService.listByFacility(facilityId!),
    enabled: !!facilityId,
  })
  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices', facilityId],
    queryFn: () => invoiceService.listByFacility(facilityId!),
    enabled: !!facilityId,
  })
  const { data: maintenance = [] } = useQuery({
    queryKey: ['maintenance', facilityId],
    queryFn: () => maintenanceService.listByFacility(facilityId!),
    enabled: !!facilityId,
  })

  const available   = units.filter((u) => u.status === 'available').length
  const occupied    = units.filter((u) => u.status === 'occupied').length
  const delinquent  = units.filter((u) => u.status === 'delinquent').length
  const occupancyRate = units.length > 0 ? Math.round((occupied / units.length) * 100) : 0

  const overdueInvoices = invoices.filter((i) => i.status === 'overdue')
  const openMaintenance = maintenance.filter((m) => m.status === 'open' || m.status === 'in_progress')
  const activeTenants   = tenants.filter((t) => t.status === 'active').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{facility?.name ?? 'Facility Dashboard'}</h1>
        <p className="text-muted-foreground text-sm">{facility?.address}, {facility?.city}, {facility?.state}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Occupancy"        value={`${occupancyRate}%`}   description={`${occupied} / ${units.length} units`} icon={TrendingUp}   iconClassName="bg-emerald-100 text-emerald-700" />
        <StatCard title="Active Tenants"   value={activeTenants}         icon={Users}          iconClassName="bg-blue-100 text-blue-700" />
        <StatCard title="Overdue Invoices" value={overdueInvoices.length} icon={FileText}       iconClassName="bg-red-100 text-red-700" />
        <StatCard title="Open Maintenance" value={openMaintenance.length} icon={Wrench}         iconClassName="bg-amber-100 text-amber-700" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Unit Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              Unit Status
              <Link to="/manager/units" className="text-primary text-xs hover:underline">View all</Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Available</span><span className="font-medium text-emerald-600">{available}</span></div>
            <div className="flex justify-between"><span>Occupied</span><span className="font-medium text-blue-600">{occupied}</span></div>
            <div className="flex justify-between"><span>Maintenance</span><span className="font-medium text-amber-600">{units.filter((u) => u.status === 'maintenance').length}</span></div>
            <div className="flex justify-between"><span>Delinquent</span><span className="font-medium text-red-600">{delinquent}</span></div>
          </CardContent>
        </Card>

        {/* Overdue Invoices */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-500" />Overdue</span>
              <Link to="/manager/invoices" className="text-primary text-xs hover:underline">View all</Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {overdueInvoices.slice(0, 5).map((inv) => (
              <div key={inv.id} className="flex justify-between">
                <span className="text-muted-foreground font-mono text-xs">{inv.invoiceNumber}</span>
                <span className="font-medium text-red-600">${inv.totalDue.toLocaleString()}</span>
              </div>
            ))}
            {overdueInvoices.length === 0 && <p className="text-muted-foreground text-xs">No overdue invoices</p>}
          </CardContent>
        </Card>

        {/* Open Maintenance */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2"><Wrench className="h-4 w-4 text-amber-500" />Maintenance</span>
              <Link to="/manager/maintenance" className="text-primary text-xs hover:underline">View all</Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {openMaintenance.slice(0, 5).map((r) => (
              <div key={r.id} className="flex items-center justify-between">
                <span className="truncate text-sm">{r.title}</span>
                <span className="text-xs text-muted-foreground capitalize">{r.priority}</span>
              </div>
            ))}
            {openMaintenance.length === 0 && <p className="text-muted-foreground text-xs">No open requests</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

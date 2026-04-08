import { useQuery } from '@tanstack/react-query'
import { useFacility } from '@/contexts/FacilityContext'
import { unitService, tenantService, invoiceService } from '@/lib/services'
import { StatCard } from '@/components/shared/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BarChart3, TrendingUp, AlertTriangle, Home, Download } from 'lucide-react'
import { useMemo } from 'react'

function percentage(num: number, denom: number) {
  if (denom === 0) return '0'
  return ((num / denom) * 100).toFixed(1)
}

function csvExport(rows: string[][], filename: string) {
  const content = rows.map((r) => r.map((c) => JSON.stringify(c)).join(',')).join('\n')
  const blob = new Blob([content], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function ReportsPage() {
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

  const stats = useMemo(() => {
    const occupied = units.filter((u) => u.status === 'occupied').length
    const occupancy = percentage(occupied, units.length)
    const revenue = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.totalDue, 0)
    const overdue = invoices.filter((i) => i.status === 'overdue').length
    const delinquency = percentage(overdue, invoices.length)
    const delinquentUnits = units.filter((u) => u.status === 'delinquent').length
    return { occupancy, revenue, overdue, delinquency, delinquentUnits, occupied, total: units.length }
  }, [units, invoices])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const u of units) counts[u.status] = (counts[u.status] ?? 0) + 1
    return counts
  }, [units])

  function handleExportUnits() {
    const rows = [
      ['Unit Number', 'Sq Ft', 'Price/Month', 'Status'],
      ...units.map((u) => [u.unitNumber, String(u.sqft), String(u.pricePerMonth), u.status]),
    ]
    csvExport(rows, `units-${facility?.name ?? 'export'}.csv`)
  }

  function handleExportInvoices() {
    const rows = [
      ['Invoice #', 'Tenant ID', 'Amount', 'Status', 'Due Date'],
      ...invoices.map((i) => [i.invoiceNumber, i.tenantId, String(i.totalDue), i.status, i.dueDate.toDate().toLocaleDateString()]),
    ]
    csvExport(rows, `invoices-${facility?.name ?? 'export'}.csv`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-muted-foreground text-sm">{facility?.name}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Occupancy Rate" value={`${stats.occupancy}%`} icon={Home} description={`${stats.occupied}/${stats.total} units`} />
        <StatCard title="Revenue Collected" value={`$${stats.revenue.toLocaleString()}`} icon={TrendingUp} description="From paid invoices" />
        <StatCard title="Overdue Invoices" value={stats.overdue} icon={AlertTriangle} description={`${stats.delinquency}% delinquency rate`} />
        <StatCard title="Delinquent Units" value={stats.delinquentUnits} icon={BarChart3} description="Pending auction or notice" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Unit Status Breakdown</CardTitle>
            <Button size="sm" variant="outline" onClick={handleExportUnits}><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(statusCounts).map(([status, count]) => {
                const pct = percentage(count, units.length)
                return (
                  <div key={status}>
                    <div className="flex justify-between mb-1 text-sm">
                      <span className="capitalize">{status}</span>
                      <span className="text-muted-foreground">{count} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
              {units.length === 0 && <p className="text-muted-foreground text-sm">No units</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Invoice Summary</CardTitle>
            <Button size="sm" variant="outline" onClick={handleExportInvoices}><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(['pending', 'overdue', 'paid', 'waived'] as const).map((status) => {
                const count = invoices.filter((i) => i.status === status).length
                const pct = percentage(count, invoices.length)
                return (
                  <div key={status}>
                    <div className="flex justify-between mb-1 text-sm">
                      <span className="capitalize">{status}</span>
                      <span className="text-muted-foreground">{count} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
              {invoices.length === 0 && <p className="text-muted-foreground text-sm">No invoices</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Tenant Overview</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-3xl font-bold">{tenants.length}</p>
              <p className="text-muted-foreground text-sm mt-1">Total Tenants</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{tenants.filter((t) => t.status === 'active').length}</p>
              <p className="text-muted-foreground text-sm mt-1">Active</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{tenants.filter((t) => t.status === 'delinquent').length}</p>
              <p className="text-muted-foreground text-sm mt-1">Delinquent</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

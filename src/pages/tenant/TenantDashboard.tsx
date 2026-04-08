import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { tenantService, unitService, invoiceService } from '@/lib/services'
import { StatCard } from '@/components/shared/StatCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import { Home, FileText, ArrowRight } from 'lucide-react'

export function TenantDashboard() {
  const { firebaseUser } = useAuth()

  const { data: tenants = [] } = useQuery({
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
  const { data: invoices = [] } = useQuery({
    queryKey: ['my-invoices', tenant?.id],
    queryFn: () => invoiceService.listByTenant(tenant!.id),
    enabled: !!tenant,
  })

  const unit = units[0]
  const pendingBalance = invoices.filter((i) => i.status === 'pending' || i.status === 'overdue').reduce((s, i) => s + i.totalDue, 0)
  const nextInvoice = invoices.filter((i) => i.status === 'pending').sort((a, b) => (a.dueDate?.seconds ?? 0) - (b.dueDate?.seconds ?? 0))[0]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">My Dashboard</h1>
        <p className="text-muted-foreground text-sm">Welcome back, {firebaseUser?.displayName ?? firebaseUser?.email}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="My Unit" value={unit ? `Unit ${unit.unitNumber}` : '—'} icon={Home} description={unit ? `${unit.sqft} sq ft` : 'No unit assigned'} />
        <StatCard title="Balance Due" value={pendingBalance > 0 ? `$${pendingBalance.toLocaleString()}` : '$0'} icon={FileText} description={pendingBalance > 0 ? 'Payment needed' : 'All paid up'} />
        <StatCard title="Status" value={tenant?.status ?? '—'} icon={ArrowRight} description="Your tenant status" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">My Unit</CardTitle>
            <Button size="sm" variant="ghost" asChild><Link to="/tenant/unit">View <ArrowRight className="h-3.5 w-3.5 ml-1" /></Link></Button>
          </CardHeader>
          <CardContent>
            {unit ? (
              <div className="space-y-2 text-sm">
                <Row label="Unit Number" value={unit.unitNumber} />
                <Row label="Size" value={`${unit.sqft} sq ft`} />
                <Row label="Monthly Rate" value={`$${unit.pricePerMonth.toLocaleString()}`} />
                <Row label="Status" value={<StatusBadge status={unit.status} />} />
              </div>
            ) : <p className="text-muted-foreground text-sm">No unit assigned yet.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Next Invoice</CardTitle>
            <Button size="sm" variant="ghost" asChild><Link to="/tenant/invoices">All <ArrowRight className="h-3.5 w-3.5 ml-1" /></Link></Button>
          </CardHeader>
          <CardContent>
            {nextInvoice ? (
              <div className="space-y-2 text-sm">
                <Row label="Invoice #" value={nextInvoice.invoiceNumber} />
                <Row label="Amount Due" value={`$${nextInvoice.totalDue.toLocaleString()}`} />
                <Row label="Due Date" value={nextInvoice.dueDate.toDate().toLocaleDateString()} />
                <Row label="Status" value={<StatusBadge status={nextInvoice.status} />} />
              </div>
            ) : <p className="text-muted-foreground text-sm">No pending invoices.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

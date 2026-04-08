import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { tenantService, invoiceService } from '@/lib/services'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FileText } from 'lucide-react'
import type { Invoice } from '@/types'

type TabKey = 'all' | 'pending' | 'overdue' | 'paid'

export function TenantInvoicesPage() {
  const { firebaseUser } = useAuth()
  const [tab, setTab] = useState<TabKey>('all')

  const { data: tenants = [], isLoading: loadingTenant } = useQuery({
    queryKey: ['my-tenants', firebaseUser?.uid],
    queryFn: () => tenantService.listByUser(firebaseUser!.uid),
    enabled: !!firebaseUser,
  })
  const tenant = tenants[0]

  const { data: invoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ['my-invoices', tenant?.id],
    queryFn: () => invoiceService.listByTenant(tenant!.id),
    enabled: !!tenant,
  })

  const loading = loadingTenant || loadingInvoices

  const filter: Record<TabKey, (i: Invoice) => boolean> = {
    all: () => true,
    pending: (i) => i.status === 'pending',
    overdue: (i) => i.status === 'overdue',
    paid: (i) => i.status === 'paid',
  }
  const filtered = invoices.filter(filter[tab])

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-40" /><Skeleton className="h-48 w-full" /></div>

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">My Invoices</h1>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="overdue">Overdue</TabsTrigger>
          <TabsTrigger value="paid">Paid</TabsTrigger>
        </TabsList>

        {(['all', 'pending', 'overdue', 'paid'] as TabKey[]).map((t) => (
          <TabsContent key={t} value={t}>
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>No invoices found.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((inv) => (
                  <Card key={inv.id}>
                    <CardHeader className="pb-1">
                      <CardTitle className="text-sm text-muted-foreground">#{inv.invoiceNumber}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between flex-wrap gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">
                          {inv.periodStart.toDate().toLocaleDateString()} – {inv.periodEnd.toDate().toLocaleDateString()}
                        </p>
                        <p className="text-xs text-muted-foreground">Due: {inv.dueDate.toDate().toLocaleDateString()}</p>
                        {inv.notes && <p className="text-xs text-muted-foreground mt-1">{inv.notes}</p>}
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="font-semibold">${inv.totalDue.toLocaleString()}</p>
                        <StatusBadge status={inv.status} />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

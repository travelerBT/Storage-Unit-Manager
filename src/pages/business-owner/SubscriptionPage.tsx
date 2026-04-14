import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { facilityService } from '@/lib/services'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CreditCard, CheckCircle2 } from 'lucide-react'

const planDetails: Record<string, { units: string; price: string; features: string[] }> = {
  starter:    { units: 'Up to 50 units',    price: '$49/mo per facility',  features: ['Unit management', 'Tenant portal', 'Invoicing', 'Email notifications'] },
  pro:        { units: 'Up to 200 units',   price: '$99/mo per facility',  features: ['Everything in Starter', 'SMS notifications', 'Auction management', 'Reports & analytics'] },
  enterprise: { units: 'Unlimited units',   price: '$199/mo per facility', features: ['Everything in Pro', 'API access', 'Custom branding', 'Priority support'] },
}

export function SubscriptionPage() {
  const { appUser } = useAuth()

  const { data: facilities = [], isLoading } = useQuery({
    queryKey: ['facilities', appUser?.businessId],
    queryFn: () => facilityService.listByBusiness(appUser!.businessId!),
    enabled: !!appUser?.businessId,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Subscription</h1>
        <p className="text-muted-foreground text-sm">Per-facility subscription overview</p>
      </div>

      <div className="space-y-4">
        {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
        {facilities.map((f) => {
          const plan = planDetails[f.subscriptionPlan] ?? planDetails.starter
          return (
            <Card key={f.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    {f.name}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">{f.subscriptionPlan}</Badge>
                    <StatusBadge status={f.subscriptionStatus} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground text-sm">· {plan.units}</span>
                </div>
                <ul className="space-y-1.5">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      {feat}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )
        })}
        {!isLoading && facilities.length === 0 && (
          <p className="text-muted-foreground text-sm">No facilities to display.</p>
        )}
      </div>

      <p className="text-muted-foreground text-xs">
        To upgrade or change your plan, contact support at support@spotslot.io
      </p>
    </div>
  )
}

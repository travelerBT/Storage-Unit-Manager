import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { usersService } from '@/lib/services'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Mail, Phone } from 'lucide-react'

export function ManagersPage() {
  const { appUser } = useAuth()

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users-business', appUser?.businessId],
    queryFn: () => usersService.listByBusiness(appUser!.businessId!),
    enabled: !!appUser?.businessId,
  })

  const managers = users.filter((u) => u.role === 'manager')

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Managers</h1>
        <p className="text-muted-foreground text-sm">People who manage your facilities</p>
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {managers.map((m) => (
          <Card key={m.id}>
            <CardContent className="pt-5 space-y-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>
                    {m.displayName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{m.displayName}</p>
                  <Badge variant="outline" className="bg-emerald-100 text-emerald-800 text-xs">Manager</Badge>
                </div>
              </div>
              <div className="space-y-1 text-sm">
                <div className="text-muted-foreground flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5" />{m.email}
                </div>
                {m.phone && (
                  <div className="text-muted-foreground flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5" />{m.phone}
                  </div>
                )}
              </div>
              <div className="text-muted-foreground text-xs">
                Manages {m.facilityIds?.length ?? 0} facilit{(m.facilityIds?.length ?? 0) === 1 ? 'y' : 'ies'}
              </div>
            </CardContent>
          </Card>
        ))}
        {!isLoading && managers.length === 0 && (
          <div className="col-span-full text-muted-foreground py-12 text-center text-sm">
            No managers yet. Invite managers through the invite system.
          </div>
        )}
      </div>
    </div>
  )
}

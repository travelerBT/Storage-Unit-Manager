import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useFacility } from '@/contexts/FacilityContext'
import { tenantService, usersService } from '@/lib/services'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Search } from 'lucide-react'

export function TenantsPage() {
  const { facilityId } = useFacility()
  const [search, setSearch] = useState('')

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['tenants', facilityId],
    queryFn: () => tenantService.listByFacility(facilityId!),
    enabled: !!facilityId,
  })

  // Load user profiles for display names
  const { data: allUsers = [] } = useQuery({
    queryKey: ['users-all'],
    queryFn: () => usersService.listAll(),
  })

  const userMap = Object.fromEntries(allUsers.map((u) => [u.id, u]))

  const filtered = tenants.filter((t) => {
    const user = userMap[t.userId]
    const name = user?.displayName ?? ''
    const email = user?.email ?? ''
    return name.toLowerCase().includes(search.toLowerCase()) || email.toLowerCase().includes(search.toLowerCase())
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tenants</h1>
          <p className="text-muted-foreground text-sm">{tenants.length} total tenants</p>
        </div>
        <Button asChild>
          <Link to="/manager/tenants/new"><Plus className="mr-2 h-4 w-4" />Onboard Tenant</Link>
        </Button>
      </div>

      <div className="relative max-w-xs">
        <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
        <Input placeholder="Search tenants..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tenant</TableHead>
              <TableHead>Units</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Move-in</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={5} className="text-muted-foreground text-center py-10">Loading…</TableCell></TableRow>}
            {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={5} className="text-muted-foreground text-center py-10">No tenants found</TableCell></TableRow>}
            {filtered.map((t) => {
              const user = userMap[t.userId]
              const initials = user?.displayName?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() ?? '?'
              return (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{user?.displayName ?? t.userId}</div>
                        <div className="text-muted-foreground text-xs">{user?.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{t.unitIds.length} unit{t.unitIds.length !== 1 ? 's' : ''}</TableCell>
                  <TableCell><StatusBadge status={t.status} /></TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {t.moveInDate?.toDate().toLocaleDateString() ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/manager/tenants/${t.id}`}>View</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

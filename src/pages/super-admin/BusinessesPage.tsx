import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { businessService } from '@/lib/services'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Search } from 'lucide-react'
import type { BusinessStatus } from '@/types'

export function BusinessesPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')

  const { data: businesses = [], isLoading } = useQuery({
    queryKey: ['businesses'],
    queryFn: () => businessService.listAll(),
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: BusinessStatus }) =>
      businessService.update(id, { subscriptionStatus: status }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['businesses'] })
      toast.success('Business status updated')
    },
  })

  const filtered = businesses.filter(
    (b) => b.name.toLowerCase().includes(search.toLowerCase()) || b.email?.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Businesses</h1>
          <p className="text-muted-foreground text-sm">All registered businesses on the platform</p>
        </div>
      </div>

      <div className="relative max-w-xs">
        <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
        <Input
          placeholder="Search businesses..."
          className="pl-8"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Business</TableHead>
              <TableHead>Owner ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={5} className="text-muted-foreground text-center py-10">Loading…</TableCell></TableRow>
            )}
            {!isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-muted-foreground text-center py-10">No businesses found</TableCell></TableRow>
            )}
            {filtered.map((b) => (
              <TableRow key={b.id}>
                <TableCell>
                  <div className="font-medium">{b.name}</div>
                  {b.email && <div className="text-muted-foreground text-xs">{b.email}</div>}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs font-mono">{b.ownerId}</TableCell>
                <TableCell><StatusBadge status={b.subscriptionStatus} /></TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {b.createdAt?.toDate().toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger>
                      <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => updateStatus.mutate({ id: b.id, status: 'active' })}>
                        Set Active
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateStatus.mutate({ id: b.id, status: 'trial' })}>
                        Set Trial
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => updateStatus.mutate({ id: b.id, status: 'suspended' })}
                      >
                        Suspend
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-muted-foreground text-xs">{filtered.length} of {businesses.length} businesses</p>
    </div>
  )
}

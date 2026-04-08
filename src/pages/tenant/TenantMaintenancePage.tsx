import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { tenantService, maintenanceService } from '@/lib/services'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Wrench, Plus } from 'lucide-react'
import type { MaintenancePriority } from '@/types'

export function TenantMaintenancePage() {
  const { firebaseUser } = useAuth()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<MaintenancePriority>('medium')

  const { data: tenants = [], isLoading: loadingTenant } = useQuery({
    queryKey: ['my-tenants', firebaseUser?.uid],
    queryFn: () => tenantService.listByUser(firebaseUser!.uid),
    enabled: !!firebaseUser,
  })
  const tenant = tenants[0]

  const { data: requests = [], isLoading: loadingReqs } = useQuery({
    queryKey: ['my-maintenance', tenant?.id],
    queryFn: () => maintenanceService.listByTenant(tenant!.id),
    enabled: !!tenant,
  })

  const submit = useMutation({
    mutationFn: () => maintenanceService.create({
      unitId: tenant!.unitIds[0],
      facilityId: tenant!.facilityId,
      businessId: tenant!.businessId,
      submittedBy: firebaseUser!.uid,
      submittedByRole: 'tenant',
      title,
      description,
      priority,
      status: 'open',
      photoUrls: [],
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-maintenance', tenant?.id] })
      setOpen(false)
      setTitle('')
      setDescription('')
      setPriority('medium')
    },
  })

  if (loadingTenant || loadingReqs) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-48 w-full" /></div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Maintenance Requests</h1>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Submit Request</Button>
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Wrench className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>No maintenance requests.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <Card key={r.id}>
              <CardHeader className="pb-1">
                <CardTitle className="text-base">{r.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex items-start justify-between gap-2 text-sm">
                <p className="text-muted-foreground">{r.description}</p>
                <div className="flex flex-col gap-1 items-end shrink-0">
                  <StatusBadge status={r.status} />
                  <span className="text-xs capitalize text-muted-foreground">{r.priority}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Submit Maintenance Request</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Brief issue description" />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the issue in detail..." rows={3} />
            </div>
            <div className="space-y-1">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as MaintenancePriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => submit.mutate()} disabled={!title || !description || submit.isPending}>
                {submit.isPending ? 'Submitting...' : 'Submit'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

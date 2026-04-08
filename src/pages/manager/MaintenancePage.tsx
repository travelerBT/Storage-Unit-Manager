import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useFacility } from '@/contexts/FacilityContext'
import { maintenanceService } from '@/lib/services'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import type { MaintenanceStatus, MaintenancePriority } from '@/types'

const schema = z.object({
  unitId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high', 'urgent'] satisfies [MaintenancePriority, ...MaintenancePriority[]]),
})
type FormData = z.infer<typeof schema>

const STATUS_ORDER: MaintenanceStatus[] = ['open', 'in_progress', 'resolved', 'closed']

function nextStatus(s: MaintenanceStatus): MaintenanceStatus | null {
  const i = STATUS_ORDER.indexOf(s)
  return i < STATUS_ORDER.length - 1 ? STATUS_ORDER[i + 1] : null
}

export function MaintenancePage() {
  const { facilityId, facility } = useFacility()
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['maintenance', facilityId],
    queryFn: () => maintenanceService.listByFacility(facilityId!),
    enabled: !!facilityId,
  })

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { unitId: '', title: '', description: '', priority: 'medium' },
  })

  const createMut = useMutation({
    mutationFn: (data: FormData) =>
      maintenanceService.create({
        facilityId: facilityId!,
        businessId: facility!.businessId,
        submittedBy: '',
        submittedByRole: 'manager',
        unitId: data.unitId,
        title: data.title,
        description: data.description,
        priority: data.priority,
        status: 'open',
        photoUrls: [],
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance'] })
      toast.success('Request created')
      setDialogOpen(false)
      reset()
    },
  })

  const advanceMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: MaintenanceStatus }) => maintenanceService.update(id, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['maintenance'] }); toast.success('Status updated') },
  })

  const priorityClass = (p: MaintenancePriority) =>
    p === 'urgent' ? 'text-red-600' : p === 'high' ? 'text-orange-600' : 'text-muted-foreground'

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Maintenance</h1>
          <p className="text-muted-foreground text-sm">{facility?.name}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />New Request</Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
            ) : requests.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No requests</TableCell></TableRow>
            ) : requests.map((req) => {
              const next = nextStatus(req.status)
              return (
                <TableRow key={req.id}>
                  <TableCell className="font-medium">{req.title}</TableCell>
                  <TableCell>{req.unitId}</TableCell>
                  <TableCell><span className={`capitalize text-xs font-medium ${priorityClass(req.priority)}`}>{req.priority}</span></TableCell>
                  <TableCell><StatusBadge status={req.status} /></TableCell>
                  <TableCell>
                    {next && (
                      <Button size="sm" variant="outline" onClick={() => advanceMut.mutate({ id: req.id, status: next })}>
                        → {next.replace('_', ' ')}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Maintenance Request</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit((d) => createMut.mutate(d))} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Unit ID</Label>
              <Input placeholder="e.g. unit-abc123" {...register('unitId')} />
              {errors.unitId && <p className="text-xs text-destructive">{errors.unitId.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input placeholder="e.g. Broken door latch" {...register('title')} />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea rows={3} {...register('description')} />
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select defaultValue="medium" onValueChange={(v) => setValue('priority', v as MaintenancePriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMut.isPending}>Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

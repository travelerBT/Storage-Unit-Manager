import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useFacility } from '@/contexts/FacilityContext'
import { invoiceService, tenantService } from '@/lib/services'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import type { InvoiceStatus } from '@/types'
import { Timestamp } from 'firebase/firestore'

const invoiceSchema = z.object({
  tenantId: z.string().min(1),
  description: z.string().min(1),
  amount: z.coerce.number().positive(),
  dueDate: z.string().min(1),
})
type InvoiceFormData = z.infer<typeof invoiceSchema>

const TABS: { label: string; value: InvoiceStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Overdue', value: 'overdue' },
  { label: 'Paid', value: 'paid' },
]

export function InvoicesPage() {
  const { facilityId, facility } = useFacility()
  const qc = useQueryClient()
  const [tab, setTab] = useState<'all' | InvoiceStatus>('all')
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices', facilityId],
    queryFn: () => invoiceService.listByFacility(facilityId!),
    enabled: !!facilityId,
  })
  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants', facilityId],
    queryFn: () => tenantService.listByFacility(facilityId!),
    enabled: !!facilityId,
  })

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema) as never,
    defaultValues: { tenantId: '', description: 'Monthly Rent', amount: 0, dueDate: '' },
  })

  const createMut = useMutation({
    mutationFn: (data: InvoiceFormData) =>
      invoiceService.create({
        facilityId: facilityId!,
        businessId: facility!.businessId,
        tenantId: data.tenantId,
        unitId: '',
        leaseId: '',
        invoiceNumber: `INV-${Date.now()}`,
        amount: data.amount,
        lateFeeAmount: 0,
        totalDue: data.amount,
        dueDate: Timestamp.fromDate(new Date(data.dueDate)),
        status: 'pending',
        periodStart: Timestamp.now(),
        periodEnd: Timestamp.now(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      toast.success('Invoice created')
      setDialogOpen(false)
      reset()
    },
  })

  const markPaidMut = useMutation({
    mutationFn: (id: string) => invoiceService.update(id, { status: 'paid', paidDate: Timestamp.now(), paidAmount: 0 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); toast.success('Marked as paid') },
  })

  const filtered = tab === 'all' ? invoices : invoices.filter((i) => i.status === tab)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-muted-foreground text-sm">{facility?.name}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />New Invoice</Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>{TABS.map((t) => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}</TabsList>
      </Tabs>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No invoices</TableCell></TableRow>
            ) : filtered.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="font-mono text-xs">{inv.invoiceNumber}</TableCell>
                <TableCell>{inv.tenantId}</TableCell>
                <TableCell>${inv.totalDue.toLocaleString()}</TableCell>
                <TableCell>{inv.dueDate.toDate().toLocaleDateString()}</TableCell>
                <TableCell><StatusBadge status={inv.status} /></TableCell>
                <TableCell>
                  {inv.status !== 'paid' && (
                    <Button size="sm" variant="outline" onClick={() => markPaidMut.mutate(inv.id)}>Mark Paid</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Invoice</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit((d) => createMut.mutate(d as InvoiceFormData))} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Tenant</Label>
              <Select onValueChange={(v) => setValue('tenantId', v as string)}>
                <SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger>
                <SelectContent>{tenants.map((t) => <SelectItem key={t.id} value={t.id}>{t.id}</SelectItem>)}</SelectContent>
              </Select>
              {errors.tenantId && <p className="text-xs text-destructive">{errors.tenantId.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Description / Notes</Label>
              <Input {...register('description')} />
            </div>
            <div className="space-y-1.5">
              <Label>Amount ($)</Label>
              <Input type="number" step="0.01" {...register('amount')} />
              {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input type="date" {...register('dueDate')} />
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

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useFacility } from '@/contexts/FacilityContext'
import { auctionService, unitService } from '@/lib/services'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Gavel, Plus } from 'lucide-react'
import { toast } from 'sonner'
import type { AuctionStatus } from '@/types'
import { Timestamp } from 'firebase/firestore'

const auctionSchema = z.object({
  unitId: z.string().min(1),
  noticeDate: z.string().min(1),
  startingBid: z.coerce.number().min(0),
})
type AuctionFormData = z.infer<typeof auctionSchema>

const STATUS_FLOW: AuctionStatus[] = ['notice_sent', 'listed', 'in_progress', 'sold']

function nextStatus(s: AuctionStatus): AuctionStatus | null {
  const i = STATUS_FLOW.indexOf(s)
  return i >= 0 && i < STATUS_FLOW.length - 1 ? STATUS_FLOW[i + 1] : null
}

export function AuctionsPage() {
  const { facilityId, facility } = useFacility()
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data: auctions = [], isLoading } = useQuery({
    queryKey: ['auctions', facilityId],
    queryFn: () => auctionService.listByFacility(facilityId!),
    enabled: !!facilityId,
  })
  const { data: units = [] } = useQuery({
    queryKey: ['units', facilityId],
    queryFn: () => unitService.listByFacility(facilityId!),
    enabled: !!facilityId,
  })

  const delinquentUnits = units.filter((u) => u.status === 'delinquent')

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<AuctionFormData>({
    resolver: zodResolver(auctionSchema) as never,
    defaultValues: { unitId: '', noticeDate: '', startingBid: 0 },
  })

  const createMut = useMutation({
    mutationFn: (data: AuctionFormData) =>
      auctionService.create({
        facilityId: facilityId!,
        businessId: facility!.businessId,
        unitId: data.unitId,
        tenantId: '',
        status: 'notice_sent',
        noticeDate: Timestamp.fromDate(new Date(data.noticeDate)),
        startingBid: data.startingBid,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auctions'] })
      toast.success('Auction created')
      setDialogOpen(false)
      reset()
    },
  })

  const advanceMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AuctionStatus }) => auctionService.update(id, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['auctions'] }); toast.success('Status updated') },
  })

  const cancelMut = useMutation({
    mutationFn: (id: string) => auctionService.update(id, { status: 'cancelled' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['auctions'] }); toast.success('Auction cancelled') },
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Auctions</h1>
          <p className="text-muted-foreground text-sm">{facility?.name}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} disabled={delinquentUnits.length === 0}>
          <Plus className="h-4 w-4 mr-2" />Schedule Auction
        </Button>
      </div>

      {delinquentUnits.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Gavel className="inline h-4 w-4 mr-1" />
          {delinquentUnits.length} delinquent unit{delinquentUnits.length > 1 ? 's' : ''} eligible for auction.
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unit</TableHead>
              <TableHead>Notice Date</TableHead>
              <TableHead>Starting Bid</TableHead>
              <TableHead>Final Bid</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
            ) : auctions.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No auctions</TableCell></TableRow>
            ) : auctions.map((auction) => {
              const next = nextStatus(auction.status)
              const unit = units.find((u) => u.id === auction.unitId)
              const canCancel = auction.status !== 'sold' && auction.status !== 'cancelled'
              return (
                <TableRow key={auction.id}>
                  <TableCell>{unit ? `Unit ${unit.unitNumber}` : auction.unitId}</TableCell>
                  <TableCell>{auction.noticeDate.toDate().toLocaleDateString()}</TableCell>
                  <TableCell>{auction.startingBid != null ? `$${auction.startingBid.toLocaleString()}` : '—'}</TableCell>
                  <TableCell>{auction.finalBid != null ? `$${auction.finalBid.toLocaleString()}` : '—'}</TableCell>
                  <TableCell><StatusBadge status={auction.status} /></TableCell>
                  <TableCell className="flex gap-2">
                    {next && (
                      <Button size="sm" variant="outline" onClick={() => advanceMut.mutate({ id: auction.id, status: next })}>
                        → {next.replace('_', ' ')}
                      </Button>
                    )}
                    {canCancel && (
                      <Button size="sm" variant="destructive" onClick={() => cancelMut.mutate(auction.id)}>Cancel</Button>
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
          <DialogHeader><DialogTitle>Schedule Auction</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit((d) => createMut.mutate(d as AuctionFormData))} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Delinquent Unit</Label>
              <Select onValueChange={(v) => setValue('unitId', v as string)}>
                <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                <SelectContent>
                  {delinquentUnits.map((u) => <SelectItem key={u.id} value={u.id}>Unit {u.unitNumber}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.unitId && <p className="text-xs text-destructive">{errors.unitId.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Notice Date</Label>
              <Input type="date" {...register('noticeDate')} />
            </div>
            <div className="space-y-1.5">
              <Label>Starting Bid ($)</Label>
              <Input type="number" step="0.01" {...register('startingBid')} />
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

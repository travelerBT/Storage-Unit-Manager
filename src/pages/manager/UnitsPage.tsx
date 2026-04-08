import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'
import { useFacility } from '@/contexts/FacilityContext'
import { unitService } from '@/lib/services'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { Plus, Search } from 'lucide-react'
import type { UnitStatus, UnitType } from '@/types'

const statusColors: Record<UnitStatus, string> = {
  available:   'bg-emerald-100 border-emerald-300 hover:bg-emerald-200',
  occupied:    'bg-blue-100 border-blue-300 hover:bg-blue-200',
  reserved:    'bg-purple-100 border-purple-300 hover:bg-purple-200',
  maintenance: 'bg-amber-100 border-amber-300 hover:bg-amber-200',
  delinquent:  'bg-red-100 border-red-300 hover:bg-red-200',
  auctioned:   'bg-slate-100 border-slate-300 hover:bg-slate-200',
}

const schema = z.object({
  unitNumber:    z.string().min(1, 'Unit number is required'),
  type:          z.enum(['standard', 'climate_controlled', 'drive_up', 'outdoor', 'wine', 'vehicle']),
  width:         z.coerce.number().min(1),
  height:        z.coerce.number().min(1),
  pricePerMonth: z.coerce.number().min(0),
  securityDeposit: z.coerce.number().min(0),
  gateCode:      z.string().optional(),
  accessNotes:   z.string().optional(),
})
type FormValues = z.infer<typeof schema>

export function UnitsPage() {
  const { facilityId, facility } = useFacility()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<UnitStatus | 'all'>('all')

  const { data: units = [], isLoading } = useQuery({
    queryKey: ['units', facilityId],
    queryFn: () => unitService.listByFacility(facilityId!),
    enabled: !!facilityId,
  })

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema) as never,
    defaultValues: { type: 'standard', width: 10, height: 10, pricePerMonth: 0, securityDeposit: 0 },
  })

  const create = useMutation({
    mutationFn: (data: FormValues) =>
      unitService.create({
        ...data,
        facilityId: facilityId!,
        businessId: facility!.businessId,
        sqft: data.width * data.height,
        status: 'available' as UnitStatus,
        features: [],
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['units', facilityId] })
      toast.success('Unit created')
      setOpen(false)
      reset()
    },
    onError: () => toast.error('Failed to create unit'),
  })

  const filtered = units.filter((u) => {
    const matchesSearch = u.unitNumber.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const allStatuses: UnitStatus[] = ['available', 'occupied', 'reserved', 'maintenance', 'delinquent', 'auctioned']

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Units</h1>
          <p className="text-muted-foreground text-sm">{units.length} total units</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger>
            <Button><Plus className="mr-2 h-4 w-4" />Add Unit</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>New Unit</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit((d) => create.mutate(d as FormValues))} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Unit #</Label>
                  <Input placeholder="A-101" {...register('unitNumber')} />
                  {errors.unitNumber && <p className="text-destructive text-xs">{errors.unitNumber.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select defaultValue="standard" onValueChange={(v) => setValue('type', v as UnitType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="climate_controlled">Climate Controlled</SelectItem>
                      <SelectItem value="drive_up">Drive-Up</SelectItem>
                      <SelectItem value="outdoor">Outdoor</SelectItem>
                      <SelectItem value="wine">Wine</SelectItem>
                      <SelectItem value="vehicle">Vehicle</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Width (ft)</Label>
                  <Input type="number" {...register('width')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Height (ft)</Label>
                  <Input type="number" {...register('height')} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Monthly Rent ($)</Label>
                  <Input type="number" step="0.01" {...register('pricePerMonth')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Security Deposit ($)</Label>
                  <Input type="number" step="0.01" {...register('securityDeposit')} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Gate Code</Label>
                <Input placeholder="1234" {...register('gateCode')} />
              </div>
              <div className="space-y-1.5">
                <Label>Access Notes</Label>
                <Input placeholder="Additional access instructions..." {...register('accessNotes')} />
              </div>
              <Button type="submit" className="w-full" disabled={create.isPending}>
                Create Unit
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-xs">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
          <Input placeholder="Search unit number..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('all')}
          >
            All
          </Button>
          {allStatuses.map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(s)}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Unit Grid */}
      {isLoading && <p className="text-muted-foreground text-sm">Loading units…</p>}
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
        {filtered.map((unit) => (
          <Link
            key={unit.id}
            to={`/manager/units/${unit.id}`}
            className={cn(
              'flex aspect-square flex-col items-center justify-center rounded-lg border-2 p-1 text-center transition-all',
              statusColors[unit.status],
            )}
          >
            <span className="text-xs font-bold leading-tight">{unit.unitNumber}</span>
            <span className="text-xs leading-tight">{unit.sqft} ft²</span>
          </Link>
        ))}
      </div>

      {!isLoading && filtered.length === 0 && (
        <p className="text-muted-foreground py-8 text-center text-sm">No units found</p>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(statusColors).map(([status, cls]) => (
          <div key={status} className={cn('flex items-center gap-1.5 rounded px-2 py-1 text-xs border', cls)}>
            {status}
          </div>
        ))}
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { facilityService, unitService, deleteFacilityCascade } from '@/lib/services'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { AlertTriangle, Loader2, Plus, MapPin, Trash2 } from 'lucide-react'
import type { Facility, SubscriptionPlan, SubscriptionStatus } from '@/types'

const schema = z.object({
  name:    z.string().min(1, 'Name is required'),
  address: z.string().min(1),
  city:    z.string().min(1),
  state:   z.string().min(2).max(2),
  zip:     z.string().min(5),
  phone:   z.string().optional(),
  email:   z.string().email().optional().or(z.literal('')),
  subscriptionPlan: z.enum(['starter', 'pro', 'enterprise']),
})
type FormValues = z.infer<typeof schema>

// ─── Delete confirmation dialog ───────────────────────────────────────────────

function DeleteFacilityDialog({
  facility,
  open,
  onOpenChange,
  onConfirm,
  isDeleting,
}: {
  facility: Facility
  open: boolean
  onOpenChange: (v: boolean) => void
  onConfirm: () => void
  isDeleting: boolean
}) {
  const [confirmText, setConfirmText] = useState('')
  const matches = confirmText === facility.name

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isDeleting) { onOpenChange(v); setConfirmText('') } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="size-14 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="size-7 text-red-600" />
            </div>
            <DialogTitle className="text-center text-xl text-red-600">
              Delete This Facility?
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-2">
            <p className="font-semibold text-red-700 text-sm">This action is permanent and cannot be undone.</p>
            <p className="text-sm text-red-600">Deleting <strong className="font-bold">{facility.name}</strong> will permanently erase:</p>
            <ul className="text-sm text-red-600 space-y-1 list-none ml-0">
              {[
                'All storage units and their configurations',
                'All tenant records and lease agreements',
                'All invoices and payment history',
                'All maintenance requests',
                'All auction records',
                'All notifications and activity logs',
                'Manager access to this facility',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-0.5 text-red-500 font-bold">✕</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              Type <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">{facility.name}</span> to confirm
            </Label>
            <Input
              placeholder={facility.name}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={isDeleting}
              className={matches ? 'border-red-400 focus-visible:ring-red-400/30' : ''}
              onPaste={(e) => e.preventDefault()}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => { onOpenChange(false); setConfirmText('') }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white border-0"
              disabled={!matches || isDeleting}
              onClick={onConfirm}
            >
              {isDeleting ? (
                <><Loader2 className="mr-2 size-4 animate-spin" />Deleting…</>
              ) : (
                <><Trash2 className="mr-2 size-4" />Delete Forever</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function FacilitiesPage() {
  const { appUser } = useAuth()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Facility | null>(null)

  const { data: facilities = [], isLoading } = useQuery({
    queryKey: ['facilities', appUser?.businessId],
    queryFn: () => facilityService.listByBusiness(appUser!.businessId!),
    enabled: !!appUser?.businessId,
  })

  // Derive live unit counts per facility rather than relying on stale denormalized fields
  const { data: unitCounts = {} } = useQuery({
    queryKey: ['facilities-unit-counts', facilities.map((f) => f.id)],
    queryFn: async () => {
      const results = await Promise.all(
        facilities.map((f) =>
          unitService.listByFacility(f.id).then((units) => ({
            facilityId: f.id,
            total: units.length,
            occupied: units.filter((u) => u.status === 'occupied').length,
          }))
        )
      )
      return Object.fromEntries(results.map((r) => [r.facilityId, r]))
    },
    enabled: facilities.length > 0,
  })

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { subscriptionPlan: 'starter' },
  })

  const create = useMutation({
    mutationFn: (data: FormValues) =>
      facilityService.create({
        ...data,
        businessId:         appUser!.businessId!,
        managerIds:         [],
        subscriptionStatus: 'active' as SubscriptionStatus,
        subscriptionPlan:   data.subscriptionPlan as SubscriptionPlan,
        totalUnits:         0,
        occupiedUnits:      0,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['facilities'] })
      toast.success('Facility created')
      setOpen(false)
      reset()
    },
    onError: (err) => {
      console.error('Failed to create facility:', err)
      toast.error('Failed to create facility')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (facilityId: string) => deleteFacilityCascade(facilityId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['facilities'] })
      toast.success('Facility permanently deleted')
      setDeleteTarget(null)
    },
    onError: (err) => {
      console.error('Failed to delete facility:', err)
      toast.error('Delete failed — please try again')
    },
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Facilities</h1>
          <p className="text-muted-foreground text-sm">Manage your storage locations</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger>
            <Button><Plus className="mr-2 h-4 w-4" />Add Facility</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>New Facility</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit((d) => create.mutate(d))} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>Facility Name</Label>
                <Input placeholder="Main Street Storage" {...register('name')} />
                {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Address</Label>
                <Input placeholder="123 Main St" {...register('address')} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label>City</Label>
                  <Input {...register('city')} />
                </div>
                <div className="space-y-1.5">
                  <Label>State</Label>
                  <Input placeholder="TX" maxLength={2} className="uppercase" {...register('state')} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>ZIP</Label>
                  <Input {...register('zip')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input {...register('phone')} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" {...register('email')} />
              </div>
              <div className="space-y-1.5">
                <Label>Subscription Plan</Label>
                <Select defaultValue="starter" onValueChange={(v) => setValue('subscriptionPlan', v as 'starter' | 'pro' | 'enterprise')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={create.isPending}>
                Create Facility
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {facilities.map((f) => {
          const counts = unitCounts[f.id]
          const total    = counts?.total    ?? f.totalUnits
          const occupied = counts?.occupied ?? f.occupiedUnits
          const rate = total > 0 ? Math.round((occupied / total) * 100) : 0
          return (
            <Card key={f.id} className="hover:shadow-md transition-shadow">
              <Link to={`/owner/facilities/${f.id}`} className="block">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{f.name}</CardTitle>
                    <StatusBadge status={f.subscriptionStatus} />
                  </div>
                  <div className="text-muted-foreground flex items-center gap-1 text-xs">
                    <MapPin className="h-3 w-3" />
                    {f.address}, {f.city}, {f.state} {f.zip}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Units</span>
                    <span>{occupied}/{total} occupied ({rate}%)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Plan</span>
                    <span className="capitalize">{f.subscriptionPlan}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Managers</span>
                    <span>{f.managerIds.length}</span>
                  </div>
                </CardContent>
              </Link>
              {/* Delete button sits outside the Link so it doesn't navigate */}
              <div className="px-6 pb-4">
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); setDeleteTarget(f) }}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-600 transition-colors"
                >
                  <Trash2 className="size-3" />Delete facility
                </button>
              </div>
            </Card>
          )
        })}
        {!isLoading && facilities.length === 0 && (
          <div className="col-span-full text-muted-foreground py-12 text-center text-sm">
            No facilities yet. Click "Add Facility" to create your first one.
          </div>
        )}
      </div>

      {deleteTarget && (
        <DeleteFacilityDialog
          facility={deleteTarget}
          open={!!deleteTarget}
          onOpenChange={(v) => { if (!v) setDeleteTarget(null) }}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          isDeleting={deleteMutation.isPending}
        />
      )}
    </div>
  )
}

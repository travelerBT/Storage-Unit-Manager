import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { facilityService } from '@/lib/services'
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
import { Plus, MapPin } from 'lucide-react'
import type { SubscriptionPlan, SubscriptionStatus } from '@/types'

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

export function FacilitiesPage() {
  const { appUser } = useAuth()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)

  const { data: facilities = [], isLoading } = useQuery({
    queryKey: ['facilities', appUser?.businessId],
    queryFn: () => facilityService.listByBusiness(appUser!.businessId!),
    enabled: !!appUser?.businessId,
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
          const rate = f.totalUnits > 0 ? Math.round((f.occupiedUnits / f.totalUnits) * 100) : 0
          return (
            <Card key={f.id} className="hover:shadow-md transition-shadow">
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
                  <span>{f.occupiedUnits}/{f.totalUnits} occupied ({rate}%)</span>
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
            </Card>
          )
        })}
        {!isLoading && facilities.length === 0 && (
          <div className="col-span-full text-muted-foreground py-12 text-center text-sm">
            No facilities yet. Click "Add Facility" to create your first one.
          </div>
        )}
      </div>
    </div>
  )
}

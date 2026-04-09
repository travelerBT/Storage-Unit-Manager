import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { facilityService, unitService, tenantService, usersService } from '@/lib/services'
import { StatCard } from '@/components/shared/StatCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Warehouse, Users, DollarSign, Wrench,
  MapPin, Phone, Mail, Building2, ArrowLeft,
  Edit2, Plus, Settings, Bot,
} from 'lucide-react'
import type { SubscriptionPlan, SubscriptionStatus, UnitType } from '@/types'

// ─── Edit facility schema ─────────────────────────────────────────────────────

const editSchema = z.object({
  name:              z.string().min(1),
  address:           z.string().min(1),
  city:              z.string().min(1),
  state:             z.string().min(2).max(2),
  zip:               z.string().min(5),
  phone:             z.string().optional(),
  email:             z.string().email().optional().or(z.literal('')),
  gateInstructions:  z.string().optional(),
  subscriptionPlan:  z.enum(['starter', 'pro', 'enterprise']),
  subscriptionStatus: z.enum(['active', 'inactive', 'suspended', 'trial']),
})
type EditValues = z.infer<typeof editSchema>

// ─── Add unit schema ──────────────────────────────────────────────────────────

const unitSchema = z.object({
  unitNumber:      z.string().min(1, 'Required'),
  building:        z.string().optional(),
  type:            z.enum(['standard', 'climate_controlled', 'drive_up', 'outdoor', 'wine', 'vehicle']),
  width:           z.coerce.number().min(1),
  height:          z.coerce.number().min(1),
  sqft:            z.coerce.number().min(1),
  pricePerMonth:   z.coerce.number().min(0),
  securityDeposit: z.coerce.number().min(0),
})
type UnitValues = {
  unitNumber: string
  building?: string
  type: UnitType
  width: number
  height: number
  sqft: number
  pricePerMonth: number
  securityDeposit: number
}

const UNIT_TYPE_LABELS: Record<UnitType, string> = {
  standard:          'Standard',
  climate_controlled:'Climate Controlled',
  drive_up:          'Drive-Up',
  outdoor:           'Outdoor',
  wine:              'Wine',
  vehicle:           'Vehicle',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FacilityDetailPage() {
  const { facilityId } = useParams<{ facilityId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [addUnitOpen, setAddUnitOpen] = useState(false)

  // ── Data queries ────────────────────────────────────────────────────────────

  const { data: facility, isLoading } = useQuery({
    queryKey: ['facility', facilityId],
    queryFn: () => facilityService.getById(facilityId!),
    enabled: !!facilityId,
  })

  const { data: units = [], error: unitsError } = useQuery({
    queryKey: ['units', facilityId],
    queryFn: () => unitService.listByFacility(facilityId!),
    enabled: !!facilityId,
  })
  if (unitsError) console.error('[units query error]', unitsError)

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants', facilityId],
    queryFn: () => tenantService.listByFacility(facilityId!),
    enabled: !!facilityId,
  })

  const { data: managers = [] } = useQuery({
    queryKey: ['facility-managers', facility?.managerIds],
    queryFn: async () => {
      if (!facility?.managerIds?.length) return []
      const results = await Promise.all(facility.managerIds.map((id) => usersService.getById(id)))
      return results.filter(Boolean)
    },
    enabled: !!facility,
  })

  // ── Stats ───────────────────────────────────────────────────────────────────

  const totalUnits    = units.length
  const occupiedUnits = units.filter((u) => u.status === 'occupied').length
  const availUnits    = units.filter((u) => u.status === 'available').length
  const delinquentUnits = units.filter((u) => u.status === 'delinquent').length
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0
  const monthlyRevenue = units
    .filter((u) => u.status === 'occupied')
    .reduce((sum, u) => sum + u.pricePerMonth, 0)

  // ── Edit facility mutation ──────────────────────────────────────────────────

  const editForm = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    values: facility ? {
      name:               facility.name,
      address:            facility.address,
      city:               facility.city,
      state:              facility.state,
      zip:                facility.zip,
      phone:              facility.phone ?? '',
      email:              facility.email ?? '',
      gateInstructions:   facility.gateInstructions ?? '',
      subscriptionPlan:   facility.subscriptionPlan,
      subscriptionStatus: facility.subscriptionStatus,
    } : undefined,
  })

  const editMutation = useMutation({
    mutationFn: (data: EditValues) => facilityService.update(facilityId!, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['facility', facilityId] })
      void qc.invalidateQueries({ queryKey: ['facilities'] })
      toast.success('Facility updated')
      setEditOpen(false)
    },
    onError: () => toast.error('Failed to update facility'),
  })

  // ── Add unit mutation ───────────────────────────────────────────────────────

  const unitForm = useForm<UnitValues>({
    resolver: zodResolver(unitSchema) as never,
    defaultValues: { type: 'standard', width: 10, height: 10, sqft: 100, pricePerMonth: 0, securityDeposit: 0 },
  })

  const addUnitMutation = useMutation({
    mutationFn: (data: UnitValues) =>
      unitService.create({
        ...data,
        facilityId: facilityId!,
        businessId: facility!.businessId,
        status:     'available',
        features:   [],
      }),
    onSuccess: async () => {
      // Increment totalUnits on the facility doc
      await facilityService.update(facilityId!, { totalUnits: totalUnits + 1 })
      void qc.invalidateQueries({ queryKey: ['units', facilityId] })
      void qc.invalidateQueries({ queryKey: ['facility', facilityId] })
      toast.success('Unit added')
      setAddUnitOpen(false)
      unitForm.reset()
    },
    onError: () => toast.error('Failed to add unit'),
  })

  // ── Loading / not found ─────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
      </div>
    )
  }

  if (!facility) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">Facility not found.</p>
        <Button variant="link" asChild><Link to="/owner/facilities">Back to Facilities</Link></Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" asChild className="-ml-2 mt-0.5">
            <Link to="/owner/facilities"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{facility.name}</h1>
              <StatusBadge status={facility.subscriptionStatus} />
            </div>
            <p className="text-muted-foreground flex items-center gap-1 text-sm">
              <MapPin className="h-3.5 w-3.5" />
              {facility.address}, {facility.city}, {facility.state} {facility.zip}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/owner/facilities/${facilityId}/setup-units`)}
          >
            <Bot className="mr-2 h-3.5 w-3.5 text-violet-600" />AI Unit Setup
          </Button>

          {/* Edit facility */}
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogTrigger nativeButton={true} render={<Button variant="outline" size="sm"><Edit2 className="mr-2 h-3.5 w-3.5" />Edit Facility</Button>} />
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Edit Facility</DialogTitle></DialogHeader>
            <form onSubmit={editForm.handleSubmit((d) => editMutation.mutate(d))} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input {...editForm.register('name')} />
              </div>
              <div className="space-y-1.5">
                <Label>Address</Label>
                <Input {...editForm.register('address')} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label>City</Label>
                  <Input {...editForm.register('city')} />
                </div>
                <div className="space-y-1.5">
                  <Label>State</Label>
                  <Input maxLength={2} className="uppercase" {...editForm.register('state')} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>ZIP</Label>
                  <Input {...editForm.register('zip')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input {...editForm.register('phone')} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" {...editForm.register('email')} />
              </div>
              <div className="space-y-1.5">
                <Label>Gate Instructions</Label>
                <Input placeholder="e.g. Gate code is 1234#" {...editForm.register('gateInstructions')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Plan</Label>
                  <Select
                    defaultValue={facility.subscriptionPlan}
                    onValueChange={(v) => editForm.setValue('subscriptionPlan', v as SubscriptionPlan)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select
                    defaultValue={facility.subscriptionStatus}
                    onValueChange={(v) => editForm.setValue('subscriptionStatus', v as SubscriptionStatus)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={editMutation.isPending}>
                Save Changes
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Units"     value={totalUnits}      icon={Warehouse}  iconClassName="bg-blue-100 text-blue-700" />
        <StatCard title="Occupied"        value={`${occupiedUnits} (${occupancyRate}%)`} icon={Users} iconClassName="bg-emerald-100 text-emerald-700" />
        <StatCard title="Monthly Revenue" value={`$${monthlyRevenue.toLocaleString()}`} icon={DollarSign} iconClassName="bg-violet-100 text-violet-700" />
        <StatCard title="Delinquent"      value={delinquentUnits} icon={Wrench}      iconClassName="bg-red-100 text-red-700" />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="units">
        <TabsList>
          <TabsTrigger value="units">Units ({totalUnits})</TabsTrigger>
          <TabsTrigger value="tenants">Tenants ({tenants.length})</TabsTrigger>
          <TabsTrigger value="managers">Managers ({managers.length})</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        {/* ── Units tab ──────────────────────────────────────────────────────── */}
        <TabsContent value="units" className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex gap-2 text-sm text-muted-foreground">
              <span className="text-emerald-600 font-medium">{availUnits} available</span>
              <span>·</span>
              <span>{occupiedUnits} occupied</span>
              {delinquentUnits > 0 && <><span>·</span><span className="text-red-600 font-medium">{delinquentUnits} delinquent</span></>}
            </div>
            <Dialog open={addUnitOpen} onOpenChange={setAddUnitOpen}>
              <DialogTrigger nativeButton={true} render={<Button size="sm"><Plus className="mr-2 h-3.5 w-3.5" />Add Unit</Button>} />
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Add Unit</DialogTitle></DialogHeader>
                <form onSubmit={unitForm.handleSubmit((d) => addUnitMutation.mutate(d as UnitValues))} className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Unit Number *</Label>
                      <Input placeholder="A101" {...unitForm.register('unitNumber')} />
                      {unitForm.formState.errors.unitNumber && (
                        <p className="text-xs text-destructive">{unitForm.formState.errors.unitNumber.message}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label>Building</Label>
                      <Input placeholder="A" {...unitForm.register('building')} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Type</Label>
                    <Select defaultValue="standard" onValueChange={(v) => unitForm.setValue('type', v as UnitType)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(UNIT_TYPE_LABELS) as UnitType[]).map((t) => (
                          <SelectItem key={t} value={t}>{UNIT_TYPE_LABELS[t]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label>Width (ft)</Label>
                      <Input type="number" {...unitForm.register('width')} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Height (ft)</Label>
                      <Input type="number" {...unitForm.register('height')} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Sq ft</Label>
                      <Input type="number" {...unitForm.register('sqft')} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Price/month ($)</Label>
                      <Input type="number" {...unitForm.register('pricePerMonth')} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Security deposit ($)</Label>
                      <Input type="number" {...unitForm.register('securityDeposit')} />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={addUnitMutation.isPending}>
                    Add Unit
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {units.length === 0 ? (
            <div className="py-14 text-center flex flex-col items-center gap-3">
              <div className="size-12 rounded-full bg-violet-100 flex items-center justify-center">
                <Bot className="size-6 text-violet-600" />
              </div>
              <div>
                <p className="font-semibold">No units yet</p>
                <p className="text-sm text-muted-foreground mt-0.5">Use AI to map your floor plan, or add units manually.</p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => navigate(`/owner/facilities/${facilityId}/setup-units`)}
                >
                  <Bot className="mr-2 size-3.5" />AI Unit Setup
                </Button>
              </div>
            </div>
          ) : (() => {
            // Group by floor (undefined floors grouped under null)
            const floorMap = new Map<number | null, typeof units>()
            for (const u of [...units].sort((a, b) => a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true }))) {
              const key = u.floor ?? null
              if (!floorMap.has(key)) floorMap.set(key, [])
              floorMap.get(key)!.push(u)
            }
            const floorKeys = [...floorMap.keys()].sort((a, b) => {
              if (a === null) return 1
              if (b === null) return -1
              return a - b
            })
            return (
              <div className="space-y-4">
                {floorKeys.map((floor) => (
                  <div key={floor ?? 'unassigned'} className="rounded-lg border overflow-hidden">
                    <div className="bg-muted/50 px-4 py-2 flex items-center justify-between">
                      <span className="text-sm font-semibold">
                        {floor != null ? `Floor ${floor}` : 'Unassigned Floor'}
                      </span>
                      <span className="text-xs text-muted-foreground">{floorMap.get(floor)!.length} units</span>
                    </div>
                    <table className="w-full text-sm">
                      <thead className="bg-muted/20 text-muted-foreground border-b">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium">Unit</th>
                          <th className="px-4 py-2 text-left font-medium">Type</th>
                          <th className="px-4 py-2 text-left font-medium">Size</th>
                          <th className="px-4 py-2 text-right font-medium">Price/mo</th>
                          <th className="px-4 py-2 text-left font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {floorMap.get(floor)!.map((u) => (
                          <tr
                            key={u.id}
                            className="hover:bg-muted/30 transition-colors cursor-pointer"
                            onClick={() => navigate(`/owner/facilities/${facilityId}/units/${u.id}`)}
                          >
                            <td className="px-4 py-3 font-medium">
                              {u.building ? `${u.building}-` : ''}{u.unitNumber}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{UNIT_TYPE_LABELS[u.type]}</td>
                            <td className="px-4 py-3 text-muted-foreground">{u.sqft > 0 ? `${u.sqft} sqft` : '—'}</td>
                            <td className="px-4 py-3 text-right">${u.pricePerMonth.toLocaleString()}</td>
                            <td className="px-4 py-3"><StatusBadge status={u.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )
          })()}
        </TabsContent>

        {/* ── Tenants tab ────────────────────────────────────────────────────── */}
        <TabsContent value="tenants" className="mt-4">
          {tenants.length === 0 ? (
            <div className="text-muted-foreground py-12 text-center text-sm">No active tenants.</div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium">Tenant ID</th>
                    <th className="px-4 py-2.5 text-left font-medium">Units</th>
                    <th className="px-4 py-2.5 text-left font-medium">Status</th>
                    <th className="px-4 py-2.5 text-left font-medium">Move-in</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {tenants.map((t) => (
                    <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{t.id.slice(0, 8)}…</td>
                      <td className="px-4 py-3">{t.unitIds.length}</td>
                      <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {t.moveInDate ? new Date(t.moveInDate.seconds * 1000).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ── Managers tab ───────────────────────────────────────────────────── */}
        <TabsContent value="managers" className="mt-4 space-y-3">
          {managers.length === 0 ? (
            <div className="text-muted-foreground py-12 text-center text-sm">
              No managers assigned. Go to{' '}
              <Link to="/owner/managers" className="text-primary hover:underline">Managers</Link>{' '}
              to invite or assign one.
            </div>
          ) : (
            <div className="space-y-2">
              {managers.map((m) => m && (
                <div key={m.id} className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">{m.displayName}</p>
                    <p className="text-muted-foreground text-xs">{m.email}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">Manager</Badge>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Details tab ────────────────────────────────────────────────────── */}
        <TabsContent value="details" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Building2 className="h-4 w-4" />Contact Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span>{facility.address}, {facility.city}, {facility.state} {facility.zip}</span>
                </div>
                {facility.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4 shrink-0" />
                    <span>{facility.phone}</span>
                  </div>
                )}
                {facility.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4 shrink-0" />
                    <span>{facility.email}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Settings className="h-4 w-4" />Subscription
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="capitalize font-medium">{facility.subscriptionPlan}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <StatusBadge status={facility.subscriptionStatus} />
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span>{facility.createdAt ? new Date(facility.createdAt.seconds * 1000).toLocaleDateString() : '—'}</span>
                </div>
              </CardContent>
            </Card>

            {facility.gateInstructions && (
              <Card className="sm:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Gate Instructions</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{facility.gateInstructions}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

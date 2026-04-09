import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Timestamp } from 'firebase/firestore'
import { useAuth } from '@/contexts/AuthContext'
import { unitService, tenantService, leaseService, usersService, invoiceService } from '@/lib/services'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft, Edit2, KeyRound, User, Warehouse, DollarSign, Receipt, Loader2, UserPlus, UserMinus,
} from 'lucide-react'
import type { UnitStatus, UnitType, Invoice } from '@/types'

// ─── Edit schema ──────────────────────────────────────────────────────────────

const editSchema = z.object({
  unitNumber:      z.string().min(1, 'Required'),
  building:        z.string().optional(),
  floor:           z.coerce.number().optional(),
  type:            z.enum(['standard', 'climate_controlled', 'drive_up', 'outdoor', 'wine', 'vehicle']),
  width:           z.coerce.number().min(0),
  height:          z.coerce.number().min(0),
  sqft:            z.coerce.number().min(0),
  pricePerMonth:   z.coerce.number().min(0),
  securityDeposit: z.coerce.number().min(0),
  gateCode:        z.string().optional(),
  accessNotes:     z.string().optional(),
})
type EditValues = z.infer<typeof editSchema>

const UNIT_TYPE_LABELS: Record<UnitType, string> = {
  standard:           'Standard',
  climate_controlled: 'Climate Controlled',
  drive_up:           'Drive-Up',
  outdoor:            'Outdoor',
  wine:               'Wine',
  vehicle:            'Vehicle',
}

// ─── Assign tenant schema ─────────────────────────────────────────────────────

const DEFAULT_LEASE_TERMS = `STORAGE UNIT RENTAL AGREEMENT

This Storage Unit Rental Agreement ("Agreement") is entered into between the Facility ("Landlord") and the Tenant identified below.

1. UNIT USE: The storage unit is for personal property storage only. No hazardous materials, living purposes, or illegal activities are permitted.

2. RENT: Monthly rent is due on the 1st of each month. A late fee applies after the 5th day.

3. ACCESS: Tenant may access the unit during facility hours using the provided gate code.

4. INSURANCE: Tenant is responsible for insuring stored property. Landlord is not liable for loss or damage.

5. TERMINATION: Either party may terminate this agreement with 30 days written notice.

6. ABANDONED PROPERTY: Units unpaid for 30+ days may be subjected to lien and auction proceedings per applicable state law.

By signing below, Tenant agrees to all terms of this Agreement.`

const assignSchema = z.object({
  tenantEmail:     z.string().email('Enter a valid email'),
  startDate:       z.string().min(1, 'Required'),
  endDate:         z.string().optional(),
  monthlyRent:     z.coerce.number().min(0),
  securityDeposit: z.coerce.number().min(0),
})
type AssignValues = z.infer<typeof assignSchema>

// ─── Component ────────────────────────────────────────────────────────────────

export function OwnerUnitDetailPage() {
  const { facilityId, unitId } = useParams<{ facilityId: string; unitId: string }>()
  const qc = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const { appUser } = useAuth()

  const { data: unit, isLoading } = useQuery({
    queryKey: ['unit', unitId],
    queryFn: () => unitService.getById(unitId!),
    enabled: !!unitId,
  })

  const { data: tenant } = useQuery({
    queryKey: ['tenant', unit?.currentTenantId],
    queryFn: () => tenantService.getById(unit!.currentTenantId!),
    enabled: !!unit?.currentTenantId,
  })

  const { data: tenantUser } = useQuery({
    queryKey: ['user', tenant?.userId],
    queryFn: () => usersService.getById(tenant!.userId),
    enabled: !!tenant?.userId,
  })

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices-unit', unitId],
    queryFn: () => invoiceService.listByUnit(unitId!),
    enabled: !!unitId,
  })

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users-all'],
    queryFn: () => usersService.listAll(),
    enabled: assignOpen,
  })

  const assignForm = useForm<AssignValues>({
    resolver: zodResolver(assignSchema) as never,
    defaultValues: {
      tenantEmail:     '',
      startDate:       new Date().toISOString().split('T')[0],
      endDate:         '',
      monthlyRent:     0,
      securityDeposit: 0,
    },
  })

  const editForm = useForm<EditValues>({
    resolver: zodResolver(editSchema) as never,
    values: unit ? {
      unitNumber:      unit.unitNumber,
      building:        unit.building ?? '',
      floor:           unit.floor,
      type:            unit.type,
      width:           unit.width,
      height:          unit.height,
      sqft:            unit.sqft,
      pricePerMonth:   unit.pricePerMonth,
      securityDeposit: unit.securityDeposit,
      gateCode:        unit.gateCode ?? '',
      accessNotes:     unit.accessNotes ?? '',
    } : undefined,
  })

  const editMutation = useMutation({
    mutationFn: (data: EditValues) => unitService.update(unitId!, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['unit', unitId] })
      void qc.invalidateQueries({ queryKey: ['units', facilityId] })
      toast.success('Unit updated')
      setEditOpen(false)
    },
    onError: () => toast.error('Failed to update unit'),
  })

  const updateStatus = useMutation({
    mutationFn: (status: UnitStatus) => unitService.update(unitId!, { status }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['unit', unitId] })
      void qc.invalidateQueries({ queryKey: ['units', facilityId] })
      toast.success('Status updated')
    },
    onError: () => toast.error('Failed to update status'),
  })

  const assignMutation = useMutation({
    mutationFn: async (data: AssignValues) => {
      const user = allUsers.find((u) => u.email === data.tenantEmail)
      if (!user) throw new Error('No account found with that email. Ask the tenant to register first.')

      const startTs = Timestamp.fromDate(new Date(data.startDate))
      const endTs   = data.endDate ? Timestamp.fromDate(new Date(data.endDate)) : undefined

      await tenantService.create(user.id, {
        userId:     user.id,
        facilityId: unit!.facilityId,
        businessId: unit!.businessId,
        unitIds:    [unitId!],
        status:     'active',
        moveInDate: startTs,
      })

      await leaseService.create({
        tenantId:     user.id,
        unitId:       unitId!,
        facilityId:   unit!.facilityId,
        businessId:   unit!.businessId,
        monthlyRent:  data.monthlyRent,
        securityDeposit: data.securityDeposit,
        startDate:    startTs,
        endDate:      endTs,
        terms:        DEFAULT_LEASE_TERMS,
        status:       'active',
        tenantSignatureAcknowledged: false,
        createdBy:    appUser!.id,
      })

      await unitService.update(unitId!, { status: 'occupied', currentTenantId: user.id })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['unit', unitId] })
      void qc.invalidateQueries({ queryKey: ['units', facilityId] })
      void qc.invalidateQueries({ queryKey: ['tenant', unit?.currentTenantId] })
      toast.success('Tenant assigned successfully')
      setAssignOpen(false)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const unassignMutation = useMutation({
    mutationFn: async () => {
      if (!tenant) return
      const updatedUnitIds = tenant.unitIds.filter((id) => id !== unitId)
      await tenantService.update(tenant.id, {
        unitIds: updatedUnitIds,
        ...(updatedUnitIds.length === 0 ? { status: 'moved_out' } : {}),
      })
      await unitService.update(unitId!, {
        status: 'available',
        currentTenantId: null as unknown as string,
      })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['unit', unitId] })
      void qc.invalidateQueries({ queryKey: ['units', facilityId] })
      void qc.invalidateQueries({ queryKey: ['tenant', unit?.currentTenantId] })
      toast.success('Tenant unassigned')
    },
    onError: () => toast.error('Failed to unassign tenant'),
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
      </div>
    )
  }

  if (!unit) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">Unit not found.</p>
        <Button variant="link" asChild>
          <Link to={`/owner/facilities/${facilityId}`}>Back to Facility</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="-ml-2">
            <Link to={`/owner/facilities/${facilityId}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight">
                {unit.building ? `${unit.building}-` : ''}Unit {unit.unitNumber}
              </h1>
              <StatusBadge status={unit.status} />
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">
              {UNIT_TYPE_LABELS[unit.type]}
              {unit.floor != null && ` · Floor ${unit.floor}`}
            </p>
          </div>
        </div>

        {/* Edit button */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogTrigger nativeButton={true} render={<Button variant="outline" size="sm"><Edit2 className="mr-2 h-3.5 w-3.5" />Edit Unit</Button>} />
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Edit Unit</DialogTitle></DialogHeader>
            <form
              onSubmit={editForm.handleSubmit((d) => editMutation.mutate(d as EditValues))}
              className="space-y-4 pt-2"
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Unit Number *</Label>
                  <Input {...editForm.register('unitNumber')} />
                  {editForm.formState.errors.unitNumber && (
                    <p className="text-xs text-destructive">{editForm.formState.errors.unitNumber.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Building</Label>
                  <Input placeholder="A" {...editForm.register('building')} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Floor</Label>
                  <Input type="number" min={1} {...editForm.register('floor')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select
                    defaultValue={unit.type}
                    onValueChange={(v) => editForm.setValue('type', v as UnitType)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(UNIT_TYPE_LABELS) as UnitType[]).map((t) => (
                        <SelectItem key={t} value={t}>{UNIT_TYPE_LABELS[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Width (ft)</Label>
                  <Input type="number" min={0} {...editForm.register('width')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Height (ft)</Label>
                  <Input type="number" min={0} {...editForm.register('height')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Sq ft</Label>
                  <Input type="number" min={0} {...editForm.register('sqft')} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Price / month ($)</Label>
                  <Input type="number" min={0} step={0.01} {...editForm.register('pricePerMonth')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Security deposit ($)</Label>
                  <Input type="number" min={0} step={0.01} {...editForm.register('securityDeposit')} />
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Gate code</Label>
                  <Input placeholder="e.g. 1234#" {...editForm.register('gateCode')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Access notes</Label>
                  <Input placeholder="e.g. Side entrance" {...editForm.register('accessNotes')} />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={editMutation.isPending}>
                Save Changes
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Cards */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Unit details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Warehouse className="h-4 w-4 text-muted-foreground" />Unit Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Unit Number"  value={unit.unitNumber} />
            {unit.building && <Row label="Building"     value={unit.building} />}
            {unit.floor != null && <Row label="Floor"  value={`Floor ${unit.floor}`} />}
            <Row label="Type"         value={UNIT_TYPE_LABELS[unit.type]} />
            <Row
              label="Dimensions"
              value={unit.width && unit.height
                ? `${unit.width}' × ${unit.height}' (${unit.sqft} sq ft)`
                : unit.sqft > 0 ? `${unit.sqft} sq ft` : '—'}
            />
            {unit.features.length > 0 && (
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground shrink-0">Features</span>
                <div className="flex flex-wrap gap-1 justify-end">
                  {unit.features.map((f) => (
                    <Badge key={f} variant="outline" className="text-xs">{f}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pricing */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />Pricing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Monthly Rent"     value={`$${unit.pricePerMonth.toLocaleString()}/mo`} />
            <Row label="Security Deposit" value={`$${unit.securityDeposit.toLocaleString()}`} />
          </CardContent>
        </Card>

        {/* Access */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-muted-foreground" />Access
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Gate Code"    value={unit.gateCode    ?? '—'} />
            <Row label="Access Notes" value={unit.accessNotes ?? '—'} />
          </CardContent>
        </Card>

        {/* Tenant */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />Current Tenant
              </CardTitle>
              {tenant ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive h-7 px-2 text-xs"
                  onClick={() => unassignMutation.mutate()}
                  disabled={unassignMutation.isPending}
                >
                  {unassignMutation.isPending
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <><UserMinus className="h-3 w-3 mr-1" />Unassign</>}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setAssignOpen(true)}
                >
                  <UserPlus className="h-3 w-3 mr-1" />Assign Tenant
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="text-sm">
            {tenant ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <p className="font-medium">
                    {tenantUser?.displayName ?? tenantUser?.email ?? tenant.userId}
                  </p>
                  {tenantUser?.email && (
                    <p className="text-muted-foreground text-xs">{tenantUser.email}</p>
                  )}
                  {tenantUser?.phone && (
                    <p className="text-muted-foreground text-xs">{tenantUser.phone}</p>
                  )}
                </div>
                <StatusBadge status={tenant.status} />
              </div>
            ) : (
              <p className="text-muted-foreground text-xs">No tenant assigned. Use "Assign Tenant" to link a registered user.</p>
            )}
          </CardContent>
        </Card>

        {/* Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Change Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={unit.status}
              onValueChange={(v) => updateStatus.mutate(v as UnitStatus)}
              disabled={updateStatus.isPending}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="occupied">Occupied</SelectItem>
                <SelectItem value="reserved">Reserved</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="delinquent">Delinquent</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Billing History */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4 text-muted-foreground" />Billing History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No invoices yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="pb-2 text-left font-medium text-muted-foreground">Invoice #</th>
                      <th className="pb-2 text-left font-medium text-muted-foreground">Period</th>
                      <th className="pb-2 text-left font-medium text-muted-foreground">Due Date</th>
                      <th className="pb-2 text-right font-medium text-muted-foreground">Amount</th>
                      <th className="pb-2 text-right font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {invoices.map((inv: Invoice) => (
                      <tr key={inv.id}>
                        <td className="py-2 pr-4">{inv.invoiceNumber}</td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {inv.periodStart.toDate().toLocaleDateString()} – {inv.periodEnd.toDate().toLocaleDateString()}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {inv.dueDate.toDate().toLocaleDateString()}
                        </td>
                        <td className="py-2 text-right font-medium">${inv.totalDue.toLocaleString()}</td>
                        <td className="py-2 text-right pl-4">
                          <StatusBadge status={inv.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Assign Tenant Dialog */}
      <Dialog
        open={assignOpen}
        onOpenChange={(open) => {
          setAssignOpen(open)
          if (open && unit) {
            assignForm.reset({
              tenantEmail:     '',
              startDate:       new Date().toISOString().split('T')[0],
              endDate:         '',
              monthlyRent:     unit.pricePerMonth,
              securityDeposit: unit.securityDeposit,
            })
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Tenant to Unit {unit.unitNumber}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={assignForm.handleSubmit((d) => assignMutation.mutate(d as AssignValues))}
            className="space-y-4 pt-2"
          >
            <div className="space-y-1.5">
              <Label>Tenant Email *</Label>
              <Input type="email" placeholder="tenant@example.com" {...assignForm.register('tenantEmail')} />
              <p className="text-muted-foreground text-xs">The tenant must already have a registered account.</p>
              {assignForm.formState.errors.tenantEmail && (
                <p className="text-xs text-destructive">{assignForm.formState.errors.tenantEmail.message}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Date *</Label>
                <Input type="date" {...assignForm.register('startDate')} />
                {assignForm.formState.errors.startDate && (
                  <p className="text-xs text-destructive">{assignForm.formState.errors.startDate.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>
                  End Date{' '}
                  <span className="text-muted-foreground text-xs">(blank = month-to-month)</span>
                </Label>
                <Input type="date" {...assignForm.register('endDate')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Monthly Rent ($)</Label>
                <Input type="number" min={0} step={0.01} {...assignForm.register('monthlyRent')} />
              </div>
              <div className="space-y-1.5">
                <Label>Security Deposit ($)</Label>
                <Input type="number" min={0} step={0.01} {...assignForm.register('securityDeposit')} />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={assignMutation.isPending}>
              {assignMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Assign Tenant
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  )
}

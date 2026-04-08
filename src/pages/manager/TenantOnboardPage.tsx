import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Timestamp } from 'firebase/firestore'
import { useAuth } from '@/contexts/AuthContext'
import { useFacility } from '@/contexts/FacilityContext'
import { unitService, tenantService, leaseService, usersService } from '@/lib/services'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

const DEFAULT_LEASE_TERMS = `STORAGE UNIT RENTAL AGREEMENT

This Storage Unit Rental Agreement ("Agreement") is entered into between the Facility ("Landlord") and the Tenant identified below.

1. UNIT USE: The storage unit is for personal property storage only. No hazardous materials, living purposes, or illegal activities are permitted.

2. RENT: Monthly rent is due on the 1st of each month. A late fee applies after the 5th day.

3. ACCESS: Tenant may access the unit during facility hours using the provided gate code.

4. INSURANCE: Tenant is responsible for insuring stored property. Landlord is not liable for loss or damage.

5. TERMINATION: Either party may terminate this agreement with 30 days written notice.

6. ABANDONED PROPERTY: Units unpaid for 30+ days may be subjected to lien and auction proceedings per applicable state law.

By signing below, Tenant agrees to all terms of this Agreement.`

const schema = z.object({
  // User lookup
  tenantEmail: z.string().email('Enter a valid email'),
  // Unit
  unitId: z.string().min(1, 'Select a unit'),
  // Lease
  startDate:      z.string().min(1),
  endDate:        z.string().optional(),
  monthlyRent:    z.coerce.number().min(0),
  securityDeposit: z.coerce.number().min(0),
  terms:          z.string().min(10),
  agreed:         z.boolean().refine((v) => v === true, 'Tenant must agree to terms'),
})
type FormValues = z.infer<typeof schema>

export function TenantOnboardPage() {
  const { appUser } = useAuth()
  const { facilityId, facility } = useFacility()
  const qc = useQueryClient()
  const navigate = useNavigate()

  const { data: units = [] } = useQuery({
    queryKey: ['units', facilityId],
    queryFn: () => unitService.listByFacility(facilityId!),
    enabled: !!facilityId,
  })
  const { data: allUsers = [] } = useQuery({
    queryKey: ['users-all'],
    queryFn: () => usersService.listAll(),
  })

  const availableUnits = units.filter((u) => u.status === 'available')

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema) as never,
    defaultValues: {
      terms: DEFAULT_LEASE_TERMS,
      startDate: new Date().toISOString().split('T')[0],
    },
  })

  const onboard = useMutation({
    mutationFn: async (data: FormValues) => {
      // Find user by email
      const user = allUsers.find((u) => u.email === data.tenantEmail)
      if (!user) throw new Error('No user found with that email. Ask them to register first.')

      const unit = units.find((u) => u.id === data.unitId)
      if (!unit) throw new Error('Unit not found')

      const startTs = Timestamp.fromDate(new Date(data.startDate))
      const endTs   = data.endDate ? Timestamp.fromDate(new Date(data.endDate)) : undefined

      // 1. Create / update tenant record
      await tenantService.create(user.id, {
        userId:     user.id,
        facilityId: facilityId!,
        businessId: facility!.businessId,
        unitIds:    [unit.id],
        status:     'active',
        moveInDate: startTs,
      })

      // 2. Create lease
      await leaseService.create({
        tenantId:     user.id,
        unitId:       unit.id,
        facilityId:   facilityId!,
        businessId:   facility!.businessId,
        monthlyRent:  data.monthlyRent,
        securityDeposit: data.securityDeposit,
        startDate:    startTs,
        endDate:      endTs,
        terms:        data.terms,
        status:       'active',
        tenantSignatureAcknowledged: data.agreed,
        signedAt:     startTs,
        createdBy:    appUser!.id,
      })

      // 3. Mark unit as occupied
      await unitService.update(unit.id, { status: 'occupied', currentTenantId: user.id })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tenants', facilityId] })
      void qc.invalidateQueries({ queryKey: ['units', facilityId] })
      toast.success('Tenant onboarded successfully!')
      void navigate('/manager/tenants')
    },
    onError: (err: Error) => toast.error(err.message),
  })


  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/manager/tenants"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Onboard Tenant</h1>
          <p className="text-muted-foreground text-sm">Assign a unit and create a lease</p>
        </div>
      </div>

      <form onSubmit={handleSubmit((d) => onboard.mutate(d as FormValues))} className="space-y-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Tenant</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Tenant Email</Label>
              <Input type="email" placeholder="tenant@example.com" {...register('tenantEmail')} />
              <p className="text-muted-foreground text-xs">The tenant must already have a registered account.</p>
              {errors.tenantEmail && <p className="text-destructive text-xs">{errors.tenantEmail.message}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Unit Assignment</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Available Unit</Label>
              <Select onValueChange={(v) => {
                setValue('unitId', v as string)
                const u = units.find((x) => x.id === v)
                if (u) {
                  setValue('monthlyRent', u.pricePerMonth as never)
                  setValue('securityDeposit', u.securityDeposit as never)
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a unit" />
                </SelectTrigger>
                <SelectContent>
                  {availableUnits.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      Unit {u.unitNumber} — {u.sqft} sq ft — ${u.pricePerMonth}/mo
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.unitId && <p className="text-destructive text-xs">{errors.unitId.message}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Lease Terms</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input type="date" {...register('startDate')} />
              </div>
              <div className="space-y-1.5">
                <Label>End Date <span className="text-muted-foreground text-xs">(blank = month-to-month)</span></Label>
                <Input type="date" {...register('endDate')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Monthly Rent ($)</Label>
                <Input type="number" step="0.01" {...register('monthlyRent')} />
              </div>
              <div className="space-y-1.5">
                <Label>Security Deposit ($)</Label>
                <Input type="number" step="0.01" {...register('securityDeposit')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Lease Agreement Terms</Label>
              <Textarea rows={12} className="font-mono text-xs" {...register('terms')} />
              {errors.terms && <p className="text-destructive text-xs">{errors.terms.message}</p>}
            </div>
            <div className="flex items-start gap-3 rounded-lg border p-4">
              <Checkbox
                id="agreed"
                onCheckedChange={(checked) => setValue('agreed', checked === true)}
              />
              <div>
                <Label htmlFor="agreed" className="cursor-pointer font-medium">
                  Tenant agrees to all terms above
                </Label>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  By checking this box, you confirm the tenant has read and agreed to the lease agreement.
                </p>
                {errors.agreed && <p className="text-destructive text-xs mt-1">{errors.agreed.message}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full" disabled={onboard.isPending}>
          {onboard.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Onboard Tenant &amp; Create Lease
        </Button>
      </form>
    </div>
  )
}

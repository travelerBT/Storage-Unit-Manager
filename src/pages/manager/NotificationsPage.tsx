import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useFacility } from '@/contexts/FacilityContext'
import { notificationService, tenantService } from '@/lib/services'
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
import { Send } from 'lucide-react'
import { toast } from 'sonner'
import type { NotificationChannel } from '@/types'
import { Timestamp } from 'firebase/firestore'

const notifSchema = z.object({
  recipientId: z.string().min(1),
  channel: z.enum(['email', 'sms'] satisfies [NotificationChannel, ...NotificationChannel[]]),
  subject: z.string().min(1),
  body: z.string().min(1),
})
type NotifFormData = z.infer<typeof notifSchema>

export function NotificationsPage() {
  const { facilityId, facility } = useFacility()
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', facilityId],
    queryFn: () => notificationService.listByFacility(facilityId!),
    enabled: !!facilityId,
  })
  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants', facilityId],
    queryFn: () => tenantService.listByFacility(facilityId!),
    enabled: !!facilityId,
  })

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<NotifFormData>({
    resolver: zodResolver(notifSchema),
    defaultValues: { recipientId: '', channel: 'email', subject: '', body: '' },
  })

  const sendMut = useMutation({
    mutationFn: (data: NotifFormData) =>
      notificationService.create({
        facilityId: facilityId!,
        businessId: facility!.businessId,
        recipientId: data.recipientId,
        type: 'general',
        channels: [data.channel],
        subject: data.subject,
        body: data.body,
        status: 'sent',
        sentAt: Timestamp.now(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      toast.success('Notification sent')
      setDialogOpen(false)
      reset()
    },
    onError: () => toast.error('Failed to send notification'),
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-muted-foreground text-sm">{facility?.name}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}><Send className="h-4 w-4 mr-2" />Send Notification</Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sent</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Channels</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
            ) : notifications.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No notifications sent yet</TableCell></TableRow>
            ) : notifications.map((n) => (
              <TableRow key={n.id}>
                <TableCell className="text-xs text-muted-foreground">{n.sentAt?.toDate().toLocaleString() ?? '—'}</TableCell>
                <TableCell>{n.recipientId}</TableCell>
                <TableCell>{n.channels.join(', ')}</TableCell>
                <TableCell>{n.subject}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${n.status === 'sent' ? 'bg-green-100 text-green-700' : n.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                    {n.status}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send Notification</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit((d) => sendMut.mutate(d))} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Recipient</Label>
              <Select onValueChange={(v) => setValue('recipientId', v as string)}>
                <SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => <SelectItem key={t.id} value={t.id}>{t.userId}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.recipientId && <p className="text-xs text-destructive">{errors.recipientId.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Channel</Label>
              <Select defaultValue="email" onValueChange={(v) => setValue('channel', v as NotificationChannel)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input {...register('subject')} />
              {errors.subject && <p className="text-xs text-destructive">{errors.subject.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Message</Label>
              <Textarea rows={4} {...register('body')} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={sendMut.isPending}>Send</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { UnitStatus, TenantStatus, InvoiceStatus, MaintenanceStatus, AuctionStatus, BusinessStatus, SubscriptionStatus } from '@/types'

type AnyStatus = UnitStatus | TenantStatus | InvoiceStatus | MaintenanceStatus | AuctionStatus | BusinessStatus | SubscriptionStatus

const map: Record<string, { label: string; className: string }> = {
  // Unit
  available:          { label: 'Available',          className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  occupied:           { label: 'Occupied',           className: 'bg-blue-100 text-blue-800 border-blue-200' },
  reserved:           { label: 'Reserved',           className: 'bg-purple-100 text-purple-800 border-purple-200' },
  maintenance:        { label: 'Maintenance',        className: 'bg-amber-100 text-amber-800 border-amber-200' },
  delinquent:         { label: 'Delinquent',         className: 'bg-red-100 text-red-800 border-red-200' },
  auctioned:          { label: 'Auctioned',          className: 'bg-slate-100 text-slate-700 border-slate-200' },
  // Tenant
  active:             { label: 'Active',             className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  moved_out:          { label: 'Moved Out',          className: 'bg-slate-100 text-slate-700 border-slate-200' },
  pending:            { label: 'Pending',            className: 'bg-amber-100 text-amber-800 border-amber-200' },
  // Invoice
  paid:               { label: 'Paid',               className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  overdue:            { label: 'Overdue',            className: 'bg-red-100 text-red-800 border-red-200' },
  waived:             { label: 'Waived',             className: 'bg-slate-100 text-slate-700 border-slate-200' },
  partial:            { label: 'Partial',            className: 'bg-blue-100 text-blue-800 border-blue-200' },
  // Maintenance
  open:               { label: 'Open',               className: 'bg-amber-100 text-amber-800 border-amber-200' },
  in_progress:        { label: 'In Progress',        className: 'bg-blue-100 text-blue-800 border-blue-200' },
  resolved:           { label: 'Resolved',           className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  closed:             { label: 'Closed',             className: 'bg-slate-100 text-slate-700 border-slate-200' },
  // Auction
  notice_sent:        { label: 'Notice Sent',        className: 'bg-amber-100 text-amber-800 border-amber-200' },
  listed:             { label: 'Listed',             className: 'bg-purple-100 text-purple-800 border-purple-200' },
  sold:               { label: 'Sold',               className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  cancelled:          { label: 'Cancelled',          className: 'bg-slate-100 text-slate-700 border-slate-200' },
  // Business
  trial:              { label: 'Trial',              className: 'bg-purple-100 text-purple-800 border-purple-200' },
  suspended:          { label: 'Suspended',          className: 'bg-red-100 text-red-800 border-red-200' },
  inactive:           { label: 'Inactive',           className: 'bg-slate-100 text-slate-700 border-slate-200' },
}

export function StatusBadge({ status, className }: { status: AnyStatus; className?: string }) {
  const cfg = map[status] ?? { label: status, className: 'bg-muted text-muted-foreground' }
  return (
    <Badge variant="outline" className={cn('border font-medium', cfg.className, className)}>
      {cfg.label}
    </Badge>
  )
}

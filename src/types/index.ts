import type { Timestamp } from 'firebase/firestore'

// ─── Auth & Roles ─────────────────────────────────────────────────────────────

export type UserRole = 'super_admin' | 'business_owner' | 'manager' | 'tenant'

export interface CustomClaims {
  role: UserRole
  roles?: UserRole[]
  businessId?: string
  facilityIds?: string[]
}

// ─── User ─────────────────────────────────────────────────────────────────────

export interface AppUser {
  id: string
  role: UserRole
  roles?: UserRole[]
  displayName: string
  email: string
  phone?: string
  businessId?: string
  facilityIds?: string[]
  avatarUrl?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ─── Business ─────────────────────────────────────────────────────────────────

export type BusinessStatus = 'active' | 'trial' | 'suspended'

export interface Business {
  id: string
  name: string
  ownerId: string
  logoUrl?: string
  subscriptionStatus: BusinessStatus
  email?: string
  phone?: string
  address?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ─── Facility ─────────────────────────────────────────────────────────────────

export type SubscriptionPlan = 'starter' | 'pro' | 'enterprise'
export type SubscriptionStatus = 'active' | 'inactive' | 'suspended' | 'trial'

export interface Facility {
  id: string
  businessId: string
  name: string
  address: string
  city: string
  state: string
  zip: string
  phone?: string
  email?: string
  managerIds: string[]
  subscriptionStatus: SubscriptionStatus
  subscriptionPlan: SubscriptionPlan
  totalUnits: number
  occupiedUnits: number
  gateInstructions?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ─── Unit ─────────────────────────────────────────────────────────────────────

export type UnitType = 'standard' | 'climate_controlled' | 'drive_up' | 'outdoor' | 'wine' | 'vehicle'
export type UnitStatus = 'available' | 'occupied' | 'reserved' | 'maintenance' | 'delinquent' | 'auctioned'

export interface Unit {
  id: string
  facilityId: string
  businessId: string
  unitNumber: string
  building?: string
  floor?: number
  width: number    // feet
  height: number   // feet
  sqft: number
  type: UnitType
  status: UnitStatus
  pricePerMonth: number
  securityDeposit: number
  gateCode?: string
  accessNotes?: string
  currentTenantId?: string
  features: string[]   // e.g. ['interior lighting', 'power outlet']
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ─── Tenant ───────────────────────────────────────────────────────────────────

export type TenantStatus = 'active' | 'delinquent' | 'moved_out' | 'pending'

export interface EmergencyContact {
  name: string
  phone: string
  relationship: string
}

export interface Tenant {
  id: string          // same as userId
  userId: string
  facilityId: string
  businessId: string
  unitIds: string[]
  status: TenantStatus
  driversLicenseNumber?: string
  emergencyContact?: EmergencyContact
  moveInDate?: Timestamp
  moveOutDate?: Timestamp
  notes?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ─── Lease ────────────────────────────────────────────────────────────────────

export type LeaseStatus = 'pending' | 'active' | 'expired' | 'terminated'

export interface Lease {
  id: string
  tenantId: string
  unitId: string
  facilityId: string
  businessId: string
  monthlyRent: number
  securityDeposit: number
  startDate: Timestamp
  endDate?: Timestamp    // undefined = month-to-month
  terms: string
  status: LeaseStatus
  tenantSignatureAcknowledged: boolean
  signedAt?: Timestamp
  documentPath?: string   // Firebase Storage path
  createdBy: string       // userId of manager
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ─── Invoice ──────────────────────────────────────────────────────────────────

export type InvoiceStatus = 'pending' | 'paid' | 'overdue' | 'waived' | 'partial'

export interface Invoice {
  id: string
  tenantId: string
  unitId: string
  facilityId: string
  businessId: string
  leaseId: string
  invoiceNumber: string
  amount: number
  lateFeeAmount: number
  totalDue: number
  dueDate: Timestamp
  paidDate?: Timestamp
  paidAmount?: number
  status: InvoiceStatus
  notes?: string
  periodStart: Timestamp
  periodEnd: Timestamp
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ─── Maintenance Request ──────────────────────────────────────────────────────

export type MaintenancePriority = 'low' | 'medium' | 'high' | 'urgent'
export type MaintenanceStatus = 'open' | 'in_progress' | 'resolved' | 'closed'

export interface MaintenanceRequest {
  id: string
  unitId: string
  facilityId: string
  businessId: string
  submittedBy: string
  submittedByRole: UserRole
  title: string
  description: string
  priority: MaintenancePriority
  status: MaintenanceStatus
  assignedTo?: string
  photoUrls: string[]
  resolvedAt?: Timestamp
  resolutionNotes?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ─── Auction ──────────────────────────────────────────────────────────────────

export type AuctionStatus =
  | 'notice_sent'
  | 'listed'
  | 'in_progress'
  | 'sold'
  | 'cancelled'

export interface Auction {
  id: string
  unitId: string
  facilityId: string
  businessId: string
  tenantId: string
  status: AuctionStatus
  noticeDate: Timestamp
  scheduledDate?: Timestamp
  completedDate?: Timestamp
  startingBid?: number
  finalBid?: number
  winnerName?: string
  winnerContact?: string
  notes?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ─── Notification ─────────────────────────────────────────────────────────────

export type NotificationType =
  | 'rent_due'
  | 'rent_overdue'
  | 'late_fee_applied'
  | 'lease_expiry'
  | 'maintenance_update'
  | 'auction_notice'
  | 'move_in'
  | 'move_out'
  | 'general'

export type NotificationChannel = 'email' | 'sms'
export type NotificationStatus = 'pending' | 'sent' | 'failed'

export interface Notification {
  id: string
  recipientId: string
  facilityId: string
  businessId: string
  type: NotificationType
  channels: NotificationChannel[]
  subject: string
  body: string
  status: NotificationStatus
  errorMessage?: string
  sentAt?: Timestamp
  createdAt: Timestamp
}

// ─── UI / View helpers ────────────────────────────────────────────────────────

export interface UnitWithTenant extends Unit {
  tenant?: AppUser & Tenant
}

export interface FacilityWithStats extends Facility {
  occupancyRate: number
  delinquentCount: number
  pendingInvoicesTotal: number
}

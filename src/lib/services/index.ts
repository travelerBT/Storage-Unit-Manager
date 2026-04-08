import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  type QueryConstraint,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type {
  AppUser, Business, Facility, Unit, Tenant,
  Lease, Invoice, MaintenanceRequest, Auction, Notification,
} from '@/types'

// ─── Generic helpers ──────────────────────────────────────────────────────────

async function getOne<T>(path: string): Promise<T | null> {
  const snap = await getDoc(doc(db, path))
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null
}

async function getMany<T>(col: string, ...constraints: QueryConstraint[]): Promise<T[]> {
  const q = constraints.length ? query(collection(db, col), ...constraints) : collection(db, col)
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T)
}

// ─── Users ────────────────────────────────────────────────────────────────────

export const usersService = {
  getById: (id: string) => getOne<AppUser>(`users/${id}`),
  update: (id: string, data: Partial<AppUser>) =>
    updateDoc(doc(db, 'users', id), { ...data, updatedAt: serverTimestamp() }),
  listAll: () => getMany<AppUser>('users', orderBy('createdAt', 'desc')),
  listByBusiness: (businessId: string) =>
    getMany<AppUser>('users', where('businessId', '==', businessId)),
}

// ─── Businesses ───────────────────────────────────────────────────────────────

export const businessService = {
  getById: (id: string) => getOne<Business>(`businesses/${id}`),
  listAll: () => getMany<Business>('businesses', orderBy('createdAt', 'desc')),
  create: async (data: Omit<Business, 'id' | 'createdAt' | 'updatedAt'>) => {
    const ref = await addDoc(collection(db, 'businesses'), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return ref.id
  },
  update: (id: string, data: Partial<Business>) =>
    updateDoc(doc(db, 'businesses', id), { ...data, updatedAt: serverTimestamp() }),
  delete: (id: string) => deleteDoc(doc(db, 'businesses', id)),
}

// ─── Facilities ───────────────────────────────────────────────────────────────

export const facilityService = {
  getById: (id: string) => getOne<Facility>(`facilities/${id}`),
  listByBusiness: (businessId: string) =>
    getMany<Facility>('facilities', where('businessId', '==', businessId), orderBy('name')),
  listByManager: (managerId: string) =>
    getMany<Facility>('facilities', where('managerIds', 'array-contains', managerId)),
  listAll: () => getMany<Facility>('facilities', orderBy('createdAt', 'desc')),
  create: async (data: Omit<Facility, 'id' | 'createdAt' | 'updatedAt'>) => {
    const ref = await addDoc(collection(db, 'facilities'), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return ref.id
  },
  update: (id: string, data: Partial<Facility>) =>
    updateDoc(doc(db, 'facilities', id), { ...data, updatedAt: serverTimestamp() }),
  delete: (id: string) => deleteDoc(doc(db, 'facilities', id)),
}

// ─── Units ────────────────────────────────────────────────────────────────────

export const unitService = {
  getById: (id: string) => getOne<Unit>(`units/${id}`),
  listByFacility: (facilityId: string) =>
    getMany<Unit>('units', where('facilityId', '==', facilityId), orderBy('unitNumber')),
  create: async (data: Omit<Unit, 'id' | 'createdAt' | 'updatedAt'>) => {
    const ref = await addDoc(collection(db, 'units'), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return ref.id
  },
  update: (id: string, data: Partial<Unit>) =>
    updateDoc(doc(db, 'units', id), { ...data, updatedAt: serverTimestamp() }),
  delete: (id: string) => deleteDoc(doc(db, 'units', id)),
}

// ─── Tenants ──────────────────────────────────────────────────────────────────

export const tenantService = {
  getById: (id: string) => getOne<Tenant>(`tenants/${id}`),
  listByFacility: (facilityId: string) =>
    getMany<Tenant>('tenants', where('facilityId', '==', facilityId), orderBy('createdAt', 'desc')),
  listByUser: (userId: string) =>
    getMany<Tenant>('tenants', where('userId', '==', userId)),
  create: async (id: string, data: Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>) => {
    await setDoc(doc(db, 'tenants', id), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  },
  update: (id: string, data: Partial<Tenant>) =>
    updateDoc(doc(db, 'tenants', id), { ...data, updatedAt: serverTimestamp() }),
}

// ─── Leases ───────────────────────────────────────────────────────────────────

export const leaseService = {
  getById: (id: string) => getOne<Lease>(`leases/${id}`),
  listByTenant: (tenantId: string) =>
    getMany<Lease>('leases', where('tenantId', '==', tenantId), orderBy('createdAt', 'desc')),
  listByFacility: (facilityId: string) =>
    getMany<Lease>('leases', where('facilityId', '==', facilityId), orderBy('createdAt', 'desc')),
  listByUnit: (unitId: string) =>
    getMany<Lease>('leases', where('unitId', '==', unitId), orderBy('createdAt', 'desc')),
  create: async (data: Omit<Lease, 'id' | 'createdAt' | 'updatedAt'>) => {
    const ref = await addDoc(collection(db, 'leases'), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return ref.id
  },
  update: (id: string, data: Partial<Lease>) =>
    updateDoc(doc(db, 'leases', id), { ...data, updatedAt: serverTimestamp() }),
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

export const invoiceService = {
  getById: (id: string) => getOne<Invoice>(`invoices/${id}`),
  listByFacility: (facilityId: string) =>
    getMany<Invoice>('invoices', where('facilityId', '==', facilityId), orderBy('dueDate', 'desc')),
  listByTenant: (tenantId: string) =>
    getMany<Invoice>('invoices', where('tenantId', '==', tenantId), orderBy('dueDate', 'desc')),
  create: async (data: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>) => {
    const ref = await addDoc(collection(db, 'invoices'), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return ref.id
  },
  update: (id: string, data: Partial<Invoice>) =>
    updateDoc(doc(db, 'invoices', id), { ...data, updatedAt: serverTimestamp() }),
}

// ─── Maintenance ──────────────────────────────────────────────────────────────

export const maintenanceService = {
  getById: (id: string) => getOne<MaintenanceRequest>(`maintenanceRequests/${id}`),
  listByFacility: (facilityId: string) =>
    getMany<MaintenanceRequest>('maintenanceRequests', where('facilityId', '==', facilityId), orderBy('createdAt', 'desc')),
  listByTenant: (tenantId: string) =>
    getMany<MaintenanceRequest>('maintenanceRequests', where('tenantId', '==', tenantId), orderBy('createdAt', 'desc')),
  create: async (data: Omit<MaintenanceRequest, 'id' | 'createdAt' | 'updatedAt'>) => {
    const ref = await addDoc(collection(db, 'maintenanceRequests'), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return ref.id
  },
  update: (id: string, data: Partial<MaintenanceRequest>) =>
    updateDoc(doc(db, 'maintenanceRequests', id), { ...data, updatedAt: serverTimestamp() }),
}

// ─── Auctions ─────────────────────────────────────────────────────────────────

export const auctionService = {
  getById: (id: string) => getOne<Auction>(`auctions/${id}`),
  listByFacility: (facilityId: string) =>
    getMany<Auction>('auctions', where('facilityId', '==', facilityId), orderBy('createdAt', 'desc')),
  create: async (data: Omit<Auction, 'id' | 'createdAt' | 'updatedAt'>) => {
    const ref = await addDoc(collection(db, 'auctions'), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return ref.id
  },
  update: (id: string, data: Partial<Auction>) =>
    updateDoc(doc(db, 'auctions', id), { ...data, updatedAt: serverTimestamp() }),
}

// ─── Notifications ────────────────────────────────────────────────────────────

export const notificationService = {
  listByFacility: (facilityId: string) =>
    getMany<Notification>('notifications', where('facilityId', '==', facilityId), orderBy('createdAt', 'desc')),
  listByRecipient: (recipientId: string) =>
    getMany<Notification>('notifications', where('recipientId', '==', recipientId), orderBy('createdAt', 'desc')),
  create: async (data: Omit<Notification, 'id' | 'createdAt'>) => {
    const ref = await addDoc(collection(db, 'notifications'), {
      ...data,
      createdAt: serverTimestamp(),
    })
    return ref.id
  },
  update: (id: string, data: Partial<Notification>) =>
    updateDoc(doc(db, 'notifications', id), data),
}

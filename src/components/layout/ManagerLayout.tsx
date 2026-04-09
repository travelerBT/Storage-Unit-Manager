import { AppShell, type NavItem } from '@/components/layout/AppShell'
import {
  LayoutDashboard,
  WarehouseIcon,
  Users,
  FileText,
  Wrench,
  Gavel,
  Bell,
  BarChart3,
  Settings,
} from 'lucide-react'

const navItems: NavItem[] = [
  { label: 'Dashboard',    href: '/manager',               icon: LayoutDashboard, exact: true },
  { label: 'Units',        href: '/manager/units',         icon: WarehouseIcon },
  { label: 'Tenants',      href: '/manager/tenants',       icon: Users },
  { label: 'Invoices',     href: '/manager/invoices',      icon: FileText },
  { label: 'Maintenance',  href: '/manager/maintenance',   icon: Wrench },
  { label: 'Auctions',     href: '/manager/auctions',      icon: Gavel },
  { label: 'Notifications',href: '/manager/notifications', icon: Bell },
  { label: 'Reports',      href: '/manager/reports',       icon: BarChart3 },
  { label: 'Settings',     href: '/manager/settings',      icon: Settings },
]

export function ManagerLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      navItems={navItems}
      title="StorageOS"
      roleLabel="Facility Manager"
      accentColor="bg-emerald-600"
    >
      {children}
    </AppShell>
  )
}

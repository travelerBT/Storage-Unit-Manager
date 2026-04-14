import { AppShell, type NavItem } from '@/components/layout/AppShell'
import {
  LayoutDashboard,
  WarehouseIcon,
  FileText,
  Wrench,
  User,
} from 'lucide-react'

const navItems: NavItem[] = [
  { label: 'Dashboard', exact: true,  href: '/tenant',            icon: LayoutDashboard },
  { label: 'My Unit',    href: '/tenant/unit',       icon: WarehouseIcon },
  { label: 'Invoices',   href: '/tenant/invoices',   icon: FileText },
  { label: 'Maintenance',href: '/tenant/maintenance',icon: Wrench },
  { label: 'Account',    href: '/tenant/account',    icon: User },
]

export function TenantLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      navItems={navItems}
      title="SpotSlot"
      roleLabel="My Account"
      accentColor="bg-amber-600"
    >
      {children}
    </AppShell>
  )
}

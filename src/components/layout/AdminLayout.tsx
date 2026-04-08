import { AppShell, type NavItem } from '@/components/layout/AppShell'
import {
  LayoutDashboard,
  Building2,
  Users,
  Settings,
} from 'lucide-react'

const navItems: NavItem[] = [
  { label: 'Dashboard',  href: '/admin',            icon: LayoutDashboard },
  { label: 'Businesses', href: '/admin/businesses', icon: Building2 },
  { label: 'Users',      href: '/admin/users',      icon: Users },
  { label: 'Settings',   href: '/admin/settings',   icon: Settings },
]

export function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      navItems={navItems}
      title="StorageOS"
      roleLabel="Super Admin"
      accentColor="bg-violet-600"
    >
      {children}
    </AppShell>
  )
}

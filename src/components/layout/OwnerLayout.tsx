import { AppShell, type NavItem } from '@/components/layout/AppShell'
import {
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  Settings,
} from 'lucide-react'

const navItems: NavItem[] = [
  { label: 'Dashboard',   href: '/owner',             icon: LayoutDashboard },
  { label: 'Facilities',  href: '/owner/facilities',  icon: Building2 },
  { label: 'Managers',    href: '/owner/managers',    icon: Users },
  { label: 'Subscription', href: '/owner/subscription', icon: CreditCard },
  { label: 'Settings',    href: '/owner/settings',    icon: Settings },
]

export function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      navItems={navItems}
      title="StorageOS"
      roleLabel="Business Owner"
      accentColor="bg-blue-600"
    >
      {children}
    </AppShell>
  )
}

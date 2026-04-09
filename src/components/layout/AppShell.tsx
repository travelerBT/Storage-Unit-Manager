import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/contexts/AuthContext'
import { Menu, LogOut, User, ChevronRight, ArrowLeftRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { roleHomePath } from '@/components/auth/RouteGuards'
import type { UserRole } from '@/types'

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  business_owner: 'Business Owner',
  manager: 'Manager',
  tenant: 'Tenant',
}

const ROLE_COLORS: Record<UserRole, string> = {
  super_admin:    'bg-violet-600',
  business_owner: 'bg-blue-600',
  manager:        'bg-emerald-600',
  tenant:         'bg-orange-500',
}

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  badge?: string | number
  exact?: boolean
}

interface AppShellProps {
  children: React.ReactNode
  navItems: NavItem[]
  title: string
  roleLabel: string
  accentColor?: string
}

function SidebarContent({
  navItems,
  title,
  roleLabel,
  accentColor = 'bg-primary',
}: Pick<AppShellProps, 'navItems' | 'title' | 'roleLabel' | 'accentColor'>) {
  const location = useLocation()
  const navigate = useNavigate()
  const { roles, role, switchRole } = useAuth()
  const otherRoles = roles.filter((r) => r !== role)

  return (
    <div className="flex h-full flex-col">
      {/* Logo / brand */}
      <div className="flex items-center gap-3 px-6 py-5">
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg text-white text-sm font-bold', accentColor)}>
          SU
        </div>
        <div>
          <p className="text-sm font-semibold leading-none">{title}</p>
          <p className="text-muted-foreground text-xs">{roleLabel}</p>
        </div>
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const active = item.exact ? location.pathname === item.href : (location.pathname === item.href || location.pathname.startsWith(item.href + '/'))
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.badge !== undefined && (
                <span className={cn(
                  'rounded-full px-1.5 py-0.5 text-xs font-medium min-w-[1.25rem] text-center',
                  active ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground',
                )}>
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Role switcher — only shown when user has multiple roles */}
      {otherRoles.length > 0 && (
        <>
          <Separator />
          <div className="px-3 py-3 space-y-1">
            <p className="px-3 text-xs font-medium text-muted-foreground mb-1">Switch role</p>
            {otherRoles.map((r) => (
              <button
                key={r}
                onClick={() => { switchRole(r); void navigate(roleHomePath(r)) }}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <span className={cn('h-2 w-2 rounded-full shrink-0', ROLE_COLORS[r])} />
                {ROLE_LABELS[r]}
                <ArrowLeftRight className="ml-auto h-3.5 w-3.5 opacity-60" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function AppShell({ children, navItems, title, roleLabel, accentColor }: AppShellProps) {
  const { appUser, logOut, role, roles, switchRole } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  const currentPage = navItems.find((n) => n.exact ? location.pathname === n.href : (location.pathname === n.href || location.pathname.startsWith(n.href + '/')))

  const initials = appUser?.displayName
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? '?'

  return (
    <div className="bg-background flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="bg-card border-border hidden w-64 shrink-0 border-r lg:flex lg:flex-col">
        <SidebarContent navItems={navItems} title={title} roleLabel={roleLabel} accentColor={accentColor} />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SidebarContent navItems={navItems} title={title} roleLabel={roleLabel} accentColor={accentColor} />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-card border-border flex h-14 items-center gap-4 border-b px-4 lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Breadcrumb / page title */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground hidden sm:block">{roleLabel}</span>
            {currentPage && (
              <>
                <ChevronRight className="text-muted-foreground h-4 w-4 hidden sm:block" />
                <span className="font-medium">{currentPage.label}</span>
              </>
            )}
          </div>

          <div className="ml-auto flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger render={<div />} nativeButton={false}>
                <Button variant="ghost" className="flex items-center gap-2 px-2">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="hidden text-sm font-medium sm:block">
                    {appUser?.displayName ?? 'User'}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="truncate text-xs text-muted-foreground">
                  {appUser?.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void navigate('account')}>
                  <User className="mr-2 h-4 w-4" />
                  Account
                </DropdownMenuItem>
                {roles.length > 1 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Switch role</DropdownMenuLabel>
                    {roles
                      .filter((r) => r !== role)
                      .map((r) => (
                        <DropdownMenuItem
                          key={r}
                          onClick={() => { switchRole(r); void navigate(roleHomePath(r)) }}
                        >
                          <ArrowLeftRight className="mr-2 h-4 w-4" />
                          {ROLE_LABELS[r]}
                        </DropdownMenuItem>
                      ))}
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => void logOut()}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

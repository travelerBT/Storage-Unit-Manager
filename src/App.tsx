import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/sonner'

import { AuthProvider } from '@/contexts/AuthContext'
import { FacilityProvider } from '@/contexts/FacilityContext'
import { RequireAuth, RedirectIfAuthed } from '@/components/auth/RouteGuards'

// Layouts
import { AdminLayout }   from '@/components/layout/AdminLayout'
import { OwnerLayout }   from '@/components/layout/OwnerLayout'
import { ManagerLayout } from '@/components/layout/ManagerLayout'
import { TenantLayout }  from '@/components/layout/TenantLayout'

// Auth pages
import { LoginPage }          from '@/pages/auth/LoginPage'
import { RegisterPage }       from '@/pages/auth/RegisterPage'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage'
import { InviteAcceptPage }   from '@/pages/auth/InviteAcceptPage'
import { UnauthorizedPage }   from '@/pages/auth/UnauthorizedPage'

// Super Admin pages
import { AdminDashboard } from '@/pages/super-admin/AdminDashboard'
import { BusinessesPage } from '@/pages/super-admin/BusinessesPage'
import { AdminUsersPage } from '@/pages/super-admin/AdminUsersPage'

// Business Owner pages
import { OwnerDashboard }   from '@/pages/business-owner/OwnerDashboard'
import { FacilitiesPage }   from '@/pages/business-owner/FacilitiesPage'
import { ManagersPage }     from '@/pages/business-owner/ManagersPage'
import { SubscriptionPage } from '@/pages/business-owner/SubscriptionPage'

// Manager pages
import { ManagerDashboard }      from '@/pages/manager/ManagerDashboard'
import { UnitsPage }             from '@/pages/manager/UnitsPage'
import { UnitDetailPage }        from '@/pages/manager/UnitDetailPage'
import { TenantsPage }           from '@/pages/manager/TenantsPage'
import { TenantDetailPage }      from '@/pages/manager/TenantDetailPage'
import { TenantOnboardPage }     from '@/pages/manager/TenantOnboardPage'
import { InvoicesPage }          from '@/pages/manager/InvoicesPage'
import { MaintenancePage }       from '@/pages/manager/MaintenancePage'
import { AuctionsPage }          from '@/pages/manager/AuctionsPage'
import { NotificationsPage }     from '@/pages/manager/NotificationsPage'
import { ReportsPage }           from '@/pages/manager/ReportsPage'

// Tenant pages
import { TenantDashboard }       from '@/pages/tenant/TenantDashboard'
import { MyUnitPage }            from '@/pages/tenant/MyUnitPage'
import { TenantInvoicesPage }    from '@/pages/tenant/TenantInvoicesPage'
import { TenantMaintenancePage } from '@/pages/tenant/TenantMaintenancePage'
import { AccountPage }           from '@/pages/tenant/AccountPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 2, retry: 1 },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public */}
            <Route path="/login"           element={<RedirectIfAuthed><LoginPage /></RedirectIfAuthed>} />
            <Route path="/register"        element={<RedirectIfAuthed><RegisterPage /></RedirectIfAuthed>} />
            <Route path="/forgot-password" element={<RedirectIfAuthed><ForgotPasswordPage /></RedirectIfAuthed>} />
            <Route path="/invite"          element={<InviteAcceptPage />} />
            <Route path="/unauthorized"    element={<UnauthorizedPage />} />

            {/* Super Admin */}
            <Route path="/admin"            element={<RequireAuth allowedRoles={['super_admin']}><AdminLayout><AdminDashboard /></AdminLayout></RequireAuth>} />
            <Route path="/admin/businesses" element={<RequireAuth allowedRoles={['super_admin']}><AdminLayout><BusinessesPage /></AdminLayout></RequireAuth>} />
            <Route path="/admin/users"      element={<RequireAuth allowedRoles={['super_admin']}><AdminLayout><AdminUsersPage /></AdminLayout></RequireAuth>} />

            {/* Business Owner */}
            <Route path="/owner"              element={<RequireAuth allowedRoles={['business_owner']}><OwnerLayout><OwnerDashboard /></OwnerLayout></RequireAuth>} />
            <Route path="/owner/facilities"   element={<RequireAuth allowedRoles={['business_owner']}><OwnerLayout><FacilitiesPage /></OwnerLayout></RequireAuth>} />
            <Route path="/owner/managers"     element={<RequireAuth allowedRoles={['business_owner']}><OwnerLayout><ManagersPage /></OwnerLayout></RequireAuth>} />
            <Route path="/owner/subscription" element={<RequireAuth allowedRoles={['business_owner']}><OwnerLayout><SubscriptionPage /></OwnerLayout></RequireAuth>} />

            {/* Manager — wrapped in FacilityProvider */}
            <Route path="/manager"                   element={<RequireAuth allowedRoles={['manager']}><FacilityProvider><ManagerLayout><ManagerDashboard /></ManagerLayout></FacilityProvider></RequireAuth>} />
            <Route path="/manager/units"             element={<RequireAuth allowedRoles={['manager']}><FacilityProvider><ManagerLayout><UnitsPage /></ManagerLayout></FacilityProvider></RequireAuth>} />
            <Route path="/manager/units/:unitId"     element={<RequireAuth allowedRoles={['manager']}><FacilityProvider><ManagerLayout><UnitDetailPage /></ManagerLayout></FacilityProvider></RequireAuth>} />
            <Route path="/manager/tenants"           element={<RequireAuth allowedRoles={['manager']}><FacilityProvider><ManagerLayout><TenantsPage /></ManagerLayout></FacilityProvider></RequireAuth>} />
            <Route path="/manager/tenants/new"       element={<RequireAuth allowedRoles={['manager']}><FacilityProvider><ManagerLayout><TenantOnboardPage /></ManagerLayout></FacilityProvider></RequireAuth>} />
            <Route path="/manager/tenants/:tenantId" element={<RequireAuth allowedRoles={['manager']}><FacilityProvider><ManagerLayout><TenantDetailPage /></ManagerLayout></FacilityProvider></RequireAuth>} />
            <Route path="/manager/invoices"          element={<RequireAuth allowedRoles={['manager']}><FacilityProvider><ManagerLayout><InvoicesPage /></ManagerLayout></FacilityProvider></RequireAuth>} />
            <Route path="/manager/maintenance"       element={<RequireAuth allowedRoles={['manager']}><FacilityProvider><ManagerLayout><MaintenancePage /></ManagerLayout></FacilityProvider></RequireAuth>} />
            <Route path="/manager/auctions"          element={<RequireAuth allowedRoles={['manager']}><FacilityProvider><ManagerLayout><AuctionsPage /></ManagerLayout></FacilityProvider></RequireAuth>} />
            <Route path="/manager/notifications"     element={<RequireAuth allowedRoles={['manager']}><FacilityProvider><ManagerLayout><NotificationsPage /></ManagerLayout></FacilityProvider></RequireAuth>} />
            <Route path="/manager/reports"           element={<RequireAuth allowedRoles={['manager']}><FacilityProvider><ManagerLayout><ReportsPage /></ManagerLayout></FacilityProvider></RequireAuth>} />

            {/* Tenant */}
            <Route path="/tenant"             element={<RequireAuth allowedRoles={['tenant']}><TenantLayout><TenantDashboard /></TenantLayout></RequireAuth>} />
            <Route path="/tenant/unit"        element={<RequireAuth allowedRoles={['tenant']}><TenantLayout><MyUnitPage /></TenantLayout></RequireAuth>} />
            <Route path="/tenant/invoices"    element={<RequireAuth allowedRoles={['tenant']}><TenantLayout><TenantInvoicesPage /></TenantLayout></RequireAuth>} />
            <Route path="/tenant/maintenance" element={<RequireAuth allowedRoles={['tenant']}><TenantLayout><TenantMaintenancePage /></TenantLayout></RequireAuth>} />
            <Route path="/tenant/account"     element={<RequireAuth allowedRoles={['tenant']}><TenantLayout><AccountPage /></TenantLayout></RequireAuth>} />

            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

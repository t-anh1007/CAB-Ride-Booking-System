import { createBrowserRouter, Navigate } from "react-router-dom";
import { RoleGuard } from "@app/RoleGuard.jsx";
import { AdminLayout } from "@/layouts/AdminLayout.jsx";
import { ROLES } from "@/constants/roles.js";
import { AdminAccessDeniedPage, AdminLoginPage, AdminMfaChallengePage } from "@/modules/admin/auth/index.jsx";
import { BookingManagementPage } from "@/modules/admin/bookings/index.jsx";
import { BulkActionResultPage, OperationsDashboardKpiPage } from "@/modules/admin/dashboard/index.jsx";
import { DriverManagementPage } from "@/modules/admin/drivers/index.jsx";
import { DriverKycApprovalPage } from "@/modules/admin/kyc/index.jsx";
import { AuditSecurityMonitorPage } from "@/modules/admin/logs-audit/index.jsx";
import { NotificationLogsPage } from "@/modules/admin/notifications/index.jsx";
import { PaymentManagementPage } from "@/modules/admin/payments/index.jsx";
import { PricingSurgeMonitorPage } from "@/modules/admin/pricing/index.jsx";
import { RefundManagementPage } from "@/modules/admin/refunds/index.jsx";
import { ReviewManagementPage } from "@/modules/admin/reviews/index.jsx";
import { RealtimeOperationsMapPage, RideManagementPage } from "@/modules/admin/rides/index.jsx";
import { ServiceHealthArchitecturePage, SystemMaintenanceModePage } from "@/modules/admin/system-health/index.jsx";
import { UserDetailPage, UserManagementPage } from "@/modules/admin/users/index.jsx";

function guarded(role, element) {
  return <RoleGuard allowedRoles={[role]}>{element}</RoleGuard>;
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/admin/dashboard" replace />
  },
  {
    path: "/admin",
    element: <AdminLayout />,
    children: [
      { index: true, element: <Navigate to="/admin/dashboard" replace /> },
      { path: "auth", element: <Navigate to="/admin/auth/login" replace /> },
      { path: "auth/login", element: <AdminLoginPage /> },
      { path: "auth/mfa", element: <AdminMfaChallengePage /> },
      { path: "auth/access-denied", element: <AdminAccessDeniedPage /> },
      { path: "dashboard", element: guarded(ROLES.ADMIN, <OperationsDashboardKpiPage />) },
      { path: "dashboard/bulk-action-result", element: guarded(ROLES.ADMIN, <BulkActionResultPage />) },
      { path: "users", element: guarded(ROLES.ADMIN, <UserManagementPage />) },
      { path: "users/detail", element: guarded(ROLES.ADMIN, <UserDetailPage />) },
      { path: "drivers", element: guarded(ROLES.ADMIN, <DriverManagementPage />) },
      { path: "kyc", element: guarded(ROLES.ADMIN, <DriverKycApprovalPage />) },
      { path: "bookings", element: guarded(ROLES.ADMIN, <BookingManagementPage />) },
      { path: "rides", element: guarded(ROLES.ADMIN, <RideManagementPage />) },
      { path: "rides/realtime-map", element: guarded(ROLES.ADMIN, <RealtimeOperationsMapPage />) },
      { path: "payments", element: guarded(ROLES.ADMIN, <PaymentManagementPage />) },
      { path: "refunds", element: guarded(ROLES.ADMIN, <RefundManagementPage />) },
      { path: "notifications", element: guarded(ROLES.ADMIN, <NotificationLogsPage />) },
      { path: "system-health", element: guarded(ROLES.ADMIN, <ServiceHealthArchitecturePage />) },
      { path: "system-health/maintenance", element: guarded(ROLES.ADMIN, <SystemMaintenanceModePage />) },
      { path: "pricing", element: guarded(ROLES.ADMIN, <PricingSurgeMonitorPage />) },
      { path: "reviews", element: guarded(ROLES.ADMIN, <ReviewManagementPage />) },
      { path: "logs-audit", element: guarded(ROLES.ADMIN, <AuditSecurityMonitorPage />) }
    ]
  }
]);

import { createBrowserRouter, Navigate } from "react-router-dom";
import { RoleGuard } from "@app/RoleGuard.jsx";
import { DriverLayout } from "@/layouts/DriverLayout.jsx";
import { ROLES } from "@/constants/roles.js";
import {
  DriverLoginOtpRequestPage,
  DriverSessionExpiredPage,
  DriverVerifyOtpPage
} from "@/modules/driver/auth/index.jsx";
import {
  DriverGpsPermissionRequiredPage,
  DriverLocationTrackingPage,
  DriverNetworkLostPage,
  DriverOnlineOfflineDashboardPage
} from "@/modules/driver/availability/index.jsx";
import { DriverHistoryEarningsPage } from "@/modules/driver/earnings/index.jsx";
import { DriverKycBlockedPage, DriverKycVehicleProfilePage } from "@/modules/driver/kyc/index.jsx";
import { DriverNotificationsPage } from "@/modules/driver/notifications/index.jsx";
import { DriverProfilePage } from "@/modules/driver/profile/index.jsx";
import { DriverReviewsRatingPage } from "@/modules/driver/reviews/index.jsx";
import {
  CompleteRidePage,
  DriverCancelRidePage,
  DriverIncomingRideRequestPage,
  NavigateToPickupPage,
  RideInProgressPage,
  StartRidePage
} from "@/modules/driver/ride/index.jsx";

function guarded(role, element) {
  return <RoleGuard allowedRoles={[role]}>{element}</RoleGuard>;
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/driver/availability/dashboard" replace />
  },
  {
    path: "/driver",
    element: <DriverLayout />,
    children: [
      { index: true, element: <Navigate to="/driver/availability/dashboard" replace /> },
      { path: "auth", element: <Navigate to="/driver/auth/login" replace /> },
      { path: "auth/login", element: <DriverLoginOtpRequestPage /> },
      { path: "auth/verify-otp", element: <DriverVerifyOtpPage /> },
      { path: "auth/session-expired", element: <DriverSessionExpiredPage /> },
      { path: "profile", element: guarded(ROLES.DRIVER, <DriverProfilePage />) },
      { path: "kyc", element: <Navigate to="/driver/kyc/profile" replace /> },
      { path: "kyc/profile", element: guarded(ROLES.DRIVER, <DriverKycVehicleProfilePage />) },
      { path: "kyc/blocked", element: guarded(ROLES.DRIVER, <DriverKycBlockedPage />) },
      { path: "availability", element: <Navigate to="/driver/availability/dashboard" replace /> },
      { path: "availability/dashboard", element: guarded(ROLES.DRIVER, <DriverOnlineOfflineDashboardPage />) },
      { path: "availability/location-tracking", element: guarded(ROLES.DRIVER, <DriverLocationTrackingPage />) },
      { path: "availability/gps-required", element: guarded(ROLES.DRIVER, <DriverGpsPermissionRequiredPage />) },
      { path: "availability/network-lost", element: guarded(ROLES.DRIVER, <DriverNetworkLostPage />) },
      { path: "ride", element: <Navigate to="/driver/ride/incoming-request" replace /> },
      { path: "ride/incoming-request", element: guarded(ROLES.DRIVER, <DriverIncomingRideRequestPage />) },
      { path: "ride/navigate-pickup", element: guarded(ROLES.DRIVER, <NavigateToPickupPage />) },
      { path: "ride/start", element: guarded(ROLES.DRIVER, <StartRidePage />) },
      { path: "ride/in-progress", element: guarded(ROLES.DRIVER, <RideInProgressPage />) },
      { path: "ride/complete", element: guarded(ROLES.DRIVER, <CompleteRidePage />) },
      { path: "ride/cancel", element: guarded(ROLES.DRIVER, <DriverCancelRidePage />) },
      { path: "earnings", element: <Navigate to="/driver/earnings/history" replace /> },
      { path: "earnings/history", element: guarded(ROLES.DRIVER, <DriverHistoryEarningsPage />) },
      { path: "notifications", element: guarded(ROLES.DRIVER, <DriverNotificationsPage />) },
      { path: "reviews", element: guarded(ROLES.DRIVER, <DriverReviewsRatingPage />) }
    ]
  }
]);

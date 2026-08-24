import { createBrowserRouter, Navigate } from "react-router-dom";
import { RoleGuard } from "@app/RoleGuard.jsx";
import { CustomerLayout } from "@/layouts/CustomerLayout.jsx";
import { ROLES } from "@/constants/roles.js";
import {
  CustomerOnboardingPage,
  LoginOtpRequestPage,
  SessionExpiredPage,
  VerifyOtpPage
} from "@/modules/customer/auth/index.jsx";
import {
  BookingConfirmationPage,
  CancelRideBookingPage,
  DestinationSelectionPage,
  HomeMapPickupPage,
  NetworkServiceErrorPage,
  PermissionDeniedPage,
  RideOptionsPricingPage,
  SearchingDriverPage
} from "@/modules/customer/booking/index.jsx";
import { RideBookingHistoryPage, RideDetailPage } from "@/modules/customer/history/index.jsx";
import { NotificationCenterPage } from "@/modules/customer/notifications/index.jsx";
import {
  NoPaymentMethodPage,
  PaymentMethodSelectionPage,
  PaymentResultPage
} from "@/modules/customer/payment/index.jsx";
import { ProfileWalletSettingsPage } from "@/modules/customer/profile/index.jsx";
import { RatingFeedbackPage } from "@/modules/customer/review/index.jsx";
import { DriverAssignedPage, RideTrackingPage } from "@/modules/customer/ride/index.jsx";

function guarded(role, element) {
  return <RoleGuard allowedRoles={[role]}>{element}</RoleGuard>;
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/customer/onboarding" replace />
  },
  {
    path: "/customer",
    element: <CustomerLayout />,
    children: [
      { index: true, element: <Navigate to="/customer/onboarding" replace /> },
      { path: "onboarding", element: <CustomerOnboardingPage /> },
      { path: "auth", element: <Navigate to="/customer/auth/login" replace /> },
      { path: "auth/login", element: <LoginOtpRequestPage /> },
      { path: "auth/verify-otp", element: <VerifyOtpPage /> },
      { path: "auth/session-expired", element: <SessionExpiredPage /> },
      { path: "booking", element: <Navigate to="/customer/booking/pickup" replace /> },
      { path: "booking/pickup", element: guarded(ROLES.CUSTOMER, <HomeMapPickupPage />) },
      { path: "booking/destination", element: guarded(ROLES.CUSTOMER, <DestinationSelectionPage />) },
      { path: "booking/ride-options", element: guarded(ROLES.CUSTOMER, <RideOptionsPricingPage />) },
      { path: "booking/confirmation", element: guarded(ROLES.CUSTOMER, <BookingConfirmationPage />) },
      { path: "booking/searching-driver", element: guarded(ROLES.CUSTOMER, <SearchingDriverPage />) },
      { path: "booking/cancel", element: guarded(ROLES.CUSTOMER, <CancelRideBookingPage />) },
      { path: "booking/network-error", element: <NetworkServiceErrorPage /> },
      { path: "booking/permission-denied", element: <PermissionDeniedPage /> },
      { path: "ride", element: <Navigate to="/customer/ride/driver-assigned" replace /> },
      { path: "ride/driver-assigned", element: guarded(ROLES.CUSTOMER, <DriverAssignedPage />) },
      { path: "ride/tracking", element: guarded(ROLES.CUSTOMER, <RideTrackingPage />) },
      { path: "payment", element: <Navigate to="/customer/payment/method" replace /> },
      { path: "payment/method", element: guarded(ROLES.CUSTOMER, <PaymentMethodSelectionPage />) },
      { path: "payment/result", element: guarded(ROLES.CUSTOMER, <PaymentResultPage />) },
      { path: "payment/no-method", element: guarded(ROLES.CUSTOMER, <NoPaymentMethodPage />) },
      { path: "review", element: <Navigate to="/customer/review/rating" replace /> },
      { path: "review/rating", element: guarded(ROLES.CUSTOMER, <RatingFeedbackPage />) },
      { path: "history", element: <Navigate to="/customer/history/rides" replace /> },
      { path: "history/rides", element: guarded(ROLES.CUSTOMER, <RideBookingHistoryPage />) },
      { path: "history/detail", element: guarded(ROLES.CUSTOMER, <RideDetailPage />) },
      { path: "notifications", element: guarded(ROLES.CUSTOMER, <NotificationCenterPage />) },
      { path: "profile", element: guarded(ROLES.CUSTOMER, <ProfileWalletSettingsPage />) }
    ]
  }
]);

# UI screenshots (full set)

Captured 2026-10-09 with Playwright (Chromium) against local Vite dev servers (5174/5175/5176) and the **real backend** (infra/docker-compose local stack, gateway on host port 3300 because 3000 was occupied). No API mocking. Data: existing database_test seed plus extra test accounts/drivers (Vietnamese names) and rides created through the real APIs.

Mobile = 390x844 viewport; desktop = 1440x900 (admin desktop is full-page).

**Map tiles:** every screenshot containing a map (customer 04, 07-13; driver 03-08; admin 03, 07) was re-shot the same day with real OpenStreetMap tiles (waited until all `.leaflet-tile` images had loaded). The customer pickup label now comes from Nominatim reverse-geocoding. OSRM route lines visible. Screens without a map (incl. customer 05/06 destination) are from the first capture.

## customer-app

| File | Screen / state | Data | Notes |
|---|---|---|---|
| customer-app/01-onboarding-desktop.png | onboarding | real API | Onboarding / |
| customer-app/01-onboarding-mobile.png | onboarding | real API | Onboarding / |
| customer-app/02-login-desktop.png | login | real API | Login, phone entered |
| customer-app/02-login-mobile.png | login | real API | Login, phone entered |
| customer-app/03-login-otp-desktop.png | login-otp | real API | OTP verify step (real debug OTP) |
| customer-app/03-login-otp-mobile.png | login-otp | real API | OTP verify step (real debug OTP) |
| customer-app/04-home-pickup-desktop.png | home-pickup | real API | Home/pickup; pickup address from Nominatim reverse-geocode, OSM tiles |
| customer-app/04-home-pickup-mobile.png | home-pickup | real API | Home/pickup; pickup address from Nominatim reverse-geocode, OSM tiles |
| customer-app/05-destination-recent-desktop.png | destination-recent | real API | Destination, recent list (seeded in browser localStorage) |
| customer-app/05-destination-recent-mobile.png | destination-recent | real API | Destination, recent list (seeded in browser localStorage) |
| customer-app/06-destination-search-desktop.png | destination-search | real API | Destination search "Tân Sơn Nhất" (web-shared built-in fallback, Nominatim blocked) |
| customer-app/06-destination-search-mobile.png | destination-search | real API | Destination search "Tân Sơn Nhất" (web-shared built-in fallback, Nominatim blocked) |
| customer-app/07-options-prices-desktop.png | options-prices | real API | Ride options, real quotes for all 4 vehicle types (surge active) |
| customer-app/07-options-prices-mobile.png | options-prices | real API | Ride options, real quotes for all 4 vehicle types (surge active) |
| customer-app/08-options-selected-desktop.png | options-selected | real API | Options with "Xe tiêu chuẩn" selected + quote countdown |
| customer-app/08-options-selected-mobile.png | options-selected | real API | Options with "Xe tiêu chuẩn" selected + quote countdown |
| customer-app/09-searching-desktop.png | searching | real API | Searching driver (driver hidden from matching to hold state) |
| customer-app/09-searching-mobile.png | searching | real API | Searching driver (driver hidden from matching to hold state) |
| customer-app/10-tracking-assigned-desktop.png | tracking-assigned | real API | Tracking right after assignment (realtime event; driver name/plate not in payload -> "Tài xế CAB") |
| customer-app/10-tracking-assigned-mobile.png | tracking-assigned | real API | Tracking right after assignment (realtime event; driver name/plate not in payload -> "Tài xế CAB") |
| customer-app/11-tracking-driver-arriving-desktop.png | tracking-driver-arriving | real API | Tracking after driver accepted |
| customer-app/11-tracking-driver-arriving-mobile.png | tracking-driver-arriving | real API | Tracking after driver accepted |
| customer-app/12-tracking-cancel-confirm-desktop.png | tracking-cancel-confirm | real API | Cancel confirm dialog. Mobile: bottom tab bar covers the "Giữ chuyến" button (real UI bug) |
| customer-app/12-tracking-cancel-confirm-mobile.png | tracking-cancel-confirm | real API | Cancel confirm dialog. Mobile: bottom tab bar covers the "Giữ chuyến" button (real UI bug) |
| customer-app/13-tracking-in-progress-desktop.png | tracking-in-progress | real API | Tracking, ride in progress |
| customer-app/13-tracking-in-progress-mobile.png | tracking-in-progress | real API | Tracking, ride in progress |
| customer-app/14-payment-desktop.png | payment | real API | Payment before paying |
| customer-app/14-payment-mobile.png | payment | real API | Payment before paying |
| customer-app/15-payment-result-desktop.png | payment-result | real API | Payment success (cash) |
| customer-app/15-payment-result-mobile.png | payment-result | real API | Payment success (cash) |
| customer-app/16-rating-desktop.png | rating | real API | Rating 5 stars + comment |
| customer-app/16-rating-mobile.png | rating | real API | Rating 5 stars + comment |
| customer-app/17-history-desktop.png | history | real API | Booking history (includes cancellations from capture runs) |
| customer-app/17-history-mobile.png | history | real API | Booking history (includes cancellations from capture runs) |
| customer-app/18-profile-desktop.png | profile | real API | Profile (shows phone as name - real API data) |
| customer-app/18-profile-mobile.png | profile | real API | Profile (shows phone as name - real API data) |
| customer-app/19-promotions-desktop.png | promotions | real API | Promotions empty state (no promotions backend) |
| customer-app/19-promotions-mobile.png | promotions | real API | Promotions empty state (no promotions backend) |

## driver-app

| File | Screen / state | Data | Notes |
|---|---|---|---|
| driver-app/01-login-desktop.png | login | real API | Login, phone entered |
| driver-app/01-login-mobile.png | login | real API | Login, phone entered |
| driver-app/02-login-otp-desktop.png | login-otp | real API | OTP step |
| driver-app/02-login-otp-mobile.png | login-otp | real API | OTP step |
| driver-app/03-home-offline-desktop.png | home-offline | real API | Home offline with real daily stats |
| driver-app/03-home-offline-mobile.png | home-offline | real API | Home offline with real daily stats |
| driver-app/04-home-online-desktop.png | home-online | real API | Home online |
| driver-app/04-home-online-mobile.png | home-online | real API | Home online |
| driver-app/05-incoming-request-desktop.png | incoming-request | real API | Incoming request from real ride.assigned event (no address labels in payload) |
| driver-app/05-incoming-request-mobile.png | incoming-request | real API | Incoming request from real ride.assigned event (no address labels in payload) |
| driver-app/06-active-ride-pickup-desktop.png | active-ride-pickup | real API | Active ride, waiting for customer: customer contact (name+phone) + OSRM route; points shown as coordinates |
| driver-app/06-active-ride-pickup-mobile.png | active-ride-pickup | real API | Active ride, waiting for customer: customer contact (name+phone) + OSRM route; points shown as coordinates |
| driver-app/07-active-ride-in-progress-desktop.png | active-ride-in-progress | real API | Active ride in progress |
| driver-app/07-active-ride-in-progress-mobile.png | active-ride-in-progress | real API | Active ride in progress |
| driver-app/08-active-ride-completed-desktop.png | active-ride-completed | real API | Ride completed |
| driver-app/08-active-ride-completed-mobile.png | active-ride-completed | real API | Ride completed |
| driver-app/09-earnings-desktop.png | earnings | real API | Earnings |
| driver-app/09-earnings-mobile.png | earnings | real API | Earnings |
| driver-app/10-history-desktop.png | history | real API | Ride history |
| driver-app/10-history-mobile.png | history | real API | Ride history |
| driver-app/11-profile-desktop.png | profile | real API | Profile |
| driver-app/11-profile-mobile.png | profile | real API | Profile |

## admin-dashboard

| File | Screen / state | Data | Notes |
|---|---|---|---|
| admin-dashboard/01-login-desktop.png | login | real API | Login (email/password) |
| admin-dashboard/01-login-mobile.png | login | real API | Login (email/password) |
| admin-dashboard/02-login-mfa-desktop.png | login-mfa | real API | MFA step with real TOTP |
| admin-dashboard/02-login-mfa-mobile.png | login-mfa | real API | MFA step with real TOTP |
| admin-dashboard/03-overview-desktop.png | overview | real API | Overview KPIs, surge zones, recent rides, audit |
| admin-dashboard/03-overview-mobile.png | overview | real API | Overview KPIs, surge zones, recent rides, audit |
| admin-dashboard/04-users-desktop.png | users | real API | Users |
| admin-dashboard/04-users-mobile.png | users | real API | Users |
| admin-dashboard/05-drivers-desktop.png | drivers | real API | Available drivers |
| admin-dashboard/05-drivers-mobile.png | drivers | real API | Available drivers |
| admin-dashboard/06-rides-desktop.png | rides | real API | Rides status summary |
| admin-dashboard/06-rides-mobile.png | rides | real API | Rides status summary |
| admin-dashboard/07-live-map-desktop.png | live-map | real API | Live map: demand zones; 0 driver markers (no driver location realtime events reach admin) |
| admin-dashboard/07-live-map-mobile.png | live-map | real API | Live map: demand zones; 0 driver markers (no driver location realtime events reach admin) |
| admin-dashboard/08-surge-desktop.png | surge | real API | Surge zone control |
| admin-dashboard/08-surge-mobile.png | surge | real API | Surge zone control |
| admin-dashboard/09-audit-desktop.png | audit | real API | Audit log |
| admin-dashboard/09-audit-mobile.png | audit | real API | Audit log |

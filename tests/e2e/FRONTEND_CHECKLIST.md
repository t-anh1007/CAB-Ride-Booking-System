# Frontend demo checklist

Automated verification status: **AUTOMATED PASS** only for focused source-contract tests, builds and configuration checks recorded by the worker. Browser/runtime observation remains **PENDING COORDINATOR BROWSER/RUNTIME QA** until independently observed.

1. **C1** — Customer first visit opens onboarding; tap Bắt đầu and confirm the cab.customer.onboarding.complete flag prevents it on the next visit.
2. **C2** — Customer requests OTP with destination and role customer, verifies a six-digit code, then opens protected Home.
3. **C3** — Customer grants or denies browser geolocation; the map keeps a safe pickup fallback and reverse-geocodes a moved pin.
4. **C4** — Customer searches a destination after the 800 ms debounce, selects it, and sees it in recent destinations.
5. **C5** — Customer chooses a vehicle, reviews price/surge/OSM route, lets expiresIn reach zero, then uses Refresh quote.
6. **C6** — Customer confirms an idempotent booking and sees matching state; cancellation uses the booking cancellation contract.
7. **C7** — Customer receives assignment/location/status realtime events and sees driver, rating, plate, ETA, route and marker updates.
8. **C8** — On completion Customer opens payment, reads authoritative ride fare, submits one supported payment method, and observes polling/retry state.
9. **C9** — Customer submits rating with ride, user and driver identifiers; duplicate review is reported honestly.
10. **C10** — Customer filters booking history by date/status and opens route, amount and status detail.
11. **C11** — Customer reads profile, wallet, preferences and saved locations, then logs out with the stored refresh token.
12. **Driver** — Driver authenticates, toggles go-online/go-offline and permits throttled location updates.
13. **Driver** — Incoming ride counts down from 15 seconds; driver accepts or cancels through the supported lifecycle route.
14. **Driver** — Active ride sends location while active, then starts/completes; earnings and history include numeric priceSnapshot and realtime completed income.
15. **Admin** — Admin password/MFA protects dashboard; KPI and available-driver count render from read contracts.
16. **Admin** — Admin searches users, checks available drivers and aggregate-only rides without invented list APIs.
17. **Admin** — Live map deduplicates valid driver locations; Surge and Audit clearly show read-only/degraded behavior where contracts are unavailable.

PENDING COORDINATOR BROWSER/RUNTIME QA: representative customer, driver and admin browser paths must still be observed on a stopped-service-safe local runtime by the Coordinator.

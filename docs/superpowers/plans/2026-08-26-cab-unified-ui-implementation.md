# CAB Unified UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the visible Customer, Driver, and Admin legacy interfaces with the approved CAB design while preserving the connected API, authentication, map, GPS, and realtime behavior.

**Architecture:** Keep the current connected runtime (`src/App.jsx`, `src/router.jsx`, providers, and pages) as the behavioral spine and migrate its presentation in place. Put behavior-free tokens and primitives in `@cab/web-shared`, complete and verify one role at a time, then remove only the disconnected draft trees after that role passes its focused tests, build, direct browser workflow, and screenshot gate.

**Tech Stack:** React 18, Vite 5, Tailwind CSS 3, react-router-dom 6, Leaflet 1.9, react-leaflet 4, native WebSocket, Node test runner, Codex in-app browser.

**Spec:** `docs/superpowers/specs/2026-08-26-cab-unified-ui-design.md`

## Global Constraints

- Visual authority: `docs/design/cab-ui-reference.png`.
- Preserve all canonical URLs and dynamic `:id` parameters from the spec.
- Preserve current providers, API clients, GPS, maps, realtime messages, localStorage keys, and role permissions.
- Never replace live operational data with hard-coded arrays from `src/modules`.
- Test E2E through the Codex in-app browser; do not use Playwright.
- Capture exactly one screenshot per successful function; do not capture error-path screenshots.
- Customer and Driver acceptance width: 390px; Admin acceptance viewport: 1440x900.
- Do not expose OTP, MFA secrets, recovery codes, tokens, or session payloads in screenshots.
- Do not remove a role's draft tree until its contract test, build, browser matrix, and screenshot gate pass.
- Preserve unrelated worktree changes and stage explicit UI paths only.

---

### Task 1: Freeze the visual and behavioral baseline

**Files:**
- Verify: `docs/design/cab-ui-reference.png`
- Modify: `apps/customer-app/test/app-contract.test.js`
- Modify: `apps/driver-app/test/app-contract.test.js`
- Modify: `apps/admin-dashboard/test/app-contract.test.js`

**Interfaces:**
- Consumes: Current canonical routes, connected page files, and localStorage keys documented in the spec.
- Produces: Contract assertions that prevent route, dynamic-ID, provider, and live-data regressions during visual migration.

- [ ] **Step 1: Verify the durable reference asset**

Run: `Get-Item -LiteralPath docs/design/cab-ui-reference.png | Select-Object FullName,Length`

Expected: the file exists and its size is greater than 1,000,000 bytes.

- [ ] **Step 2: Extend the three existing app contracts**

Customer assertions cover `/tracking/:id`, `/payment/:id`, `/rating/:id`, `cab.customer.session`, `cab.customer.onboarding.complete`, and `cab.customer.recent.destinations`. Driver assertions cover `/ride/:id`, `/incoming`, `cab.driver.session`, availability endpoints, location updates, and pending/error protection. Admin assertions cover `/users`, `/drivers`, `/rides`, `/map`, `/surge`, `/audit`, `cab.admin.session`, MFA challenge handling, controlled user search, and realtime map updates. Keep every existing API/map/realtime assertion.

- [ ] **Step 3: Run the baseline contracts**

```powershell
node --test apps/customer-app/test/app-contract.test.js
node --test apps/driver-app/test/app-contract.test.js
node --test apps/admin-dashboard/test/app-contract.test.js
```

Expected: all three commands pass before visual code changes begin.

- [ ] **Step 4: Commit only the baseline artifacts**

```powershell
git add docs/design/cab-ui-reference.png apps/customer-app/test/app-contract.test.js apps/driver-app/test/app-contract.test.js apps/admin-dashboard/test/app-contract.test.js
git commit -m "test(ui): freeze CAB frontend behavior baseline"
```

### Task 2: Build the shared CAB visual primitives

**Files:**
- Create: `packages/web-shared/src/ui/tokens.css`
- Create: `packages/web-shared/src/ui/CabButton.jsx`
- Create: `packages/web-shared/src/ui/StatusChip.jsx`
- Create: `packages/web-shared/src/ui/SurfaceState.jsx`
- Create: `packages/web-shared/test/ui-contract.test.js`
- Modify: `packages/web-shared/src/index.js`
- Modify: `packages/web-shared/package.json`
- Modify: `apps/customer-app/src/styles/tailwind.css`
- Modify: `apps/driver-app/src/styles/tailwind.css`
- Modify: `apps/admin-dashboard/src/styles/tailwind.css`

**Interfaces:**
- Produces: `CabButton({variant, busy, disabled, children, ...props})`, `StatusChip({tone, children})`, `SurfaceState({kind, title, detail, action})`, and CSS variables exported as `@cab/web-shared/ui.css`.
- Consumes: Existing React peer dependency and app Tailwind entrypoints.

- [ ] **Step 1: Write the failing shared UI contract test**

Assert that `tokens.css` contains `--cab-canvas: #f6f4ee`, `--cab-ink: #10231d`, `--cab-active: #2ce6a6`, `--cab-danger: #f36c5b`, the five approved radius values, `:focus-visible`, and `prefers-reduced-motion`. Assert that `src/index.js` exports the three components.

- [ ] **Step 2: Run the shared UI contract and confirm the expected failure**

Run: `node --test packages/web-shared/test/ui-contract.test.js`

Expected: FAIL because the UI files and exports do not exist yet.

- [ ] **Step 3: Add tokens, primitives, and exports**

Define the approved palette, typography, 4px spacing scale, radii, restrained shadow, focus ring, safe-area helpers, 44px mobile control minimum, and reduced-motion rule in `tokens.css`. Add `"./ui.css": "./src/ui/tokens.css"` to package exports. Implement the four button variants, five text-bearing chip tones, and loading/empty/error surface state without requests or business state.

- [ ] **Step 4: Import the shared stylesheet in all three apps**

Import `@cab/web-shared/ui.css` at the top of each app's `src/styles/tailwind.css`, then replace the duplicated legacy token blocks with role-shell layout classes consuming shared variables.

- [ ] **Step 5: Verify the shared UI and all app builds**

```powershell
node --test packages/web-shared/test/ui-contract.test.js
npm run build --workspace @cab/customer-app
npm run build --workspace @cab/driver-app
npm run build --workspace @cab/admin-dashboard
```

Expected: UI contract passes and all Vite builds complete without unresolved package exports.

- [ ] **Step 6: Commit the shared visual foundation**

```powershell
git add packages/web-shared apps/customer-app/src/styles/tailwind.css apps/driver-app/src/styles/tailwind.css apps/admin-dashboard/src/styles/tailwind.css
git commit -m "feat(ui): add shared CAB visual primitives"
```

### Task 3: Migrate the connected Customer workflow

**Files:**
- Modify: `apps/customer-app/src/components/CustomerShell.jsx`
- Modify: `apps/customer-app/src/pages/OnboardingPage.jsx`
- Modify: `apps/customer-app/src/pages/LoginPage.jsx`
- Modify: `apps/customer-app/src/pages/HomeMapPage.jsx`
- Modify: `apps/customer-app/src/pages/DestinationPage.jsx`
- Modify: `apps/customer-app/src/pages/RideOptionsPage.jsx`
- Modify: `apps/customer-app/src/pages/SearchingDriverPage.jsx`
- Modify: `apps/customer-app/src/pages/RideTrackingPage.jsx`
- Modify: `apps/customer-app/src/pages/PaymentPage.jsx`
- Modify: `apps/customer-app/src/pages/RatingPage.jsx`
- Modify: `apps/customer-app/src/pages/HistoryPage.jsx`
- Modify: `apps/customer-app/src/pages/ProfilePage.jsx`
- Modify: `apps/customer-app/test/app-contract.test.js`

**Interfaces:**
- Consumes: Existing Customer providers, shared maps, `CabButton`, `StatusChip`, and `SurfaceState`.
- Produces: Approved mobile presentation on existing Customer routes with unchanged navigation state and API behavior.

- [ ] **Step 1: Add visual-runtime prohibitions to the Customer contract**

Assert `src/App.jsx` still mounts all three providers, `src/router.jsx` retains every canonical route, connected pages never import from `src/modules`, and reachable pages contain no fixed mock trip arrays. Run the contract and confirm the new visual assertions fail before restyling.

- [ ] **Step 2: Restyle onboarding, login, and shell**

Use the CAB wordmark, canvas, dark header, green primary action, compact bottom navigation, safe-area padding, visible focus, and 44px controls. Preserve onboarding state, OTP request/verification, session persistence, protected routing, and logout.

- [ ] **Step 3: Restyle pickup and destination as map-first screens**

Keep geolocation, map click/drag, reverse geocoding, debounced search, recent destinations, and booking state. Compose the map behind a floating bottom sheet with green pickup and red destination semantics.

- [ ] **Step 4: Restyle quote, driver search, tracking, payment, and rating**

Render backend quote data and textual failure states. Preserve quote refresh, booking creation, booking/ride IDs, realtime filtering, cancellation, route geometry, marker updates, status transitions, payment write, and rating write.

- [ ] **Step 5: Restyle history, wallet, settings, and logout**

Render API-backed data with status chips, local loading boundaries, actionable errors, and true empty states. Preserve wallet, preferences, saved locations, filters, and logout behavior.

- [ ] **Step 6: Run Customer verification**

```powershell
node --test apps/customer-app/test/app-contract.test.js apps/customer-app/test/realtime-event.test.js
npm run build --workspace @cab/customer-app
```

Expected: all Customer tests pass and the build succeeds.

- [ ] **Step 7: Commit the connected Customer migration**

```powershell
git add apps/customer-app/src apps/customer-app/test
git commit -m "feat(customer-ui): apply unified CAB mobile design"
```

### Task 4: Browser-verify Customer and capture evidence

**Files:**
- Create: `docs/screenshots/customer-ui-new-01-onboarding.png`
- Create: `docs/screenshots/customer-ui-new-02-login-otp.png`
- Create: `docs/screenshots/customer-ui-new-03-authenticated-pickup.png`
- Create: `docs/screenshots/customer-ui-new-04-destination.png`
- Create: `docs/screenshots/customer-ui-new-05-vehicle-quote.png`
- Create: `docs/screenshots/customer-ui-new-06-searching-driver.png`
- Create: `docs/screenshots/customer-ui-new-07-ride-tracking.png`
- Create: `docs/screenshots/customer-ui-new-08-payment.png`
- Create: `docs/screenshots/customer-ui-new-09-rating.png`
- Create: `docs/screenshots/customer-ui-new-10-history.png`
- Create: `docs/screenshots/customer-ui-new-11-wallet.png`
- Create: `docs/screenshots/customer-ui-new-12-settings.png`
- Create: `docs/screenshots/customer-ui-new-13-logout.png`

**Interfaces:**
- Consumes: Running Docker stack and Customer app at `http://localhost:5174`.
- Produces: Browser-visible proof for every successful Customer function.

- [ ] **Step 1: Check Docker and application readiness**

Use read-only container status and HTTP readiness checks. Fix only a narrowly scoped defect that blocks an already-supported Customer workflow, then repeat the same browser step.

- [ ] **Step 2: Complete the Customer workflow at 390px in the Codex in-app browser**

Verify onboarding, OTP login, pickup, destination, quote, booking, driver search, assignment, tracking, payment, rating, history, wallet, settings, and logout. Check focus, touch targets, no overflow, route IDs, and realtime text. Test errors without screenshots.

- [ ] **Step 3: Capture and compare the 13 successful screens**

Save exactly the 13 named files. Exclude OTPs and session data. Compare hierarchy, palette, map treatment, sheets, spacing, radii, chips, and copy against the reference. After any fix, repeat the affected UI path, Customer tests, and build.

- [ ] **Step 4: Commit Customer evidence**

```powershell
git add docs/screenshots/customer-ui-new-*.png
git commit -m "docs(customer-ui): capture browser verification"
```

### Task 5: Migrate and browser-verify the connected Driver workflow

**Files:**
- Modify: `apps/driver-app/src/components/DriverShell.jsx`
- Modify: `apps/driver-app/src/pages/LoginPage.jsx`
- Modify: `apps/driver-app/src/pages/DriverHomePage.jsx`
- Modify: `apps/driver-app/src/pages/IncomingRequestPage.jsx`
- Modify: `apps/driver-app/src/pages/ActiveRidePage.jsx`
- Modify: `apps/driver-app/src/pages/EarningsPage.jsx`
- Modify: `apps/driver-app/src/pages/DriverHistoryPage.jsx`
- Modify: `apps/driver-app/src/pages/DriverProfilePage.jsx`
- Modify: `apps/driver-app/test/app-contract.test.js`
- Create: `docs/screenshots/driver-ui-new-01-online.png`
- Create: `docs/screenshots/driver-ui-new-02-incoming-request.png`
- Create: `docs/screenshots/driver-ui-new-03-active-ride.png`
- Create: `docs/screenshots/driver-ui-new-04-en-route.png`
- Create: `docs/screenshots/driver-ui-new-05-completed-ride.png`
- Create: `docs/screenshots/driver-ui-new-06-earnings.png`
- Create: `docs/screenshots/driver-ui-new-07-history.png`
- Create: `docs/screenshots/driver-ui-new-08-profile.png`
- Create: `docs/screenshots/driver-ui-new-09-logout.png`

**Interfaces:**
- Consumes: Driver providers, location watcher, ride endpoints, realtime events, and shared CAB primitives.
- Produces: New Driver mobile UI on existing routes plus nine browser evidence files.

- [ ] **Step 1: Extend and run the Driver contract**

Assert provider order, canonical routes, dynamic ride ID, 5-second location throttle, safe availability pending state, realtime request handling, and absence of `src/modules` imports. Confirm new visual assertions fail before restyling.

- [ ] **Step 2: Restyle login, shell, availability, incoming request, and ride lifecycle**

Preserve OTP/session behavior, GPS permissions, online/offline APIs, location updates, realtime assignment, accept/decline, pickup navigation, start, in-progress, completion, cancellation, route geometry, and disabled/pending actions.

- [ ] **Step 3: Restyle earnings, history, profile, and logout**

Keep API-backed totals, rides, ratings, driver identity, vehicle data, loading/error states, and logout. Do not copy fixed values from draft modules.

- [ ] **Step 4: Run Driver tests and build**

```powershell
node --test apps/driver-app/test/app-contract.test.js
npm run build --workspace @cab/driver-app
```

- [ ] **Step 5: Verify at 390px and capture nine screenshots**

Use the in-app browser against Docker to complete online, incoming request, accept, active ride, en route, completion, earnings, history, profile, and logout. Test errors without screenshots. Save exactly the nine named files and compare them with the reference.

- [ ] **Step 6: Commit Driver code and evidence**

```powershell
git add apps/driver-app/src apps/driver-app/test docs/screenshots/driver-ui-new-*.png
git commit -m "feat(driver-ui): apply and verify unified CAB design"
```

### Task 6: Migrate and browser-verify the connected Admin workflow

**Files:**
- Modify: `apps/admin-dashboard/src/components/AdminShell.jsx`
- Modify: `apps/admin-dashboard/src/pages/LoginPage.jsx`
- Modify: `apps/admin-dashboard/src/pages/DashboardPage.jsx`
- Modify: `apps/admin-dashboard/src/pages/UsersPage.jsx`
- Modify: `apps/admin-dashboard/src/pages/DriversPage.jsx`
- Modify: `apps/admin-dashboard/src/pages/RidesPage.jsx`
- Modify: `apps/admin-dashboard/src/pages/LiveMapPage.jsx`
- Modify: `apps/admin-dashboard/src/pages/SurgeControlPage.jsx`
- Modify: `apps/admin-dashboard/src/pages/AuditLogPage.jsx`
- Modify: `apps/admin-dashboard/test/app-contract.test.js`
- Create: `docs/screenshots/admin-ui-new-01-dashboard.png`
- Create: `docs/screenshots/admin-ui-new-02-users-search.png`
- Create: `docs/screenshots/admin-ui-new-03-available-drivers.png`
- Create: `docs/screenshots/admin-ui-new-04-rides-summary.png`
- Create: `docs/screenshots/admin-ui-new-05-live-map.png`
- Create: `docs/screenshots/admin-ui-new-06-surge-monitor.png`
- Create: `docs/screenshots/admin-ui-new-07-audit-log.png`

**Interfaces:**
- Consumes: Admin auth/MFA and realtime providers, aggregate endpoints, Leaflet, and shared CAB primitives.
- Produces: Fluid desktop Admin UI on existing routes plus seven browser evidence files.

- [ ] **Step 1: Extend and run the Admin contract**

Assert canonical routes, provider order, MFA flow, controlled filtering, API-backed data, realtime map updates, and absence of `max-w-sm`, fixed `h-[760px]`, and `src/modules` imports in reachable pages. Confirm new visual assertions fail before restyling.

- [ ] **Step 2: Restyle login/MFA, shell, dashboard, and tables**

Build the dark sidebar, white toolbar, horizontal KPI row, compact tables, active navigation, and role logout. Preserve login, challenge-token MFA, session persistence, protected routes, controlled search, live endpoints, loading, errors, and empty states.

- [ ] **Step 3: Restyle live map, surge, and audit log**

Keep realtime driver updates, aggregate-only ride behavior, current surge writes, confirmation/pending safeguards, and live audit data. Invalidate Leaflet size after shell changes. Do not add unsupported row actions.

- [ ] **Step 4: Run Admin tests and build**

```powershell
node --test apps/admin-dashboard/test/app-contract.test.js
npm run build --workspace @cab/admin-dashboard
```

- [ ] **Step 5: Verify at 1440x900 and capture seven screenshots**

Use the in-app browser against Docker to verify password/MFA, dashboard, user search, drivers, rides, live map, surge, audit, and logout. Do not capture MFA secrets or error paths. Save exactly the seven named files and compare them with the reference.

- [ ] **Step 6: Commit Admin code and evidence**

```powershell
git add apps/admin-dashboard/src apps/admin-dashboard/test docs/screenshots/admin-ui-new-*.png
git commit -m "feat(admin-ui): apply and verify unified CAB design"
```

### Task 7: Remove disconnected drafts and complete cutover

**Files:**
- Delete after all gates pass: `apps/customer-app/src/app/`, `apps/customer-app/src/modules/`, `apps/customer-app/src/layouts/`
- Delete after all gates pass: `apps/driver-app/src/app/`, `apps/driver-app/src/modules/`, `apps/driver-app/src/layouts/`
- Delete after all gates pass: `apps/admin-dashboard/src/app/`, `apps/admin-dashboard/src/modules/`, `apps/admin-dashboard/src/layouts/`

**Interfaces:**
- Consumes: Passing focused tests/builds and complete screenshot matrices from Tasks 3-6.
- Produces: One connected runtime architecture per app with no reachable legacy visuals or disconnected mock modules.

- [ ] **Step 1: Prove the draft trees are unreachable**

Trace each `main.jsx`/`App.jsx` import graph and search for `@app/`, `src/modules`, and `src/layouts`. Expected: no connected runtime or focused test imports the nine draft directories.

- [ ] **Step 2: Delete only the nine approved draft directories**

Do not remove `src/providers`, connected `src/pages`, `src/router.jsx`, `src/components/*Shell.jsx`, Customer realtime normalization, app API helpers, or shared map/service code.

- [ ] **Step 3: Run full focused frontend verification**

```powershell
node --test packages/web-shared/test/*.test.js
node --test apps/customer-app/test/*.test.js
node --test apps/driver-app/test/*.test.js
node --test apps/admin-dashboard/test/*.test.js
npm run build --workspace @cab/customer-app
npm run build --workspace @cab/driver-app
npm run build --workspace @cab/admin-dashboard
```

Expected: every test and build passes after draft deletion.

- [ ] **Step 4: Re-open one canonical deep link per role**

Verify Customer `/tracking/:id`, Driver `/ride/:id`, and Admin `/map` with valid runtime IDs/session state. Confirm no namespaced draft route or old visual primitive is reachable.

- [ ] **Step 5: Audit screenshot completeness and sensitive content**

Expected counts: 13 Customer, 9 Driver, and 7 Admin new-UI screenshots. Inspect for OTPs, MFA secrets, tokens, recovery codes, browser devtools, clipped content, and accidental error screenshots; none may remain.

- [ ] **Step 6: Inspect scope and commit cleanup**

Use `git status --short` and `git diff --stat`. Exclude generated `dist`, `.superpowers`, `.playwright-mcp`, secrets, and unrelated backend/worktree changes.

```powershell
git add apps/customer-app/src apps/driver-app/src apps/admin-dashboard/src
git commit -m "refactor(ui): remove disconnected legacy drafts"
```

## Self-review result

- Spec coverage: visual authority, route compatibility, shared primitives, connected behavior, role order, browser-only E2E, screenshots, accessibility, security, and deletion gates each map to an executable task.
- Placeholder scan: no deferred implementation markers or unspecified error-handling steps remain.
- Interface consistency: all roles consume the same `CabButton`, `StatusChip`, `SurfaceState`, and token stylesheet; public routes and persisted keys remain unchanged throughout the plan.

# CAB unified UI design

## Goal and visual authority

Replace the visible legacy UI in Customer, Driver, and Admin with one CAB visual system while preserving the runtime behavior that has already been connected and browser-tested.

The sole visual authority is `docs/design/cab-ui-reference.png`. It is the durable repository copy of the approved 1536x1024 CAB reference board with SHA-256 `21103e16eddd6d8986cb91d67dd614e184921a05fdbe41665e0f9b42cddacc53`. Temporary files under `C:/Users/.../Temp` and `.superpowers/` are not design inputs.

Business APIs, authentication, providers, realtime contracts, persisted data, public URLs, and role permissions remain unchanged. A screen is not considered migrated when it only looks correct; its real API, GPS, map, realtime, loading, error, and write behavior must still work.

## Migration model

Delivery remains role-by-role:

1. Customer mobile: onboarding, OTP login, pickup map, destination selection, vehicle selection, driver search, ride tracking, payment, rating, history, wallet, settings, and logout.
2. Driver mobile: OTP login, availability, incoming request, pickup navigation, ride lifecycle, earnings, history, profile, and logout.
3. Admin desktop: MFA login, operations KPI, users, drivers, rides, live map, surge monitor, audit log, and logout.

The connected runtime tree (`src/App.jsx`, `src/router.jsx`, `src/providers`, and `src/pages`) is the behavioral baseline. It is restyled and decomposed in place. The parallel `src/app`, `src/modules`, and `src/layouts` trees are presentation drafts, not a replacement runtime: they may be used as visual references, but hard-coded data or disconnected actions from those drafts must never enter the runtime.

For each role:

1. Capture the current route and behavior baseline.
2. Add shared tokens and primitives without changing behavior.
3. Migrate connected screens in workflow order.
4. Run focused contract/build checks and browser QA against real services.
5. Capture one successful screenshot per verified function.
6. Remove the role's unused draft tree only after all gates pass.

At no point may one role display a mixture of legacy and new visual primitives in its reachable runtime routes.

## Public route compatibility

Each app runs on its own origin, so the existing short URLs remain canonical. Namespaced draft URLs such as `/customer/...`, `/driver/...`, and `/admin/...` are not promoted to public runtime routes.

### Customer

| Function | Canonical route |
| --- | --- |
| Onboarding | `/` |
| OTP login | `/login` |
| Pickup | `/home` |
| Destination | `/destination` |
| Vehicle and quote | `/options` |
| Driver search | `/searching` |
| Ride tracking | `/tracking/:id` |
| Payment | `/payment/:id` |
| Rating | `/rating/:id` |
| History | `/history` |
| Profile, wallet, settings | `/profile` |

### Driver

| Function | Canonical route |
| --- | --- |
| OTP login | `/login` |
| Availability | `/home` |
| Incoming request | `/incoming` |
| Active ride lifecycle | `/ride/:id` |
| Earnings | `/earnings` |
| History | `/history` |
| Profile | `/profile` |

### Admin

| Function | Canonical route |
| --- | --- |
| Password and MFA login | `/login` |
| Operations dashboard | `/` |
| Users | `/users` |
| Drivers | `/drivers` |
| Rides | `/rides` |
| Live map | `/map` |
| Surge | `/surge` |
| Audit log | `/audit` |

Dynamic route parameters, `location.state`, query strings, and these persisted keys remain compatible: `cab.customer.session`, `cab.customer.onboarding.complete`, `cab.customer.recent.destinations`, `cab.customer.saved-locations`, `cab.driver.session`, and `cab.admin.session`.

## Visual system

- Canvas: `#F6F4EE`; dark primary/navigation: `#10231D`; active/online: `#2CE6A6`.
- Semantic colors: blue for in-progress, yellow for warning, and red `#F36C5B` for destructive and cancelled states.
- Typography: Inter or system sans; thin borders; restrained shadows; spacing based on 4px; radii `4px`, `8px`, `12px`, `16px`, and `24px`.
- Customer and Driver: fluid 390-430px mobile surfaces, map-first composition, floating bottom sheets, compact bottom navigation, green pickup pins, red destination pins, and dark vehicle markers. Do not render a fake device frame or a fixed `760px`-high mockup in production.
- Admin: fluid desktop operations surface designed and checked at 1440x900, with dark sidebar, white toolbar, horizontal KPI row, large live map, compact tables, and status chips. It must not use a centered `max-w-sm` mobile card.
- Status always has text in addition to color. Icons must have an accessible label when the meaning is not already visible in adjacent text.
- Controls have visible keyboard focus, a minimum 44x44px mobile target, sufficient contrast, and reduced-motion behavior for nonessential animations.
- Mobile layouts support safe-area insets and no horizontal overflow. Leaflet maps invalidate their size after shell or sheet layout changes.

## Component architecture

The shared UI contract lives under `packages/web-shared/src/ui` and is exported by `@cab/web-shared`. It owns design tokens and behavior-free primitives such as buttons, status chips, surface states, and visual map markers.

Each app has three layers:

1. A role shell that composes shared primitives into mobile navigation or the desktop admin workspace.
2. Connected feature screens that preserve the current route, provider, API, GPS, map, and realtime behavior.
3. Existing providers and services for auth, booking, ride state, API access, GPS, and realtime.

The design work may add focused presentation components and route adapters. It must not duplicate business state, bypass providers, fabricate API responses, or ship controls that have no supported write endpoint.

## Data, state, and failure behavior

- Loading is local to the region being fetched; selected state is retained during background refreshes.
- API errors remain actionable and visible without replacing useful content with a blank screen.
- Existing retry and reconnect behavior is retained. Realtime connection state is visible as a textual status chip.
- The UI does not invent operational values, maps, rides, forecasts, users, drivers, or write actions when the backend has no supporting endpoint.
- Empty states distinguish “no data” from “request failed”. Destructive actions keep their existing confirmation and disabled/pending behavior.
- MFA secrets, recovery codes, access tokens, phone OTP values, and session payloads must not appear in screenshots, browser logs, or committed fixtures.

## Verification and screenshot matrix

Testing uses the Codex in-app browser directly, not Playwright. Error paths are tested but do not require screenshots. Successful functions receive exactly one fresh screenshot under `docs/screenshots`.

Customer is checked at the current browser viewport and 390px mobile width. Required successful evidence: onboarding, OTP login, authenticated pickup map, destination, quote/options, driver search, ride tracking, payment, rating, history, wallet, settings, and logout.

Driver is checked at the current browser viewport and 390px mobile width. Required successful evidence: online availability, incoming request, active ride, en route, completed ride, earnings, history, profile, and logout.

Admin is checked at 1440x900. Required successful evidence: dashboard, user search, available drivers, ride summary, live map, surge monitor, and audit log. MFA is functionally verified without capturing secrets.

New screenshots use `customer-ui-new-XX-*.png`, `driver-ui-new-XX-*.png`, and `admin-ui-new-XX-*.png` so the existing behavioral baseline remains available for comparison.

Final visual review compares `docs/design/cab-ui-reference.png` with the new screenshots for layout hierarchy, palette, typography, icon treatment, map treatment, spacing/radius, information density, and visible copy. No overflow, clipped primary content, placeholder UI, hard-coded operational data, dead control, console-breaking error, or legacy visual primitive may remain.

## Cutover and deletion gates

A role may be declared migrated only when all of the following pass:

1. Its existing app-contract tests pass with route and behavior assertions intact.
2. Its Vite production build succeeds.
3. Every required browser workflow completes against the running Docker stack.
4. Every required success screenshot exists and visually matches the reference.
5. The runtime entrypoint imports only the connected router/providers and the new visual system.
6. A source search confirms reachable runtime files contain no fabricated operational arrays or old visual tokens.

Only then may that role's unused `src/app`, `src/modules`, and `src/layouts` draft trees be removed. Do not delete `src/providers`, connected `src/pages`, `src/router.jsx`, realtime normalization, API clients, or shared map/service code merely because their visuals originated in the legacy implementation.

## Scope boundaries

This work replaces presentation and removes unused frontend drafts. It does not redesign service contracts, migrate databases, deploy, merge, force-push, or alter unrelated worktree changes. A backend defect discovered during browser QA may be fixed only when required to restore an already-supported UI workflow; such a fix must stay narrowly scoped and be retested through the browser.

The working tree already contains unrelated changes. Implementation must stage and commit explicit UI paths only. Generated `dist` files, `.superpowers/`, `.playwright-mcp/`, secrets, and unrelated service changes are excluded unless the Owner explicitly expands scope.

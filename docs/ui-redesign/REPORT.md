# CAB UI redesign report

Branch: `feature/ui-redesign` (local only). The existing palette, API calls, endpoints, auth, and booking/payment data flow remain unchanged. The redesign covers every route in the three connected `src/router.jsx` files.

## Before → after

| App | Screen / route | Change |
| --- | --- | --- |
| Customer | Onboarding `/` | Narrow instruction screen → spacious type and a clear three-step journey. |
| Customer | Login `/login` | Basic OTP form → focused, labelled sign-in panel. |
| Customer | Pickup `/home` | Fixed-width map screen → responsive map with a prominent pickup action panel. |
| Customer | Destination `/destination` | Bare search field → labelled search with guidance, recent places, and error state. |
| Customer | Options `/options` | Raw vehicle codes and quote action → readable vehicle names, fare panel, and clear refresh copy. |
| Customer | Searching `/searching` | Plain wait screen → focused live status and cancellation action. |
| Customer | Tracking `/tracking/:id` | Raw ride status → readable trip status beside the live map. |
| Customer | Payment `/payment/:id` | Raw fare/form → labelled payment method and clear total. |
| Customer | Rating `/rating/:id` | Unlabelled inputs → labelled rating and feedback controls. |
| Customer | History `/history` | Plain list → readable cards, filters, and distinct loading/empty/error states. |
| Customer | Profile `/profile` | Dense profile view → responsive tab row and content panel. |
| Driver | Login `/login` | Basic OTP form → readable, large-control sign-in panel. |
| Driver | Availability `/home` | Fixed-width map → responsive map and a single large online/offline action. |
| Driver | Request `/incoming` | Dense request view → clear route, countdown, and large accept/decline actions. |
| Driver | Active ride `/ride/:id` | Map followed by a small action → map and sticky primary trip action. |
| Driver | Earnings `/earnings` | Plain total → prominent amount with loading/error states. |
| Driver | History `/history` | Raw status list → readable cards and loading/empty/error states. |
| Driver | Profile `/profile` | Plain account screen → consistent panel and large sign-out action. |
| Admin | Login `/login` | Unlabelled MFA fields → centred, labelled sign-in and recovery controls. |
| Admin | Overview `/` | Basic KPIs → responsive operations dashboard with clear data hierarchy. |
| Admin | Users `/users` | Basic table → readable table, search, and empty result state. |
| Admin | Drivers `/drivers` | Basic table → readable availability table and empty state. |
| Admin | Rides `/rides` | Plain aggregate → clear read-only trip summary. |
| Admin | Map `/map` | Basic map → larger operations map and live driver count. |
| Admin | Surge `/surge` | Plain section → consistent pricing panel and hierarchy. |
| Admin | Audit `/audit` | Plain section → consistent audit table and empty state. |

The three apps now share `apps/ui.css` for typography, forms, cards, focus, and responsive rules. App styles handle the customer/driver map panels and the admin navigation/data layout. The existing `@cab/web-shared/ui.css` supplies the unchanged color tokens and components.

## Run locally

From the repository root, run `npm install`, then start each frontend in a separate terminal:

```powershell
npm run dev:customer # http://localhost:5174
npm run dev:driver   # http://localhost:5175
npm run dev:admin    # http://localhost:5176
```

The gateway and supporting services are required for live bookings, maps, and operational data. Frontend preview screenshots below used local browser-only sessions; the admin data screenshots used browser-only responses.

## Verification

| Check | Result |
| --- | --- |
| Install | `npm install --workspace @cab/customer-app --ignore-scripts --no-save --package-lock=false --prefer-offline` ran successfully, then the same command with `@cab/driver-app` and `@cab/admin-dashboard`. npm reported four dependency audit advisories and no missing build dependency. |
| Tests | `node --test apps/customer-app/test/*.test.js` 2/2; driver 1/1; admin 1/1. |
| Build | `npm run build --workspace @cab/customer-app`, `@cab/driver-app`, and `@cab/admin-dashboard` all passed; Vite transformed 108, 103, and 104 modules respectively. Generated tracked `dist/` bundles were committed with the sources. |
| Lint | No app defines a lint script. |
| Responsive | Browser checked 26 connected routes at 375, 768, and 1440 px: 78 checks, no document-level horizontal overflow. |
| Forms | Browser checked connected form routes: no unlabelled `input`, `select`, or `textarea`. |
| Contrast | Existing palette retained. Measured ink/surface 16.40:1, muted/canvas 4.64:1, active ink/active 8.21:1, and ink/danger 5.55:1. Existing visible focus and reduced-motion rules remain in the shared CSS. |
| Diff | `git diff --check` passed. No tracked path outside `apps/` and `docs/ui-redesign/` changed. |

## Screenshots

- Customer: [onboarding 375](screenshots/customer-app/onboarding-375.png), [onboarding 1440](screenshots/customer-app/onboarding-1440.png), [login 375](screenshots/customer-app/login-375.png), [pickup 375](screenshots/customer-app/pickup-375.png), [pickup 1440](screenshots/customer-app/pickup-1440.png).
- Driver: [login 375](screenshots/driver-app/login-375.png), [availability 375](screenshots/driver-app/home-375.png), [availability 1440](screenshots/driver-app/home-1440.png).
- Admin: [login 375](screenshots/admin-dashboard/login-375.png), [overview 375](screenshots/admin-dashboard/overview-data-375.png), [overview 1440](screenshots/admin-dashboard/overview-data-1440.png).

## Decisions & assumptions

- The connected `src/main.jsx` files import `src/App.jsx` and `src/router.jsx`. The separate `src/app/` and `src/modules/` trees are inactive drafts, so screen coverage refers to the connected routes above.
- The existing shared CSS package already defines the palette and accessible focus/motion behavior; app-level CSS reuses it without introducing a dependency or changing package code.
- Existing `dist/` bundles are tracked by Git, so refreshed build output is part of the commits.

## Known limits

- The backend and external map tiles were unavailable in the local browser preview. Map screenshots show the map canvas and controls without tiles; end-to-end booking, payment, driver dispatch, and production data were not exercised. Browser-only sessions and mock admin responses were used solely for layout checks.
- Admin ride management remains aggregate-only because the existing API does not expose a public per-ride list on this connected screen. No API contract was changed.
- Full automated WCAG auditing was not configured; contrast values and form labels were checked directly.

## Branch log

The log below was captured before this report/screenshots commit; run `git log --oneline feature/ui-redesign` for the complete current log.

```text
727447f feat(ui): clarify trip states and complete route styling
8b1bcb6 feat(admin-dashboard): redesign operations UI
f6c8bce feat(driver-app): refresh trip and earnings UI
024bd23 feat(customer-app): redesign connected ride screens
2d1238f docs(readme): add English translation with language toggle
```

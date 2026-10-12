# CAB UI redesign

## Direction

Keep CAB's existing deep green and mint identity. The map is the customer's and driver's main visual anchor; a clear action panel sits beside it on wide screens and below it on phones. Admin uses a compact navigation rail, large data headings, and quiet tables. No decorative content or new dependency.

## Tokens

Use the existing `@cab/web-shared/ui.css` variables without changing their values: canvas `#f6f4ee`, surface `#ffffff`, ink `#10231d`, muted `#617269`, line `#dce5df`, active `#2ce6a6`, progress `#397ce8`, warning `#f3b33d`, danger `#f36c5b`. Use the existing Inter/system font stack. Headings 28–48 px; body 16 px; support text at least 14 px. Space on an 8 px rhythm; panels use the existing 16 and 24 px radii. Buttons and inputs have at least 48 px touch height.

## Components and states

Use the existing `CabButton`, `StatusChip`, `SurfaceState`, and map components. App CSS styles page headings, route panels, forms, filter rows, tables, and navigation consistently. Loading, empty, and error copy remains adjacent to the related data and uses status semantics. Focus is visible; reduced motion follows the shared stylesheet.

## Screen coverage

- Customer: onboarding, OTP login, pickup, destination search, vehicle and price selection, driver search, trip tracking, payment, rating, history, profile.
- Driver: OTP login, availability, incoming request, active trip, earnings, history, profile.
- Admin: MFA login, overview, users, drivers, trips, live map, surge, audit.

All connected routes are in each app's `src/router.jsx`. The `src/modules/` trees are unused drafts and are outside this connected route redesign.

## Responsive rules

At 375 px, navigation and primary actions stay thumb reachable and content stays one column. At 768 px, panels gain space without truncating content. At 1440 px, customer and driver maps use available width while admin tables keep an efficient reading width. Tables may scroll within their own region when content cannot fit; the page itself does not scroll sideways.

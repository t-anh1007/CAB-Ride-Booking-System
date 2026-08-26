# CAB unified UI design

## Goal

Replace the legacy runtime UI in Customer, Driver, and Admin with one visual system derived from the approved CAB reference board. The reference is the sole visual authority. Business APIs, authentication, providers, realtime contracts, and persisted data remain unchanged.

## Delivery order

1. Customer mobile: pickup map, destination selection, vehicle selection, driver search, ride tracking, payment, rating, history, wallet, and settings.
2. Driver mobile: availability dashboard, incoming request, pickup navigation, ride lifecycle, earnings, history, and profile.
3. Admin web: MFA login, operations KPI, live map, user and driver tables, ride summary, surge monitor, and audit log.

After a role passes browser QA, its entrypoint imports only the new router and visual primitives. The legacy router, pages, and styling are removed from that role's runtime path so users cannot land on a mixed UI.

## Visual system

- Canvas: `#F6F4EE`; dark primary/nav: `#10231D`; active/online: `#2CE6A6`.
- Semantic colors: blue for in-progress, yellow for warning, red `#F36C5B` for destructive and cancelled states.
- Inter/system sans typography, thin borders, restrained shadows, and a 4/8/12/16/24px radius scale.
- Customer and Driver are 390–430px mobile surfaces with map-first composition, floating bottom sheets, compact bottom navigation, green pickup pins, red destination pins, and black vehicle markers.
- Admin is a desktop operations surface: dark sidebar, white toolbar, horizontal KPI row, large live map, compact data tables, and status chips.
- Icon strokes, button variants, chips, spacing, and focus states are shared primitives. Status always has text in addition to color.

## Component architecture

Each app has three layers:

1. A role shell and reusable primitives: logo, navigation, buttons, chips, map overlays, KPI/table patterns, empty/loading/error states.
2. Feature screens that compose those primitives according to the approved role workflow.
3. Existing providers and services: auth, booking, ride, API client, GPS, and realtime stay behind their present interfaces.

The design work may add focused presentation components and route adapters, but it must not duplicate business state or fabricate API responses.

## Data, state, and failure behavior

- Loading is local to the region being fetched; selected state is retained during background refreshes.
- API errors remain actionable and visible without replacing useful content with a blank screen.
- Existing provider retry/reconnect behavior is retained. Realtime connection state is visible as a textual status chip.
- The UI does not invent operational values, maps, rides, forecasts, or write actions when the backend has no supporting endpoint.

## Browser acceptance criteria

For each role, verify the core workflow with the in-app browser at the current viewport and a 390px mobile viewport where applicable. Verify desktop Admin separately. Capture successful screens to `docs/screenshots`.

The final visual review compares the approved reference image and fresh implementation screenshots for at least: layout hierarchy, palette, typography, icon treatment, map treatment, spacing/radius, information density, and visible copy. Resolve implementation drift before handoff. No browser overflow, clipped primary content, placeholder UI, or legacy runtime route may remain.

## Scope boundaries

This work replaces presentation and runtime routing only. It does not redesign service contracts, migrate databases, deploy, or alter unrelated worktree changes. The temporary visual-companion files under `.superpowers/` are not product artifacts and must not be committed.

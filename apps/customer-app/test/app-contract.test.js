import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("customer feature contracts preserve the connected mobile workflow", async () => {
  const [app, router, auth, ...pages] = await Promise.all([
    read("../src/App.jsx"),
    read("../src/router.jsx"),
    read("../src/providers/AuthProvider.jsx"),
    ...[
      "../src/pages/OnboardingPage.jsx",
      "../src/pages/HomeMapPage.jsx",
      "../src/pages/DestinationPage.jsx",
      "../src/pages/RideOptionsPage.jsx",
      "../src/pages/RideTrackingPage.jsx",
      "../src/pages/HistoryPage.jsx",
      "../src/pages/ProfilePage.jsx"
    ].map(read)
  ]);
  const source = pages.join("\n").toLowerCase();

  for (const provider of ["AuthProvider", "BookingProvider", "RealtimeProvider"]) assert.ok(app.includes(provider), provider);
  for (const route of ["/login", "/home", "/destination", "/options", "/searching", "/tracking/:id", "/payment/:id", "/rating/:id", "/history", "/profile"]) assert.ok(router.includes(route), route);
  for (const key of ["cab.customer.session", "cab.customer.onboarding.complete", "cab.customer.recent.destinations", "cab.customer.saved-locations"]) assert.ok(`${auth}\n${source}`.includes(key), key);
  for (const token of ["navigator.geolocation", "reversegeocode", "expiresin", "refresh quote", "routepolyline", "driver.rating", "driver.plate", "driver.eta", "datefilter", "statusfilter", "/users/", "/wallet", "/preferences", "/saved-locations"]) assert.ok(source.includes(token), token);
  assert.ok(!source.includes("/modules/"), "connected pages must not import draft modules");
  assert.match(pages[4], /useEffect\s*\(\s*\(\)\s*=>[\s\S]*COMPLETED[\s\S]*nav\(/);
  assert.doesNotMatch(pages[4], /return\s+<[^>]+>[\s\S]*COMPLETED[\s\S]*nav\(/);
});

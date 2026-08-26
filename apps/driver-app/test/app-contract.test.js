import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("driver contracts preserve operational safety and canonical routes", async () => {
  const [app, router, auth, ...pages] = await Promise.all([
    read("../src/App.jsx"),
    read("../src/router.jsx"),
    read("../src/providers/AuthProvider.jsx"),
    ...["../src/pages/DriverHomePage.jsx", "../src/pages/IncomingRequestPage.jsx", "../src/pages/ActiveRidePage.jsx", "../src/pages/EarningsPage.jsx", "../src/pages/DriverHistoryPage.jsx"].map(read)
  ]);
  const source = pages.join("\n").toLowerCase();

  for (const provider of ["AuthProvider", "RealtimeProvider", "DriverRideProvider"]) assert.ok(app.includes(provider), provider);
  for (const route of ["/login", "/home", "/incoming", "/ride/:id", "/earnings", "/history", "/profile"]) assert.ok(router.includes(route), route);
  assert.ok(auth.includes("cab.driver.session"), "driver session key");
  for (const token of ["/location", "currentlocation", "watchposition", "5000", "pricesnapshot", "rideid", "realtime", "completed", "/cancel", "go-online", "go-offline", "pending", "error"]) assert.ok(source.includes(token), token);
  assert.ok(!source.includes("/modules/"), "connected pages must not import draft modules");
  assert.match(pages[0], /try\s*\{/);
  assert.match(pages[0], /catch\s*\(/);
  assert.match(pages[0], /busy=\{pending\}/);
});

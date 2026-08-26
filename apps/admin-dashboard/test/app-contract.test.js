import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("admin contracts preserve MFA, connected data, and canonical routes", async () => {
  const [app, router, auth, ...pages] = await Promise.all([
    read("../src/App.jsx"),
    read("../src/router.jsx"),
    read("../src/providers/AuthProvider.jsx"),
    ...["../src/pages/DashboardPage.jsx", "../src/pages/UsersPage.jsx", "../src/pages/DriversPage.jsx", "../src/pages/RidesPage.jsx", "../src/pages/LiveMapPage.jsx", "../src/pages/SurgeControlPage.jsx", "../src/pages/AuditLogPage.jsx"].map(read)
  ]);
  const source = pages.join("\n").toLowerCase();

  for (const provider of ["AuthProvider", "RealtimeProvider"]) assert.ok(app.includes(provider), provider);
  for (const route of ["/login", "/users", "/drivers", "/rides", "/map", "/surge", "/audit"]) assert.ok(router.includes(route), route);
  for (const token of ["cab.admin.session", "mfa_required", "challengeToken"]) assert.ok(auth.includes(token), token);
  for (const token of ["totalrides", "bystatus", "/drivers/available", ".drivers", "aggregate-only", "driver.location.updated", "new map", "latitude", "longitude"]) assert.ok(source.includes(token), token);
  assert.ok(!source.includes("/modules/"), "connected pages must not import draft modules");
  const users = pages[1];
  assert.match(users, /<input[^>]+value=/);
  assert.match(users, /onChange=/);
  assert.match(users, /rows\.filter/);
  assert.ok(!source.includes('client.get("/rides")'));
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { reverseGeocode, searchAddress } from "../src/geo/nominatim.js";
import { fetchRoute } from "../src/geo/osrm.js";

test("address search returns a local matching destination when Nominatim is unavailable", async () => {
  const rows = await searchAddress("Hồ Hoàn Kiếm", {
    fetchImpl: async () => {
      throw Error("offline");
    }
  });

  assert.ok(rows.some((row) => row.label.includes("Hồ Hoàn Kiếm")));
});

test("route lookup returns a positive local estimate when OSRM is unavailable", async () => {
  const route = await fetchRoute([10.7769, 106.7009], [10.772543, 106.698084], {
    fetchImpl: async () => {
      throw Error("offline");
    }
  });

  assert.equal(route.fallback, true);
  assert.ok(route.distanceKm > 0);
  assert.ok(route.durationMin > 0);
});

test("reverse geocode has a safe fallback and shared barrel declares its export", async () => {
  assert.equal(await reverseGeocode(10, 106, { fetchImpl: async () => { throw Error("offline"); } }), null);
  const barrel = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
  assert.ok(barrel.includes("reverseGeocode"));
  assert.ok(barrel.includes("./geo/nominatim.js"));
});

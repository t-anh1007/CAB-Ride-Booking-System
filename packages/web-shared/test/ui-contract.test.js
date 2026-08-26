import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("CAB shared UI exports accessible visual primitives", async () => {
  const [tokens, index, packageJson, surfaceState] = await Promise.all([
    read("src/ui/tokens.css"),
    read("src/index.js"),
    read("package.json"),
    read("src/ui/SurfaceState.jsx")
  ]);

  for (const token of ["--cab-canvas: #f6f4ee", "--cab-ink: #10231d", "--cab-active: #2ce6a6", "--cab-danger: #f36c5b", "--cab-radius-4", "--cab-radius-8", "--cab-radius-12", "--cab-radius-16", "--cab-radius-24", ":focus-visible", "prefers-reduced-motion"]) {
    assert.ok(tokens.includes(token), token);
  }
  for (const exported of ["CabButton", "StatusChip", "SurfaceState"]) {
    assert.ok(index.includes(exported), exported);
  }
  assert.ok(packageJson.includes('"./ui.css"'), "CSS subpath export");
  assert.ok(surfaceState.includes('detail.message'), "normalizes object-shaped gateway errors");
  assert.ok(!surfaceState.includes('{detail}</p>'), "does not render object errors as [object Object]");
});

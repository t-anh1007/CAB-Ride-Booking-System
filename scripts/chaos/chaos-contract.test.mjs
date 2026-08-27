import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("chaos scripts strictly assert repository-backed recovery behavior for 71 through 80", async () => {
  const [kill, kafka, runbook, loadReadme] = await Promise.all([source("./kill-service.ps1"), source("./kafka-outage.ps1"), source("./RUNBOOK.md"), source("../../tests/load/README.md")]);
  for (const token of ["ServiceName", "Jwt", "BookingBodyJson", "Authorization", "Idempotency-Key", "status -ne 201", "REQUESTED", "try", "finally", "docker stop", "docker start"]) assert.match(kill, new RegExp(token, "i"));
  for (const token of ["outbox_events", "ride.created", "cab_booking_booking", "Test-OutboxRecord", "Wait-OutboxRecord", "OutboxPollAttempts", "OutboxPollDelayMilliseconds", "CHAOS_BOOKING_ID", "process.env.CHAOS_BOOKING_ID", "PollAttempts", "Start-Sleep", "try", "finally", "docker stop", "docker start"]) assert.match(kafka, new RegExp(token, "i"));
  assert.match(kafka, /status -ne 201/i); assert.match(kafka, /REQUESTED/i); assert.match(kafka, /not \(Wait-OutboxRecord/); assert.match(kafka, /docker exec -e\s+["']?CHAOS_BOOKING_ID=/i); assert.doesNotMatch(kafka, /Test-RideDelivery/);
  for (const id of [71,72,73,74,75,77,78,79,80]) assert.match(runbook, new RegExp("\\b" + id + "\\b"));
  assert.match(runbook, /REQUESTED.*pending|pending.*REQUESTED/is); assert.match(runbook, /vehicleType.*car/i); assert.match(runbook, /KAFKA_ENABLED.*false/i); assert.match(runbook, /outbox/i); assert.match(loadReadme, /KAFKA_ENABLED.*false/i);
});

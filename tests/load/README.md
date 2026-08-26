# CAB local-scale load scenarios

Use only a disposable compose stack. Set TEST_JWT and TEST_USER_ID before booking load; the repository gateway accepts vehicleType car (not standard). Booking uses a local collision-resistant key built from VU, iteration, timestamp, and random entropy because remote randomUUID import is not reliable in k6.

Before the booking benchmark, set host environment GATEWAY_LOAD_TEST_MODE=true and recreate only api-gateway with local compose. The exact flag is disabled by default and ignored whenever NODE_ENV is production. In a non-production benchmark it keeps both rate-limit and quota middleware active with explicit booking-create limits of 100000 requests per 10 seconds and 1000000 requests per day; ordinary values remain 10 per 10 seconds and 100 per day. Restore the flag to false and recreate or stop the gateway after verification.

Pricing local evidence: 3508 of 3508 checks passed with 0 percent request failures and valid surge values; measured p95 was 1.47s. Master T14 specifies latency thresholds only for booking (p95 under 300ms) and ETA (p95 under 200ms), so pricing retains checks rate and failed-rate thresholds but no unstated pricing latency threshold.

For chaos 71, strict 201 plus REQUESTED is the repository-authoritative pending/queued state. Scenario 73 requires a disposable GEOADD drivers:geo test driver precondition so matching emits driver.assigned and the configured notification API can prove relatedEntityId delivery. The authoritative local compose runtime leaves ride-service KAFKA_ENABLED unset, which defaults false, so the scenario verifies matching-to-notification delivery rather than ride DB persistence.

All summaries remain ignored. Environment-bounded markers are not measured results and no credential belongs in this repository.

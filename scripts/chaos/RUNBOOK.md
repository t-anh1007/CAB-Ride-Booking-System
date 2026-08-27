# CAB chaos and recovery runbook

Run only on a disposable local compose stack. Scripts restore stopped containers in finally and exit non-zero on any failed assertion. Do not place JWTs in source control.

| Test | Executable scenario | Observable outcome |
|---|---|---|
| 71 | kill-service.ps1 -ServiceName driver-service -Jwt <customer-jwt> -BookingBodyJson <valid-car-booking-json> | Driver container is restored; booking returns HTTP 201, success true, and REQUESTED. REQUESTED is the repository-authoritative pending/queued state that reconciles the master wording PENDING. |
| 72 | Stop pricing service and request a quote through gateway. | Explicit bounded fallback, no fabricated fare. |
| 73 | Before running, GEOADD drivers:geo 106.7009 10.7769 chaos-driver-seed. Then kafka-outage.ps1 -Jwt <customer-jwt> -DriverSeedId chaos-driver-seed -BookingBodyJson <valid-car-booking-json>. | While Kafka is stopped, the exact booking has a ride.created outbox record. After restoration the same outbox record disappears and the matching driver.assigned chain produces a notification with relatedEntityId equal to booking id. The authoritative local compose runtime leaves ride-service KAFKA_ENABLED unset, which defaults false, so ride DB persistence is not a scenario gate. |
| 74 | Restart notification consumer after retained event. | No duplicate visible notification. |
| 75 | Send five deterministic upstream failures through gateway. | Circuit opens with bounded 503. |
| 76 | Restore upstream after reset timeout. | Circuit half-opens then closes. |
| 77 | Observe retry logs for unavailable upstream. | Backoff increases without tight loop. |
| 78 | Stop payment dependency during saga. | Compensation/outbox state prevents double charge. |
| 79 | Restart dependent datastore. | Readiness recovers after dependency. |
| 80 | Stop ETA, matching, AI insights while core remains healthy. | Booking uses explicit degraded behavior. |

Valid scenario 71/73 JSON must include userId, pickup, drop, and vehicleType car; accepted gateway values are bike, car, car_plus. The GEOADD precondition is a disposable test fixture and is intentionally not created by these scripts. Notification is verified through the configured authenticated gateway API rather than an invented endpoint.

param(
  [string]$KafkaContainer = "cab-kafka",
  [string]$MongoContainer = "cab-mongodb",
  [string]$RedisContainer = "cab-redis",
  [string]$GatewayUrl = "http://localhost:3000",
  [Parameter(Mandatory)][string]$Jwt,
  [Parameter(Mandatory)][string]$BookingBodyJson,
  [Parameter(Mandatory)][string]$DriverSeedId,
  [string]$BookingDatabase = "cab_booking_booking",
  [string]$NotificationPath = "/api/v1/notifications",
  [int]$PollAttempts = 18,
  [int]$PollDelaySeconds = 2,
  [int]$OutboxPollAttempts = 20,
  [int]$OutboxPollDelayMilliseconds = 250
)
$ErrorActionPreference = "Stop"
$wasRunning = $false
function Invoke-Booking { $response = Invoke-WebRequest -Uri ($GatewayUrl.TrimEnd("/") + "/api/v1/bookings") -Method Post -ContentType "application/json" -Headers @{ Authorization = "Bearer $Jwt"; "Idempotency-Key" = [guid]::NewGuid().ToString(); Accept = "application/json" } -Body $BookingBodyJson -UseBasicParsing; return [pscustomobject]@{ Status = [int]$response.StatusCode; Body = ($response.Content | ConvertFrom-Json) } }
function Test-OutboxRecord([string]$BookingId) { $result = docker exec -e "CHAOS_BOOKING_ID=$BookingId" $MongoContainer mongosh --quiet $BookingDatabase --eval "const id = process.env.CHAOS_BOOKING_ID; print(db.outbox_events.findOne({topic:'ride.created','payload.bookingId':id}) ? 'FOUND' : 'MISSING');"; if ($LASTEXITCODE -ne 0) { throw "Mongo query failed for $BookingDatabase" }; return [bool]($result -match "FOUND") }
function Wait-OutboxRecord([string]$BookingId) { for ($attempt = 1; $attempt -le $OutboxPollAttempts; $attempt++) { if (Test-OutboxRecord $BookingId) { return $true }; Start-Sleep -Milliseconds $OutboxPollDelayMilliseconds }; return $false }
function Test-NotificationDelivery([string]$BookingId, [string]$UserId) { $response = Invoke-WebRequest -Uri ($GatewayUrl.TrimEnd("/") + $NotificationPath + "?userId=" + [uri]::EscapeDataString($UserId) + "&limit=50") -Headers @{ Authorization = "Bearer $Jwt"; Accept = "application/json" } -UseBasicParsing; $body = $response.Content | ConvertFrom-Json; return $response.StatusCode -eq 200 -and $body.success -eq $true -and @($body.data | Where-Object { $_.relatedEntityId -eq $BookingId }).Count -gt 0 }
$payload = $BookingBodyJson | ConvertFrom-Json
if (-not $payload.userId -or -not $payload.pickup -or -not $payload.drop -or $payload.vehicleType -ne "car") { throw "BookingBodyJson must contain userId, pickup, drop, and vehicleType car." }
$geoRank = docker exec $RedisContainer redis-cli ZRANK drivers:geo $DriverSeedId
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($geoRank)) { throw "DriverSeedId must exist in Redis GEO key drivers:geo before scenario 73." }
$bookingId = $null
try {
  $state = docker inspect --format "{{.State.Running}}" $KafkaContainer 2>$null
  if ($LASTEXITCODE -ne 0 -or $state -ne "true") { throw "Expected running Kafka container $KafkaContainer before chaos." }
  $wasRunning = $true
  docker stop $KafkaContainer | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "docker stop failed for $KafkaContainer" }
  $outcome = Invoke-Booking
  if ($outcome.Status -ne 201 -or $outcome.Body.success -ne $true -or $outcome.Body.data.status -ne "REQUESTED" -or -not $outcome.Body.data.booking_id) { throw "Scenario 73 requires HTTP 201 with success, REQUESTED, and booking_id while Kafka is stopped." }
  $bookingId = [string]$outcome.Body.data.booking_id
  if (-not (Wait-OutboxRecord $bookingId)) { throw "ride.created outbox record for $bookingId was not retained during Kafka outage." }
  Write-Output "PASS retained ride.created outbox record for $bookingId while Kafka was stopped."
} finally {
  if ($wasRunning) { docker start $KafkaContainer | Out-Null; if ($LASTEXITCODE -ne 0) { throw "Failed to restore Kafka container" } }
}
$delivered = $false
for ($attempt = 1; $attempt -le $PollAttempts; $attempt++) {
  if (-not (Test-OutboxRecord $bookingId) -and (Test-NotificationDelivery $bookingId ([string]$payload.userId))) { $delivered = $true; break }
  Start-Sleep -Seconds $PollDelaySeconds
}
if (-not $delivered) { throw "ride.created for $bookingId did not flush through matching/driver.assigned to notification within polling budget." }
Write-Output "PASS outbox flushed and matching-to-notification delivery observed for $bookingId."

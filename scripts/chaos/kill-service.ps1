param(
  [Parameter(Mandatory)][ValidateSet("driver-service")][string]$ServiceName,
  [string]$GatewayUrl = "http://localhost:3000",
  [Parameter(Mandatory)][string]$Jwt,
  [Parameter(Mandatory)][string]$BookingBodyJson
)
$ErrorActionPreference = "Stop"
$container = "cab-$ServiceName"
$wasRunning = $false
function Invoke-BookingProbe {
  $response = Invoke-WebRequest -Uri ($GatewayUrl.TrimEnd("/") + "/api/v1/bookings") -Method Post -ContentType "application/json" -Headers @{ Authorization = "Bearer $Jwt"; "Idempotency-Key" = [guid]::NewGuid().ToString(); Accept = "application/json" } -Body $BookingBodyJson -UseBasicParsing
  return [pscustomobject]@{ Status = [int]$response.StatusCode; Body = ($response.Content | ConvertFrom-Json) }
}
$payload = $BookingBodyJson | ConvertFrom-Json
if (-not $payload.userId -or -not $payload.pickup -or -not $payload.drop -or $payload.vehicleType -ne "car") { throw "BookingBodyJson must contain userId, pickup, drop, and vehicleType car." }
try {
  $state = docker inspect --format "{{.State.Running}}" $container 2>$null
  if ($LASTEXITCODE -ne 0 -or $state -ne "true") { throw "Expected running container $container before chaos." }
  $wasRunning = $true
  docker stop $container | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "docker stop failed for $container" }
  $outcome = Invoke-BookingProbe
  if ($outcome.Status -ne 201 -or $outcome.Body.success -ne $true -or $outcome.Body.data.status -ne "REQUESTED") { throw "Scenario 71 requires HTTP 201 with success and REQUESTED pending state." }
  Write-Output "PASS driver outage preserved booking HTTP 201 REQUESTED."
} finally {
  if ($wasRunning) { docker start $container | Out-Null; if ($LASTEXITCODE -ne 0) { throw "Failed to restore $container" } }
}

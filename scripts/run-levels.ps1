<#
.SYNOPSIS
  Grading scoreboard. Runs the CAB master newman collection through the gateway
  and prints a pass/fail table per grading level (1..12).

.DESCRIPTION
  Single newman run so environment state (tokens, quoteId, bookingId) flows
  across Level folders. Parses the newman JSON report and tallies assertions per
  top-level folder ("Level N - ..."), then renders a board covering all 12
  levels -- levels without a folder yet show as "not built".

  This is the instrument the lean-closure plan is built around: run it, read the
  red, attack the cheapest red cell first, re-run.

.EXAMPLE
  pwsh scripts/run-levels.ps1
  pwsh scripts/run-levels.ps1 -Level 9        # only Level 9 folder
  pwsh scripts/run-levels.ps1 -Html           # also emit htmlextra report
#>
[CmdletBinding()]
param(
  [string]$CollectionPath = "$PSScriptRoot/postman/cab-levels.postman_collection.json",
  [string]$EnvironmentPath = "$PSScriptRoot/postman/cab-local.postman_environment.json",
  [string]$BaseUrl = "http://localhost:3000",
  [string]$Level = "",
  [switch]$Html,
  [switch]$SkipPreflight
)

$ErrorActionPreference = "Stop"

# Level catalogue -- name + grading TC range. `built` is derived at runtime from
# whether a matching "Level N - ..." folder produced executions.
# plain hashtable so integer indexing is BY KEY (an [ordered] dict indexes by position)
$catalogue = @{
  1  = "Basic API"
  2  = "Validation & Idempotency"
  3  = "Integration / Kafka"
  4  = "Transaction / Saga"
  5  = "AI validation"
  6  = "AI Agent + MCP"
  7  = "Performance / Load"
  8  = "Resilience"
  9  = "Security"
  10 = "Zero Trust"
  11 = "Deployment"
  12 = "Monitoring (deferred)"
}
$levelOrder = 1..12

if (-not (Test-Path $CollectionPath)) { throw "Collection not found: $CollectionPath" }
if (-not (Test-Path $EnvironmentPath)) { throw "Environment not found: $EnvironmentPath" }

# --- preflight: is the gateway up? (non-fatal -- a down gateway just paints red) ---
if (-not $SkipPreflight) {
  try {
    $null = Invoke-WebRequest -Uri "$BaseUrl/health" -TimeoutSec 4 -UseBasicParsing
    Write-Host "gateway reachable at $BaseUrl" -ForegroundColor DarkGreen
  } catch {
    Write-Host "WARNING: gateway not reachable at $BaseUrl -- every request will fail." -ForegroundColor Yellow
    Write-Host "  start it: docker compose -f infra/docker-compose/docker-compose.local.yml up -d api-gateway" -ForegroundColor DarkGray
  }
}

$jsonReport = Join-Path ([System.IO.Path]::GetTempPath()) "cab-levels-$(Get-Date -Format yyyyMMdd-HHmmss).json"

$reporters = "cli,json"
$newmanArgs = @(
  "run", $CollectionPath,
  "-e", $EnvironmentPath,
  "--env-var", "baseUrl=$BaseUrl",
  "--reporter-json-export", $jsonReport
)
if ($Level) {
  $folderName = ($catalogue[[int]$Level])
  $newmanArgs += @("--folder", "Level $Level - $folderName")
}
if ($Html) {
  $htmlOut = Join-Path $PSScriptRoot "newman-report.html"
  $newmanArgs += @("--reporter-htmlextra-export", $htmlOut)
  $reporters = "cli,json,htmlextra"
}
$newmanArgs += @("--reporters", $reporters)

# Resolve newman: prefer the locally installed bin (npx is unreliable on Windows).
$repoRoot = Split-Path $PSScriptRoot -Parent
$localNewman = Join-Path $repoRoot "node_modules/newman/bin/newman.js"
if (Test-Path $localNewman) {
  Write-Host "running: node newman/bin/newman.js $($newmanArgs -join ' ')" -ForegroundColor DarkGray
  & node $localNewman @newmanArgs
} else {
  Write-Host "running: npx newman $($newmanArgs -join ' ')" -ForegroundColor DarkGray
  & npx newman @newmanArgs
}
$newmanExit = $LASTEXITCODE

if (-not (Test-Path $jsonReport)) {
  throw "newman produced no JSON report (is newman installed? try: npm i -g newman). exit=$newmanExit"
}

$report = Get-Content $jsonReport -Raw | ConvertFrom-Json

# --- build request-id -> top-level-folder map from the exported collection tree ---
$idToFolder = @{}
function Walk-Items($items, $topFolder) {
  foreach ($it in $items) {
    if ($it.PSObject.Properties.Name -contains "item") {
      $next = if ($topFolder) { $topFolder } else { $it.name }
      Walk-Items $it.item $next
    } elseif ($it.id) {
      $idToFolder[$it.id] = $topFolder
    }
  }
}
Walk-Items $report.collection.item $null

# --- tally assertions per folder ---
$folderStats = @{}
foreach ($exec in $report.run.executions) {
  $folder = $idToFolder[$exec.item.id]
  if (-not $folder) { $folder = "(unfoldered)" }
  if (-not $folderStats.ContainsKey($folder)) { $folderStats[$folder] = @{ pass = 0; fail = 0 } }
  foreach ($a in @($exec.assertions)) {
    if ($a.error) { $folderStats[$folder].fail++ } else { $folderStats[$folder].pass++ }
  }
}

# --- render the board ---
Write-Host ""
Write-Host "================ GRADING SCOREBOARD ================" -ForegroundColor Cyan
$rows = foreach ($lvl in $levelOrder) {
  $name = $catalogue[$lvl]
  $match = $folderStats.Keys | Where-Object { $_ -match "^Level\s+$lvl\s*-" } | Select-Object -First 1
  if ($match) {
    $p = $folderStats[$match].pass; $f = $folderStats[$match].fail; $t = $p + $f
    $status = if ($f -eq 0 -and $t -gt 0) { "PASS" } elseif ($t -eq 0) { "empty" } else { "FAIL" }
    [pscustomobject]@{ Level = $lvl; Name = $name; Built = "yes"; Pass = "$p/$t"; Status = $status }
  } else {
    $note = if ($lvl -eq 12) { "deferred" } else { "not built" }
    [pscustomobject]@{ Level = $lvl; Name = $name; Built = "no"; Pass = "-"; Status = $note }
  }
}
$rows | Format-Table -AutoSize | Out-String | Write-Host

$totalPass = 0; $totalFail = 0
foreach ($v in $folderStats.Values) { $totalPass += $v.pass; $totalFail += $v.fail }
Write-Host ("assertions: {0} pass / {1} fail   (report: {2})" -f $totalPass, $totalFail, $jsonReport) -ForegroundColor Cyan
if ($Html) { Write-Host "html report: $htmlOut" -ForegroundColor DarkGray }

exit $newmanExit

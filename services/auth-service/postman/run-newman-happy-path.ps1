# Chains Newman folder runs with exported environment (matches auth-service-mvp-dry-run-checklist.md order).
# Requires: gateway up (e.g. docker), npx/newman on PATH.
$ErrorActionPreference = "Stop"
$Repo = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
Set-Location $Repo

$Coll = "services/auth-service/postman/auth-service-mvp.postman_collection.json"
$EnvBase = "services/auth-service/postman/auth-service-local.postman_environment.json"
$EnvRun = "services/auth-service/postman/_runtime-env.json"

Copy-Item -Force $EnvBase $EnvRun

function Invoke-Folder {
    param([string]$Name)
    Write-Host "==> $Name" -ForegroundColor Cyan
    npx --yes newman run $Coll -e $EnvRun --export-environment $EnvRun --folder $Name --delay-request 400
    if ($LASTEXITCODE -ne 0) { throw "Newman failed: $Name" }
    Start-Sleep -Seconds 2
}

Invoke-Folder "Health"
Invoke-Folder "Customer OTP"
Invoke-Folder "Refresh"
Invoke-Folder "OAuth2 aliases"
Invoke-Folder "Driver OTP"
Invoke-Folder "Authorization (RBAC / ABAC)"
Invoke-Folder "JWT"
if ($env:AUTH_POSTMAN_SKIP_ADMIN -eq "1") {
    Write-Host "Skipping Admin MFA (AUTH_POSTMAN_SKIP_ADMIN=1)" -ForegroundColor Yellow
} else {
    Invoke-Folder "Admin MFA"
}

Write-Host "Done. Runtime env: $EnvRun" -ForegroundColor Green

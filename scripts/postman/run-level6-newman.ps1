param(
    [string]$CollectionPath = ".\colllection.json",
    [string]$EnvironmentPath = ".\environment.json"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $CollectionPath)) {
    throw "Collection file not found: $CollectionPath"
}

if (-not (Test-Path $EnvironmentPath)) {
    throw "Environment file not found: $EnvironmentPath"
}

Write-Host "Running Level 6 requests via Newman..."
Write-Host "Collection : $CollectionPath"
Write-Host "Environment: $EnvironmentPath"

npx newman run $CollectionPath `
    -e $EnvironmentPath `
    --folder "Level 6 - AI Agent Logic (TC51-TC60)" `
    --reporters cli,htmlextra `
    --reporter-htmlextra-export ".\newman-level6-report.html"

Write-Host "Done. HTML report: .\newman-level6-report.html"

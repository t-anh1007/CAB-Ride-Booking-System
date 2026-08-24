param(
    [string]$EnvFile = 'infra/docker-swarm/.env',
    [string]$StackFile = 'infra/docker-swarm/docker-stack.yml'
)

if (-not (Test-Path $EnvFile)) {
    throw "Khong tim thay file env: $EnvFile"
}

$envLines = Get-Content $EnvFile | Where-Object { $_ -and -not $_.StartsWith('#') }
foreach ($line in $envLines) {
    $parts = $line -split '=', 2
    if ($parts.Count -eq 2) {
        [System.Environment]::SetEnvironmentVariable($parts[0], $parts[1])
    }
}

if (-not $env:STACK_NAME) {
    throw 'STACK_NAME chua duoc cau hinh trong file env.'
}

docker stack deploy --with-registry-auth -c $StackFile $env:STACK_NAME

if ($LASTEXITCODE -ne 0) {
    throw 'Deploy docker stack that bai.'
}

docker stack services $env:STACK_NAME

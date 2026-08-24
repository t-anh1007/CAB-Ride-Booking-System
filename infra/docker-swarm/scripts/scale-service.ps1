param(
    [Parameter(Mandatory = $true)]
    [string]$StackName,
    [Parameter(Mandatory = $true)]
    [string]$ServiceName,
    [Parameter(Mandatory = $true)]
    [int]$Replicas
)

$qualifiedService = "$StackName" + '_' + "$ServiceName"
docker service scale "$qualifiedService=$Replicas"

if ($LASTEXITCODE -ne 0) {
    throw "Scale service that bai: $qualifiedService"
}

docker service ls --filter "name=$qualifiedService"

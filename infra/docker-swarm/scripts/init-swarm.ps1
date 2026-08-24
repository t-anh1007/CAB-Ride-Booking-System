param(
    [Parameter(Mandatory = $true)]
    [string]$AdvertiseAddress
)

$swarmState = docker info --format '{{.Swarm.LocalNodeState}}' 2>$null

if ($swarmState -eq 'active') {
    Write-Host 'Docker Swarm da duoc khoi tao tren node nay.'
    exit 0
}

docker swarm init --advertise-addr $AdvertiseAddress

if ($LASTEXITCODE -ne 0) {
    throw 'Khong the khoi tao Docker Swarm.'
}

$managerName = docker info --format '{{.Name}}'
docker node update --label-add tier=edge --label-add region=primary $managerName | Out-Null

Write-Host ''
Write-Host 'Worker join token:'
docker swarm join-token worker -q
Write-Host ''
Write-Host 'Manager join token:'
docker swarm join-token manager -q
Write-Host ''
Write-Host 'Node hien tai da duoc gan label: tier=edge, region=primary'
Write-Host 'Sau khi worker join cluster, dung script label-nodes.ps1 de gan tier va region.'

param(
    [string]$EdgeNode = 'swarm-manager-1',
    [string[]]$PrimaryAppNodes = @('swarm-worker-app-1'),
    [string[]]$SecondaryAppNodes = @('swarm-worker-app-2'),
    [string[]]$DataNodes = @('swarm-worker-data-1')
)

docker node update --label-rm tier --label-rm region $EdgeNode 2>$null | Out-Null
docker node update --label-add tier=edge --label-add region=primary $EdgeNode | Out-Null

foreach ($node in $PrimaryAppNodes) {
    docker node update --label-rm tier --label-rm region $node 2>$null | Out-Null
    docker node update --label-add tier=app --label-add region=primary $node | Out-Null
}

foreach ($node in $SecondaryAppNodes) {
    docker node update --label-rm tier --label-rm region $node 2>$null | Out-Null
    docker node update --label-add tier=app --label-add region=secondary $node | Out-Null
}

foreach ($node in $DataNodes) {
    docker node update --label-rm tier --label-rm region $node 2>$null | Out-Null
    docker node update --label-add tier=data --label-add region=primary $node | Out-Null
}

Write-Host 'Da gan label node cho topology Docker Swarm.'
docker node ls

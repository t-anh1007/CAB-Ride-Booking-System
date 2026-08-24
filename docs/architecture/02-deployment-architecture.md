# CAB Booking System - Deployment Architecture

## Pham vi

Phan nay duoc dong bo voi kien truc da dung trong `infra/docker-swarm`, khong con theo mo hinh Kubernetes.

## Kien truc trien khai da dung

He thong duoc chot theo `Docker Swarm on VirtualBox` voi topology:

- `swarm-manager-1`: `tier=edge`, `region=primary`
- `swarm-worker-app-1`: `tier=app`, `region=primary`
- `swarm-worker-app-2`: `tier=app`, `region=secondary`
- `swarm-worker-data-1`: `tier=data`, `region=primary`

## Thanh phan da duoc dung thanh artifact

- Stack deploy: `infra/docker-swarm/docker-stack.yml`
- Cluster init: `infra/docker-swarm/scripts/init-swarm.ps1`
- Node labeling: `infra/docker-swarm/scripts/label-nodes.ps1`
- Stack deploy script: `infra/docker-swarm/scripts/deploy-stack.ps1`
- Scale script: `infra/docker-swarm/scripts/scale-service.ps1`
- GitHub deploy workflow: `.github/workflows/deploy-swarm.yml`
- Deployment topology diagram: `infra/docker-swarm/swarm-architecture.mmd`

## Tang trien khai

### Edge tier

- `admin-dashboard`
- `customer-app`
- `driver-app`
- `api-gateway`

Tat ca edge workload duoc dat len node co label `tier=edge`.

### App tier

Toan bo 9 microservice duoc dat len node co label `tier=app`:

- `pricing-service`
- `payment-service`
- `booking-service`
- `auth-service`
- `user-service`
- `review-service`
- `driver-service`
- `notification-service`
- `ride-service`

Swarm duoc cau hinh `spread: node.labels.region` de phan bo replica qua `primary` va `secondary`.

### Data tier

- `kafka`
- `postgres`
- `mongodb`
- `redis`

Toan bo data workload duoc dat len node co label `tier=data`.

## Mang overlay da dung

- `edge-net`
- `backend-net`
- `broker-net`
- `data-net`

## Replica model da dung

- `api-gateway`: scale theo `API_GATEWAY_REPLICAS`
- Cac microservice app: scale theo `APP_SERVICE_REPLICAS`
- Frontend app: scale theo tung bien replica rieng
- Kafka, PostgreSQL, MongoDB, Redis: mac dinh 1 replica

## Ghi chu

Phan nay chi ton tai de tai lieu hoa kien truc da dung. Nguon su that cho deployment o repo nay la cac artifact trong `infra/docker-swarm`.

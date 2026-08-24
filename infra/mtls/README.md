# Dev mTLS for internal services

This directory holds the optional development-only mTLS overlay for internal HTTP traffic.

## What it covers

- `api-gateway -> auth/user/booking/payment/review/driver/ride/pricing`
- `auth-service -> user-service/driver-service/notification-service`
- `notification-service -> api-gateway` for realtime publish
- `ride-service -> eta-service`

Public client traffic remains unchanged. The mTLS overlay only hardens service-to-service HTTP.

## Generate certificates

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\infra\mtls\generate-dev-certificates.ps1
```

Generated material will be written to:

```text
infra/mtls/dev-certs/
```

The folder is ignored by Git.

## Enable on Docker Compose

```powershell
docker compose `
  -f infra/docker-compose/docker-compose.local.yml `
  -f infra/docker-compose/docker-compose.mtls.yml `
  up -d --build
```

## Enable on Docker Swarm

```powershell
docker stack deploy `
  -c infra/docker-swarm/docker-stack.yml `
  -c infra/docker-swarm/docker-stack.secrets.yml `
  -c infra/docker-swarm/docker-stack.mtls.yml `
  cab-booking
```

## Certificate identities

Each service certificate uses the service name as its common name and DNS SAN. Example:

- `api-gateway`
- `auth-service`
- `booking-service`
- `payment-service`
- `user-service`
- `review-service`
- `driver-service`
- `notification-service`
- `ride-service`
- `eta-service`
- `pricing-service`

The same certificate is reused for both server-side mTLS and client-side service identity for that service.

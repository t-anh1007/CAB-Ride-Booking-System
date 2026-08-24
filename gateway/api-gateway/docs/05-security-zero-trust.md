# Security (Zero Trust)

## 1. Nguyên tắc
- Never trust, always verify
- Zero Trust end-to-end

## 2. Authentication

- JWT / OAuth2
- Access token + Refresh token
- Validate qua Auth Service

## 3. Authorization

### RBAC
- Customer
- Driver
- Admin

### ABAC
- Context-based:
  - location
  - ride status

## 4. Gateway Security Responsibilities

- Validate JWT
- Check scope / role
- Block invalid request
- Schema validation

## 5. Service-to-Service

- mTLS
- Service identity

## 6. Threat Protection

| Threat | Mitigation |
|-------|----------|
| Token leak | Token revoke |
| DDoS | Rate limit |
| Injection | WAF |

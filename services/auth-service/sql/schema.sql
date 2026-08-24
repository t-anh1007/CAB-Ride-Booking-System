CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS auth_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID UNIQUE DEFAULT uuid_generate_v4(),
  destination VARCHAR NOT NULL,
  destination_type VARCHAR NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'active',
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(destination, destination_type)
);

CREATE TABLE IF NOT EXISTS account_roles (
  account_id UUID NOT NULL REFERENCES auth_accounts(id) ON DELETE CASCADE,
  role VARCHAR NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, role)
);

CREATE TABLE IF NOT EXISTS auth_permissions (
  permission VARCHAR PRIMARY KEY,
  kind VARCHAR NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role VARCHAR NOT NULL,
  permission VARCHAR NOT NULL REFERENCES auth_permissions(permission) ON DELETE CASCADE,
  PRIMARY KEY (role, permission)
);

CREATE TABLE IF NOT EXISTS user_credentials (
  account_id UUID PRIMARY KEY REFERENCES auth_accounts(id) ON DELETE CASCADE,
  password_hash VARCHAR NOT NULL,
  display_name VARCHAR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_credentials (
  account_id UUID PRIMARY KEY REFERENCES auth_accounts(id) ON DELETE CASCADE,
  password_hash VARCHAR NOT NULL,
  password_updated_at TIMESTAMPTZ,
  mfa_required BOOLEAN NOT NULL DEFAULT TRUE,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES auth_accounts(id) ON DELETE CASCADE,
  device_id VARCHAR,
  user_agent VARCHAR,
  ip_address VARCHAR,
  status VARCHAR NOT NULL DEFAULT 'active',
  revoked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_token_families (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES auth_accounts(id) ON DELETE CASCADE,
  session_id UUID REFERENCES auth_sessions(id) ON DELETE SET NULL,
  status VARCHAR NOT NULL DEFAULT 'active',
  revoked_reason VARCHAR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID NOT NULL REFERENCES refresh_token_families(id) ON DELETE CASCADE,
  session_id UUID REFERENCES auth_sessions(id) ON DELETE SET NULL,
  token_hash VARCHAR NOT NULL UNIQUE,
  parent_token_id UUID REFERENCES refresh_tokens(id) ON DELETE SET NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  metadata JSONB
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID,
  session_id UUID,
  event_type VARCHAR NOT NULL,
  event_status VARCHAR NOT NULL,
  request_id VARCHAR,
  correlation_id VARCHAR,
  actor_role VARCHAR,
  ip_address VARCHAR,
  user_agent VARCHAR,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mfa_enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES auth_accounts(id) ON DELETE CASCADE,
  method VARCHAR NOT NULL,
  secret_encrypted VARCHAR NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mfa_recovery_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enrollment_id UUID NOT NULL REFERENCES mfa_enrollments(id) ON DELETE CASCADE,
  code_hash VARCHAR NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(enrollment_id, code_hash)
);

-- Seed basic role permissions for RBAC testing
INSERT INTO auth_permissions (permission, kind) VALUES
('ride:read', 'permission'),
('ride:write', 'permission'),
('location:update:assigned', 'action'),
('admin:all', 'scope')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role, permission) VALUES
('customer', 'ride:read'),
('customer', 'ride:write'),
('driver', 'ride:read'),
('driver', 'ride:write'),
('driver', 'location:update:assigned'),
('admin', 'admin:all')
ON CONFLICT DO NOTHING;

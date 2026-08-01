# 45 — Auth-Server Shore-Parity Upgrade

## Overview

Port security hardening, RBAC/permissions/features, Microsoft Entra ID IdP, and email/invite user management from the `data_cloud` auth-server into the `claims-manager` auth-server while preserving the existing tenancy model.

## Scope

**Ported from data_cloud:**
- Security hardening (56 F-* findings: CSP nonces, body limits, cookie signing, audience enforcement, Redis encryption)
- RBAC: roles, permissions, and feature flags as JWT claims (`extraTokenClaims` enhancement)
- Admin APIs for roles/permissions/features/user-invite
- Microsoft Entra ID login (OAuth 2.0 authorization code flow)
- Pluggable email service (console/SMTP/Resend) with invite + password-reset React templates
- User invitation lifecycle (invite, accept, OAuth auto-link)

**Retained as-is:**
- `organizations` + `organization_users` tenancy model (no networks/accounts/services)
- EnsureOS branding views (`AuthLeftPanel`, `Wordmark`)
- `@morezero/telemetry` package

**Excluded:**
- Rich tenancy schema (networks, accounts, services, service_clients)
- Invocation grants, federation peers, workers, partners, external-connect

## Phases

| Phase | Description | Schema Changes | New Deps |
|-------|-------------|----------------|----------|
| 1 | Security hardening | None | None (crypto built-in) |
| 2 | RBAC core | `roles`, `permissions`, `role_permissions`, `user_role_assignments`, `features`, `feature_grants` | None |
| 3 | Admin APIs | None | None |
| 4 | Email service | None | `nodemailer`, `resend` |
| 5 | User invitations | None | None |
| 6 | Microsoft login | None | None (axios already present) |
| 7 | Cleanup | None | None |

## New Database Tables

```sql
-- RBAC
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name TEXT NOT NULL UNIQUE,
  scope TEXT NOT NULL DEFAULT 'org',
  label TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_default BOOLEAN NOT NULL DEFAULT false,
  default_for_event TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'domain',
  resource_group TEXT,
  scope TEXT NOT NULL DEFAULT 'all',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (role_id, permission_id)
);

CREATE TABLE user_role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  UNIQUE (user_id, organization_id, role_name)
);

-- Features
CREATE TABLE features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key TEXT NOT NULL UNIQUE,
  default_enabled BOOLEAN NOT NULL DEFAULT false,
  label TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE feature_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id UUID NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  scope_id UUID NOT NULL,
  enabled BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (feature_id, scope, scope_id)
);
```

## New Admin API Endpoints

| Method | Path | Permission Required |
|--------|------|---------------------|
| GET | /admin/permissions | org.roles.read |
| POST | /admin/permissions | platform.permissions.manage |
| PATCH | /admin/permissions/:id | platform.permissions.manage |
| DELETE | /admin/permissions/:id | platform.permissions.manage |
| GET | /admin/roles | org.roles.read |
| POST | /admin/roles | {scope}.roles.create |
| PATCH | /admin/roles/:id | {scope}.roles.update |
| DELETE | /admin/roles/:id | {scope}.roles.delete |
| GET | /admin/roles/:id/permissions | org.roles.read |
| PUT | /admin/roles/:id/permissions | {scope}.roles.update |
| PUT | /admin/users/:userId/roles | org.users.manage |
| GET | /admin/users/:userId/roles | org.roles.read |
| POST | /admin/users/invite | org.users.manage |
| GET | /admin/features | features.manage |
| POST | /admin/features | features.manage |
| PATCH | /admin/features/:id | features.manage |
| DELETE | /admin/features/:id | features.manage |
| GET | /admin/features/grants | features.manage |
| PUT | /admin/features/:id/grants | features.manage |
| DELETE | /admin/features/:id/grants/:grantId | features.manage |
| GET | /admin/features/resolve | features.manage |

## New Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| JWT_EXPECTED_AUDIENCE | Prod only | — | Comma-separated audience values for JWT validation |
| REDIS_ENCRYPTION_KEY | Prod only | — | 32-byte hex key for at-rest token encryption |
| AUTH_INTERNAL_JWKS_URL | No | loopback | Override JWKS URL for self-verification |
| MICROSOFT_CLIENT_ID | No | — | MS Entra app registration client ID |
| MICROSOFT_CLIENT_SECRET | No | — | MS Entra app registration client secret |
| MICROSOFT_TENANT_ID | No | common | MS Entra tenant (or 'common' for multi-tenant) |
| EMAIL_PROVIDER | No | console | Email provider: console, smtp, resend |
| EMAIL_FROM | No | noreply@ensureos.com | From address for transactional emails |
| EMAIL_REPLY_TO | No | — | Reply-to address |
| RESEND_API_KEY | No | — | Resend API key (when EMAIL_PROVIDER=resend) |
| SMTP_HOST | No | localhost | SMTP host (when EMAIL_PROVIDER=smtp) |
| SMTP_PORT | No | 1025 | SMTP port |
| SMTP_SECURE | No | false | Use TLS for SMTP |
| SMTP_USER | No | — | SMTP auth username |
| SMTP_PASS | No | — | SMTP auth password |

## JWT Token Claims (Enhanced)

After this upgrade, AccessTokens minted for authenticated users will contain:

```json
{
  "sub": "<user-id>",
  "organization_id": "<org-id>",
  "org_roles": ["admin", "member"],
  "permissions": ["org.users.manage", "org.roles.read", "features.manage"],
  "features": ["advanced_reporting", "api_access"]
}
```

## File Inventory (New Files)

```
src/utils/redis-encryption.ts
src/middleware/http-tracing.ts
src/services/role-assignment-service.ts
src/services/feature-resolution-service.ts
src/services/invitation-service.ts
src/services/invited-user-auto-link.ts
src/services/email/types.ts
src/services/email/console-provider.ts
src/services/email/smtp-provider.ts
src/services/email/resend-provider.ts
src/services/email/templates/render-email.tsx
src/services/email/templates/InviteEmail.tsx
src/services/email/templates/PasswordResetEmail.tsx
src/services/email/index.ts
src/db/services/role-definitions.service.ts
src/db/services/user-role-assignments.ts
src/db/services/feature-definitions.service.ts
src/routes/admin-permission-routes.ts
src/routes/admin-role-routes.ts
src/routes/admin-feature-routes.ts
src/routes/admin-user-routes.ts
src/routes/microsoft-routes.ts
src/views/AcceptInvitePage.tsx
src/views/LinkAccountPage.tsx
src/scripts/seed-rbac.ts
```

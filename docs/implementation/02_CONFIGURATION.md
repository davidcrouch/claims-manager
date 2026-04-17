# 02 — Configuration & Environment

## Objective

Centralize all configuration using `@nestjs/config` with validation, typed access, and environment-specific overrides.

> **Hard rule — provider connection info is NEVER sourced from env.**
>
> All provider (Crunchwork, etc.) connection details — `client_id`, `client_secret`,
> `auth_url`, `base_url`, `hmac_key`, `provider_tenant_id`, `client_identifier` —
> live in the `integration_connections` table and are managed via the Providers UI
> (`/providers`). The API runtime, services, interceptors, and webhook handlers
> resolve a connection by `tenant_id` + `provider` (or by inbound webhook's
> `provider_tenant_id` + `client` identifier) and read values directly from the DB.
>
> Env is reserved for infrastructure (database URL, auth issuer, encryption key,
> feature flags). Adding a new `PROVIDER_*` / `CRUNCHWORK_*` env var is a rule
> violation.

---

## Steps

### 2.1 Environment Variables

Create `apps/api/.env.example`:

```env
# Server
PORT=3001
NODE_ENV=development
API_PREFIX=api/v1

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/claims_manager

# Encryption key for credentials stored in DB (AES-256-GCM, 32 bytes base64url)
CREDENTIALS_ENCRYPTION_KEY=<base64url-encoded-32-byte-key>

# Auth (Project Auth Server)
AUTH_ISSUER_URL=https://auth.example.com
AUTH_AUDIENCE=claims-manager-api
AUTH_JWKS_URI=https://auth.example.com/.well-known/jwks.json

# Logging
LOG_LEVEL=debug
```

Provider connection values (Crunchwork, etc.) are provisioned via the UI and
stored in `integration_connections` — they do **not** appear in `.env`.

### 2.2 Configuration Namespaces

Create typed config factories:

#### `src/config/app.config.ts`
- `port`, `nodeEnv`, `apiPrefix`

#### `src/config/database.config.ts`
- `databaseUrl`, parsed into `host`, `port`, `username`, `password`, `database`

#### `src/config/auth.config.ts`
- `issuerUrl`, `audience`, `jwksUri`

There is no `crunchwork.config.ts` — per the hard rule above, provider values
are not loaded from env.

### 2.3 Validation Schema

Use `class-validator` to validate required env vars at startup:

```typescript
// src/config/env.validation.ts
import { plainToInstance, Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString, validateSync } from 'class-validator';

export class EnvironmentVariables {
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  PORT?: number;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;
}

export function validate(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: true });
  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validated;
}
```

### 2.4 ConfigModule Registration

```typescript
// app.module.ts
ConfigModule.forRoot({
  isGlobal: true,
  load: [appConfig, databaseConfig, authConfig, more0Config, webhookConfig],
  validate,
  envFilePath: '.env',
})
```

### 2.5 Provider connection resolution at runtime

Services resolve a connection via `ConnectionResolverService`:

```typescript
const tenantId = this.tenantContext.getTenantId();
const connection = await this.connectionResolver.resolveForTenant({ tenantId });
// connection.id, connection.baseUrl, connection.authUrl, connection.providerTenantId
```

Inbound webhooks resolve via `providerTenantId` + `clientIdentifier` from the
payload. See `apps/api/src/modules/webhooks/webhooks.service.ts` and
`apps/api/src/modules/external/connection-resolver.service.ts`.

---

## Acceptance Criteria

- [ ] App fails to start with clear error if required env vars are missing
- [ ] Each config namespace is injectable with typed access
- [ ] `.env.example` documents all variables
- [ ] No secrets in committed files
- [ ] No `PROVIDER_*` / `CRUNCHWORK_*` env vars referenced anywhere in `apps/api/src/`

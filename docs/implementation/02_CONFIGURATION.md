# 02 — Configuration & Environment

## Objective

Centralize all configuration using `@nestjs/config` with validation, typed access, and environment-specific overrides.

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

# Crunchwork External API
CRUNCHWORK_AUTH_URL=https://staging-iag.crunchwork.com/auth/token?grant_type=client_credentials
CRUNCHWORK_BASE_URL=https://staging-iag.crunchwork.com/rest/insurance-rest
CRUNCHWORK_CLIENT_ID=<client_id>
CRUNCHWORK_CLIENT_SECRET=<client_secret>
CRUNCHWORK_HMAC_KEY=<hmac_secret>

# Tenant IDs (default tenants)
CRUNCHWORK_INSURE_TENANT_ID=<uuid>
CRUNCHWORK_VENDOR_TENANT_ID=<uuid>

# Auth (Project Auth Server)
AUTH_ISSUER_URL=https://auth.example.com
AUTH_AUDIENCE=claims-manager-api
AUTH_JWKS_URI=https://auth.example.com/.well-known/jwks.json

# Logging
LOG_LEVEL=debug
```

### 2.2 Configuration Namespaces

Create typed config factories:

#### `src/config/app.config.ts`
- `port`, `nodeEnv`, `apiPrefix`

#### `src/config/database.config.ts`
- `databaseUrl`, parsed into `host`, `port`, `username`, `password`, `database`

#### `src/config/crunchwork.config.ts`
- `authUrl`, `baseUrl`, `clientId`, `clientSecret`, `hmacKey`
- `insureTenantId`, `vendorTenantId`

#### `src/config/auth.config.ts`
- `issuerUrl`, `audience`, `jwksUri`

### 2.3 Validation Schema

Use `class-validator` or `Joi` to validate required env vars at startup:

```typescript
// src/config/env.validation.ts
import { plainToInstance, Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsString, IsUrl, validateSync } from 'class-validator';

export class EnvironmentVariables {
  @IsNumber()
  @Type(() => Number)
  PORT: number;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @IsUrl()
  CRUNCHWORK_AUTH_URL: string;

  @IsUrl()
  CRUNCHWORK_BASE_URL: string;

  @IsString()
  @IsNotEmpty()
  CRUNCHWORK_CLIENT_ID: string;

  @IsString()
  @IsNotEmpty()
  CRUNCHWORK_CLIENT_SECRET: string;

  @IsString()
  @IsNotEmpty()
  CRUNCHWORK_HMAC_KEY: string;
}

export function validate(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
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
  load: [appConfig, databaseConfig, crunchworkConfig, authConfig],
  validate,
  envFilePath: '.env',
})
```

### 2.5 Typed Config Access Pattern

Each config namespace exports a `registerAs` factory:

```typescript
// src/config/crunchwork.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('crunchwork', () => ({
  authUrl: process.env.CRUNCHWORK_AUTH_URL,
  baseUrl: process.env.CRUNCHWORK_BASE_URL,
  clientId: process.env.CRUNCHWORK_CLIENT_ID,
  clientSecret: process.env.CRUNCHWORK_CLIENT_SECRET,
  hmacKey: process.env.CRUNCHWORK_HMAC_KEY,
  insureTenantId: process.env.CRUNCHWORK_INSURE_TENANT_ID,
  vendorTenantId: process.env.CRUNCHWORK_VENDOR_TENANT_ID,
}));
```

Services inject via `@Inject(crunchworkConfig.KEY)`.

---

## Acceptance Criteria

- [ ] App fails to start with clear error if required env vars are missing
- [ ] Each config namespace is injectable with typed access
- [ ] `.env.example` documents all variables
- [ ] No secrets in committed files

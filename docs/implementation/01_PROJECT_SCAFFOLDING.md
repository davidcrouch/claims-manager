# 01 — Project Scaffolding

## Objective

Set up the NestJS application within the existing pnpm monorepo at `apps/api`, install all core dependencies, and wire it into the workspace build/dev scripts.

---

## Steps

### 1.1 Generate NestJS App

```bash
cd c:\repos\claims-manager
pnpm add -D @nestjs/cli -w
npx @nestjs/cli new apps/api --package-manager pnpm --skip-git --strict
```

If the CLI prompts conflict with the monorepo, scaffold manually:

- Create `apps/api/` directory
- Create `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/tsconfig.build.json`
- Create `apps/api/nest-cli.json`
- Create `apps/api/src/main.ts`, `apps/api/src/app.module.ts`

### 1.2 Core Dependencies

```bash
cd apps/api
pnpm add @nestjs/common @nestjs/core @nestjs/platform-express
pnpm add @nestjs/config @nestjs/typeorm typeorm pg
pnpm add @nestjs/axios axios
pnpm add @nestjs/passport passport passport-jwt
pnpm add @nestjs/swagger swagger-ui-express
pnpm add class-validator class-transformer
pnpm add rxjs reflect-metadata
pnpm add uuid
pnpm add helmet
pnpm add @nestjs/throttler
```

### 1.3 Dev Dependencies

```bash
pnpm add -D @nestjs/cli @nestjs/schematics @nestjs/testing
pnpm add -D typescript @types/node @types/express
pnpm add -D ts-node tsconfig-paths
pnpm add -D @types/passport-jwt
pnpm add -D jest @types/jest ts-jest
pnpm add -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
pnpm add -D prettier
```

### 1.4 Monorepo Integration

Update root `package.json` scripts:

```json
{
  "scripts": {
    "dev": "pnpm --filter frontend dev",
    "dev:api": "pnpm --filter api dev",
    "dev:all": "pnpm -r --parallel dev",
    "build": "pnpm -r build",
    "build:api": "pnpm --filter api build",
    "lint": "pnpm -r lint"
  }
}
```

Verify `pnpm-workspace.yaml` already includes `apps/*`.

### 1.5 API `package.json` Scripts

```json
{
  "name": "api",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "nest start --watch",
    "build": "nest build",
    "start": "node dist/main.js",
    "start:debug": "nest start --debug --watch",
    "lint": "eslint \"{src,test}/**/*.ts\"",
    "test": "jest",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "typeorm": "ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli.js",
    "migration:generate": "pnpm typeorm migration:generate -d src/database/data-source.ts",
    "migration:run": "pnpm typeorm migration:run -d src/database/data-source.ts",
    "migration:revert": "pnpm typeorm migration:revert -d src/database/data-source.ts"
  }
}
```

### 1.6 Project Structure

```
apps/api/
├── nest-cli.json
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── .env                          # local env (git-ignored)
├── src/
│   ├── main.ts                   # bootstrap
│   ├── app.module.ts             # root module
│   ├── common/                   # shared utilities
│   │   ├── decorators/           # custom decorators (Tenant, CurrentUser)
│   │   ├── filters/              # exception filters
│   │   ├── guards/               # auth guards
│   │   ├── interceptors/         # logging, transform interceptors
│   │   ├── interfaces/           # shared interfaces/types
│   │   ├── pipes/                # validation pipes
│   │   └── utils/                # helper functions
│   ├── config/                   # configuration module
│   ├── database/                 # TypeORM config, data-source, migrations
│   │   ├── data-source.ts
│   │   ├── entities/
│   │   └── migrations/
│   ├── auth/                     # OAuth2 / JWT guard module
│   ├── tenant/                   # multi-tenancy module
│   ├── crunchwork/               # external API client module
│   ├── modules/                  # feature modules
│   │   ├── claims/
│   │   ├── jobs/
│   │   ├── quotes/
│   │   ├── purchase-orders/
│   │   ├── invoices/
│   │   ├── messages/
│   │   ├── tasks/
│   │   ├── appointments/
│   │   ├── reports/
│   │   ├── attachments/
│   │   ├── vendors/
│   │   ├── contacts/
│   │   ├── lookups/
│   │   ├── webhooks/
│   │   └── dashboard/
│   └── health/                   # health check endpoint
└── test/
    ├── app.e2e-spec.ts
    └── jest-e2e.json
```

### 1.7 Bootstrap (`main.ts`)

Key setup in `main.ts`:

- Global validation pipe (`class-validator`)
- Global prefix `/api/v1`
- Swagger setup at `/api/docs`
- Helmet middleware
- CORS configuration
- Rate limiting via `@nestjs/throttler`
- Listen on configurable port (default 3001)

### 1.8 `app.module.ts`

Root module imports:

- `ConfigModule.forRoot()` — global config
- `TypeOrmModule.forRootAsync()` — database
- `ThrottlerModule.forRoot()` — rate limiting
- `AuthModule` — JWT/OAuth2
- `TenantModule` — multi-tenancy
- `CrunchworkModule` — external API client
- All feature modules
- `HealthModule`

---

## Acceptance Criteria

- [ ] `pnpm dev:api` starts NestJS in watch mode on port 3001
- [ ] `GET /api/v1/health` returns `{ status: 'ok' }`
- [ ] Swagger UI accessible at `/api/docs`
- [ ] TypeORM connects to PostgreSQL (or fails gracefully with log)
- [ ] ESLint and Prettier configured
- [ ] All monorepo scripts work (`dev:all`, `build`, `lint`)

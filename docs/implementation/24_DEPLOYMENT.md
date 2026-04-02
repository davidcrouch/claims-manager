# 24 — Deployment & CI/CD

## Objective

Define the deployment strategy for the NestJS API server, including Docker containerization, environment-specific configuration, and CI/CD pipeline.

---

## Steps

### 24.1 Docker Setup

#### Dockerfile

```dockerfile
# apps/api/Dockerfile
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile --filter api

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY . .
RUN pnpm --filter api build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/node_modules ./node_modules
COPY --from=builder /app/apps/api/package.json ./

EXPOSE 3001
CMD ["node", "dist/main.js"]
```

#### docker-compose.yml (development)

```yaml
version: '3.8'
services:
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    ports:
      - "3001:3001"
    env_file:
      - apps/api/.env
    depends_on:
      - postgres

  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: claims_manager
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

### 24.2 Environment Configuration

| Variable | Development | Staging | Production |
|----------|-------------|---------|------------|
| `NODE_ENV` | `development` | `staging` | `production` |
| `PORT` | `3001` | `3001` | `3001` |
| `DATABASE_URL` | Local PG | Supabase staging | Supabase production |
| `CRUNCHWORK_BASE_URL` | staging-* | staging-* | production |
| `LOG_LEVEL` | `debug` | `info` | `warn` |

### 24.3 Migration Strategy

Migrations should run automatically on deployment:

```bash
# In deployment pipeline or container entrypoint
pnpm typeorm migration:run -d dist/database/data-source.js
```

Or use a startup hook in `main.ts`:

```typescript
if (process.env.RUN_MIGRATIONS === 'true') {
  const dataSource = app.get(DataSource);
  await dataSource.runMigrations();
}
```

### 24.4 Health Check Endpoint

```typescript
@Controller('health')
export class HealthController {
  @Get()
  @Public()
  check(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @Public()
  async ready(): Promise<{ status: string; checks: Record<string, string> }> {
    const checks: Record<string, string> = {};

    // Check DB connection
    try {
      await this.dataSource.query('SELECT 1');
      checks.database = 'connected';
    } catch {
      checks.database = 'disconnected';
    }

    // Check Crunchwork API reachability (token exchange)
    try {
      await this.crunchworkAuthService.getAccessToken();
      checks.crunchwork = 'reachable';
    } catch {
      checks.crunchwork = 'unreachable';
    }

    const allOk = Object.values(checks).every(v => v !== 'disconnected' && v !== 'unreachable');

    return {
      status: allOk ? 'ok' : 'degraded',
      checks,
    };
  }
}
```

### 24.5 CI/CD Pipeline

```yaml
# .github/workflows/api.yml
name: API CI

on:
  push:
    paths: ['apps/api/**']
  pull_request:
    paths: ['apps/api/**']

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: test_claims_manager
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports: ['5432:5432']
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install
      - run: pnpm --filter api lint
      - run: pnpm --filter api test
      - run: pnpm --filter api test:e2e
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test_claims_manager

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker build -f apps/api/Dockerfile -t claims-api .
```

### 24.6 Security Considerations

- Never commit `.env` files (already in `.gitignore`)
- Use secrets manager (GitHub Secrets, AWS Secrets Manager, etc.) for production
- Enable HTTPS termination at load balancer / reverse proxy
- Rate limiting configured via `@nestjs/throttler`
- Helmet middleware for security headers
- CORS configured to allow only the frontend origin

---

## Acceptance Criteria

- [ ] Docker build produces a working container
- [ ] `docker-compose up` starts API + PostgreSQL for local development
- [ ] Health check endpoints work (`/health`, `/health/ready`)
- [ ] Migrations run as part of deployment
- [ ] CI pipeline runs lint, unit tests, and e2e tests
- [ ] Production secrets managed via environment variables (not files)
- [ ] CORS, Helmet, and rate limiting enabled

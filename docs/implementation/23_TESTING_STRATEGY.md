# 23 — Testing Strategy

## Objective

Define the testing approach for unit, integration, and end-to-end tests across the API server.

---

## Steps

### 23.1 Testing Structure

```
apps/api/
├── src/
│   ├── modules/
│   │   ├── claims/
│   │   │   ├── claims.service.spec.ts       # unit test
│   │   │   ├── claims.controller.spec.ts    # unit test
│   │   │   └── claims-sync.service.spec.ts  # unit test
│   │   └── ...
│   ├── crunchwork/
│   │   ├── crunchwork.service.spec.ts
│   │   └── crunchwork-auth.service.spec.ts
│   └── ...
├── test/
│   ├── jest-e2e.json
│   ├── app.e2e-spec.ts
│   ├── claims.e2e-spec.ts
│   ├── jobs.e2e-spec.ts
│   ├── webhooks.e2e-spec.ts
│   └── fixtures/
│       ├── crunchwork-claim.fixture.json
│       ├── crunchwork-job.fixture.json
│       ├── webhook-event.fixture.json
│       └── ...
```

### 23.2 Unit Tests

Each service and controller gets unit tests. Mock all dependencies.

#### What to Test
- **Services**: Business logic, data transformation, validation
- **Controllers**: Route handling, parameter extraction, response formatting
- **Mappers**: API ↔ Entity ↔ DTO transformations
- **Sync Services**: Correct entity creation, JSONB population, lookup resolution
- **HMAC Service**: Signature verification with known test vectors
- **Auth Guards**: Token validation, role checking

#### Mocking Strategy
- Mock `CrunchworkService` for all feature service tests
- Mock `Repository<T>` for all database interactions
- Mock `TenantContext` with a fixed tenant ID
- Use `@nestjs/testing` `Test.createTestingModule()`

#### Crunchwork Client Mock — Detailed Approach

Since `CrunchworkService` is the sole external integration point, its mock is critical:

```typescript
// test/mocks/crunchwork.service.mock.ts
export const mockCrunchworkService = {
  // Claims (no list endpoint; claims discovered via claim_id from jobs)
  createClaim: jest.fn().mockResolvedValue(claimFixture),
  getClaim: jest.fn().mockResolvedValue(claimFixture),
  updateClaim: jest.fn().mockResolvedValue(claimFixture),
  queryClaimByNumber: jest.fn().mockResolvedValue(claimFixture),
  queryClaimByExtRef: jest.fn().mockResolvedValue(claimFixture),

  // Jobs
  listJobs: jest.fn().mockResolvedValue([]),
  createJob: jest.fn().mockResolvedValue(jobFixture),
  getJob: jest.fn().mockResolvedValue(jobFixture),
  updateJob: jest.fn().mockResolvedValue(jobFixture),
  getJobQuotes: jest.fn().mockResolvedValue([]),
  getJobPurchaseOrders: jest.fn().mockResolvedValue([]),
  // ... all other methods
};
```

**Phase-aware testing:** Create test variants that simulate missing phase endpoints:
```typescript
// Simulate Phase 1 only — getClaim throws 404 (Phase 3 not available)
mockCrunchworkService.getClaim.mockRejectedValue(
  new NotFoundException('Endpoint not available in Phase 1')
);
```

#### Webhook HMAC Test Vectors

Generate known test vectors for HMAC verification:

```typescript
const testSecret = 'test-hmac-secret';
const testBody = '{"id":"evt-1","type":"NEW_JOB","timestamp":"2026-01-10T00:00:00Z","payload":{"id":"job-uuid"}}';
const expectedSignature = crypto.createHmac('sha256', testSecret).update(testBody).digest('base64');
// Use this in webhook E2E tests
```

### 23.3 Integration Tests

Test module integration with a real database (test schema):

#### What to Test
- TypeORM entity relationships and constraints
- Migration runs correctly on clean DB
- Sync services correctly populate all tables
- Tenant scoping prevents cross-tenant data access
- Webhook event persistence and processing pipeline

#### Setup
- Use a separate test PostgreSQL database
- Run migrations before test suite
- Truncate tables between tests
- Use test fixtures based on real API response shapes

### 23.4 E2E Tests

Full HTTP tests against the running NestJS application:

#### What to Test
- Full request/response lifecycle for each endpoint
- Authentication (valid token, invalid token, missing token, wrong role)
- Validation (invalid DTOs, missing required fields)
- Webhook ingestion (HMAC verification, event processing)
- Error handling (404, 400, 500 scenarios)

#### Setup
```typescript
// test/app.e2e-spec.ts
beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(CrunchworkService)
    .useValue(mockCrunchworkService)
    .compile();

  app = moduleRef.createNestApplication();
  // Apply same pipes, filters, interceptors as main.ts
  app.useGlobalPipes(new ValidationPipe({ ... }));
  await app.init();
});
```

### 23.5 Test Fixtures

Create fixtures based on the actual Crunchwork API response shapes from the PDF spec:

- `crunchwork-claim.fixture.json` — full Claim JSON body (Section 3.3.1)
- `crunchwork-job.fixture.json` — full Job JSON body (Section 3.3.2)
- `crunchwork-quote.fixture.json` — Quote with groups/combos/items
- `crunchwork-purchase-order.fixture.json` — PO with full hierarchy
- `crunchwork-invoice.fixture.json`
- `crunchwork-vendor-allocation.fixture.json`
- `webhook-event-new-job.fixture.json`
- `webhook-event-new-quote.fixture.json`

### 23.6 Test Configuration

```json
// jest config in package.json
{
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": { "^.+\\.(t|j)s$": "ts-jest" },
    "collectCoverageFrom": ["**/*.(t|j)s", "!**/node_modules/**", "!**/dist/**"],
    "coverageDirectory": "../coverage",
    "testEnvironment": "node"
  }
}
```

### 23.7 Coverage Targets

| Area | Target |
|------|--------|
| Services | 80%+ |
| Controllers | 70%+ |
| Mappers | 90%+ |
| Sync Services | 80%+ |
| HMAC / Auth | 95%+ |
| Overall | 75%+ |

---

## Acceptance Criteria

- [ ] Unit tests for all services, controllers, and mappers
- [ ] Integration tests for entity relationships and sync services
- [ ] E2E tests for all API endpoints
- [ ] HMAC verification tested with known test vectors
- [ ] Test fixtures match actual API response shapes
- [ ] CI pipeline runs tests on every commit
- [ ] Coverage meets or exceeds targets

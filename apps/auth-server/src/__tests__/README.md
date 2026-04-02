# Auth Server Test Suite

Comprehensive test suite for the More0 Auth Server using the co-located `__tests__` pattern.

## Test Structure

```
src/
├── __tests__/                    # All tests organized here
│   ├── __mocks__/               # Jest mocks for external dependencies
│   │   ├── logger.ts            # Logger mock
│   │   ├── oidc-provider.ts     # OIDC Provider mock
│   │   └── utils.ts             # Utils mock
│   ├── unit/                    # Unit tests
│   │   ├── services/            # Service layer tests
│   │   │   ├── jwt-service.test.ts
│   │   │   └── backend-service.test.ts
│   │   ├── routes/              # Route handler tests
│   │   │   └── iat-routes.test.ts
│   │   ├── middleware/          # Middleware tests
│   │   │   └── security.test.ts
│   │   └── server.test.ts       # Server structure tests
│   ├── integration/             # Integration tests
│   │   ├── oauth-flow.test.ts   # OAuth/OIDC flow tests
│   │   └── backend-integration.test.ts # Backend API integration
│   ├── test-setup.ts            # Test configuration and setup
│   └── README.md               # This file
├── services/                    # Source code
├── routes/
├── middleware/
└── config/
```

## Test Categories

### Unit Tests (`src/__tests__/unit/`)

Unit tests focus on testing individual components in isolation:

- **Services**: Test business logic in `JwtService` and `BackendService`
- **Routes**: Test route handlers and request/response handling
- **Middleware**: Test security, rate limiting, and error handling middleware
- **Server**: Test server structure and basic functionality

### Integration Tests (`src/__tests__/integration/`)

Integration tests verify the interaction between components:

- **OAuth Flow Tests**: End-to-end OAuth 2.1/OIDC flow testing
- **Backend Integration**: Tests communication with external backend API
- **Database Integration**: Tests Redis and database interactions

## Running Tests

### All Tests
```bash
pnpm test
```

### Unit Tests Only
```bash
pnpm test src/__tests__/unit
```

### Integration Tests Only
```bash
pnpm test src/__tests__/integration
```

### Watch Mode
```bash
pnpm test:watch
```

### Coverage Report
```bash
pnpm test:cov
```

## Test Configuration

### Jest Configuration
Tests are configured in `jest.config.mjs` with:
- **Test Pattern**: `src/__tests__/**/*.test.ts`
- **Mock Mapping**: External dependencies mapped to `src/__tests__/__mocks__/`
- **Coverage**: Excludes test files from coverage collection
- **Setup**: Uses `src/__tests__/test-setup.ts` for configuration

### Environment Variables
Tests use the following environment variables (set in `test-setup.ts`):

- `NODE_ENV=test`
- `JWT_SECRET=test-jwt-secret-key-for-testing-only`
- `DCR_IAT_SIGNING_KEY=test-iat-signing-key-for-testing-only`
- `OIDC_ISSUER=http://localhost:4000`
- `REDIS_URL=redis://localhost:6379`
- `MOREZERO_NODEJS_API_URL=http://localhost:3001`

## Mocking Strategy

The test suite uses comprehensive mocking to ensure:

1. **External Dependencies**: All external services are mocked
2. **Database**: Redis and database operations are mocked
3. **Network Calls**: HTTP requests to external APIs are mocked
4. **Logging**: Logger is mocked to reduce test noise

## Writing Tests

### Unit Test Example

```typescript
import { JwtService } from '../../services/jwt-service';

describe('JwtService', () => {
  let jwtService: JwtService;

  beforeEach(() => {
    jwtService = new JwtService();
  });

  describe('generateApiToken', () => {
    it('should generate an API token with user data using JWKS', async () => {
      const user = {
        userId: '123',
        email: 'test@example.com',
        name: 'Test User',
        tenantId: 'tenant-123'
      };
      const token = await jwtService.generateApiToken(user);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });
  });
});
```

### Integration Test Example

```typescript
import request from 'supertest';
import { createServer } from '../../server';

describe('OAuth Flow Integration Tests', () => {
  let app: any;
  let server: any;

  beforeAll(async () => {
    const serverInstance = await createServer();
    app = serverInstance.app;
    server = serverInstance.server;
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  it('should complete OAuth flow', async () => {
    const response = await request(app)
      .get('/.well-known/oauth-authorization-server')
      .expect(200);

    expect(response.body).toHaveProperty('issuer');
  });
});
```

## Best Practices

1. **Test Isolation**: Each test should be independent
2. **Mock External Dependencies**: Don't make real network calls in tests
3. **Clear Test Names**: Use descriptive test names that explain the scenario
4. **Arrange-Act-Assert**: Structure tests with clear setup, execution, and verification
5. **Test Edge Cases**: Include tests for error conditions and boundary cases
6. **Clean Up**: Properly clean up resources in `afterAll` hooks

## Troubleshooting

### Common Issues

1. **Port Conflicts**: Ensure test ports don't conflict with running services
2. **Mock Issues**: Verify mocks are properly configured in `test-setup.ts`
3. **Environment Variables**: Check that test environment variables are set correctly
4. **Async Operations**: Use proper async/await patterns in tests

### Debug Mode

Run tests with debug output:

```bash
DEBUG=auth-server:* pnpm test
```

## Contributing

When adding new tests:

1. Follow the existing directory structure
2. Use appropriate test categories (unit vs integration)
3. Include comprehensive error case testing
4. Update this README if adding new test patterns
5. Ensure tests pass in CI/CD pipeline

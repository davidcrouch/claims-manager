# 05 — Crunchwork HTTP Client Module

## Objective

Build a reusable HTTP client service that authenticates with the Crunchwork REST API using client credentials, caches JWT tokens, and provides typed methods for all API operations. This is the core integration layer.

---

## Steps

### 5.1 Module Structure

```
src/crunchwork/
├── crunchwork.module.ts
├── crunchwork.service.ts             # main HTTP client
├── crunchwork-auth.service.ts        # token acquisition & caching
├── interfaces/
│   ├── crunchwork-config.interface.ts
│   ├── crunchwork-token.interface.ts
│   └── crunchwork-request-options.interface.ts
├── dto/
│   ├── crunchwork-claim.dto.ts       # mirrors API Claim JSON body
│   ├── crunchwork-job.dto.ts
│   ├── crunchwork-quote.dto.ts
│   ├── crunchwork-purchase-order.dto.ts
│   ├── crunchwork-invoice.dto.ts
│   ├── crunchwork-message.dto.ts
│   ├── crunchwork-task.dto.ts
│   ├── crunchwork-appointment.dto.ts
│   ├── crunchwork-report.dto.ts
│   ├── crunchwork-attachment.dto.ts
│   └── crunchwork-vendor.dto.ts
└── interceptors/
    └── crunchwork-error.interceptor.ts  # maps API errors to NestJS exceptions
```

### 5.2 Token Service

Implements client credentials exchange per the API spec (Section 3.1.2).

**Critical:** The `grant_type=client_credentials` query parameter is required on the token URL. The auth URL in config should already include it (e.g., `https://staging-iag.crunchwork.com/auth/token?grant_type=client_credentials`). The credentials are sent via Basic Authorization as `base64(client_id:client_secret)`.

```typescript
@Injectable()
export class CrunchworkAuthService {
  private readonly logger = new Logger('CrunchworkAuthService');
  private cachedToken: { accessToken: string; expiresAt: number } | null = null;

  constructor(
    private readonly httpService: HttpService,
    @Inject(crunchworkConfig.KEY) private readonly config: CrunchworkConfig,
  ) {}

  async getAccessToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.cachedToken.expiresAt - 60000) {
      return this.cachedToken.accessToken;
    }
    return this.exchangeCredentials();
  }

  private async exchangeCredentials(): Promise<string> {
    this.logger.debug('CrunchworkAuthService.exchangeCredentials - acquiring new token');

    const credentials = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`
    ).toString('base64');

    // Auth URL must include ?grant_type=client_credentials
    // e.g. https://staging-iag.crunchwork.com/auth/token?grant_type=client_credentials
    const response = await firstValueFrom(
      this.httpService.get(this.config.authUrl, {
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }),
    );

    this.cachedToken = {
      accessToken: response.data.access_token,
      expiresAt: Date.now() + (response.data.expires_in * 1000),
    };

    this.logger.debug(
      `CrunchworkAuthService.exchangeCredentials - token acquired, expires in ${response.data.expires_in}s`
    );

    return this.cachedToken.accessToken;
  }
}
```

### 5.3 Main HTTP Client

```typescript
@Injectable()
export class CrunchworkService {
  private readonly logger = new Logger('CrunchworkService');

  constructor(
    private readonly httpService: HttpService,
    private readonly authService: CrunchworkAuthService,
    @Inject(crunchworkConfig.KEY) private readonly config: CrunchworkConfig,
  ) {}

  private async request<T>(options: {
    method: 'GET' | 'POST';
    path: string;
    tenantId: string;
    body?: any;
    params?: Record<string, string>;
  }): Promise<T> {
    const token = await this.authService.getAccessToken();
    const url = `${this.config.baseUrl}${options.path}`;

    this.logger.debug(`CrunchworkService.request - ${options.method} ${url}`);

    const response = await firstValueFrom(
      this.httpService.request({
        method: options.method,
        url,
        headers: {
          Authorization: `Bearer ${token}`,
          'active-tenant-id': options.tenantId,
          'Content-Type': 'application/json',
        },
        data: options.body,
        params: options.params,
      }),
    );

    return response.data;
  }
}
```

### 5.4 API Method Catalog

Add typed methods to `CrunchworkService` for every endpoint in the API spec. Phase indicates when the endpoint becomes available from Crunchwork.

#### Claims
| Method | API Endpoint | Phase | Notes |
|--------|-------------|-------|-------|
| `createClaim(params)` | `POST /claims` | 1 | |
| `updateClaim(params)` | `POST /claims/{id}` | 1 | |
| `getClaim(params)` | `GET /claims/{id}` | 3 | Read by ID; use `claim_id` from job to fetch |
| `queryClaimByNumber(params)` | `GET /claims?claimNumber=` | 3 | Search by claim number |
| `queryClaimByExtRef(params)` | `GET /claims?externalReference=` | 3 | Search by external reference |

**Note:** No `GET /claims` list endpoint. Claims are discovered via `claim_id` on jobs (`GET /jobs` returns jobs with `claim_id`).

#### Jobs
| Method | API Endpoint | Phase | Notes |
|--------|-------------|-------|-------|
| `listJobs(params)` | `GET /jobs` | 1 | List endpoint for jobs |
| `createJob(params)` | `POST /jobs` | 1 | |
| `getJob(params)` | `GET /jobs/{id}` | 1 | |
| `updateJob(params)` | `POST /jobs/{id}` | 1 | Vendor: status-only |
| `updateJobStatus(params)` | `POST /jobs/{id}/status` | 2 | Vendor-specific |
| `getJobQuotes(params)` | `GET /jobs/{id}/quotes` | 1 | |
| `getJobPurchaseOrders(params)` | `GET /jobs/{id}/purchase-orders` | 2 | |
| `getJobTasks(params)` | `GET /jobs/{id}/tasks` | 2 | |
| `getJobMessages(params)` | `GET /jobs/{id}/messages` | 2 | |
| `getJobReports(params)` | `GET /jobs/{id}/reports` | 2 | |
| `getJobInvoices(params)` | `GET /jobs/{id}/invoices` | 2 | |

#### Quotes
| Method | API Endpoint | Phase | Notes |
|--------|-------------|-------|-------|
| `createQuote(params)` | `POST /quotes` | 1 | |
| `updateQuote(params)` | `POST /quotes/{id}` | 1 | |
| `getQuote(params)` | `GET /quotes/{id}` | 2 | |

#### Purchase Orders
| Method | API Endpoint | Phase | Notes |
|--------|-------------|-------|-------|
| `getPurchaseOrder(params)` | `GET /purchase-orders/{id}` | 1 | |
| `updatePurchaseOrder(params)` | `POST /purchase-orders/{id}` | 1 | Insurance only |

#### Invoices
| Method | API Endpoint | Phase | Notes |
|--------|-------------|-------|-------|
| `createInvoice(params)` | `POST /invoices` | 1 | Vendor |
| `getInvoice(params)` | `GET /invoices/{id}` | 1 | |
| `updateInvoice(params)` | `POST /invoices/{id}` | 1 | |

#### Messages
| Method | API Endpoint | Phase | Notes |
|--------|-------------|-------|-------|
| `createMessage(params)` | `POST /messages` | 1 | |
| `getMessage(params)` | `GET /messages/{id}` | 1 | |
| `acknowledgeMessage(params)` | `POST /messages/{id}/acknowledge` | **5** | Phase 5 — gate behind feature flag |

#### Tasks
| Method | API Endpoint | Phase | Notes |
|--------|-------------|-------|-------|
| `createTask(params)` | `POST /tasks` | 1 | Vendor |
| `getTask(params)` | `GET /tasks/{id}` | 1 | |
| `updateTask(params)` | `POST /tasks/{id}` | 1 | Vendor |

#### Appointments
| Method | API Endpoint | Phase | Notes |
|--------|-------------|-------|-------|
| `createAppointment(params)` | `POST /appointments` | 1 | Vendor |
| `getAppointment(params)` | `GET /appointments/{id}` | **3** | Phase 3 |
| `updateAppointment(params)` | `POST /appointments/{id}` | 2 | Vendor |
| `cancelAppointment(params)` | `POST /appointments/{id}/cancel` | **5** | Phase 5 — gate behind feature flag |

#### Reports
| Method | API Endpoint | Phase | Notes |
|--------|-------------|-------|-------|
| `createReport(params)` | `POST /reports` | 1 | Vendor |
| `getReport(params)` | `GET /reports/{id}` | 2 | |
| `updateReport(params)` | `POST /reports/{id}` | 1 | Vendor |

#### Attachments
| Method | API Endpoint | Phase | Notes |
|--------|-------------|-------|-------|
| `createAttachment(params)` | `POST /attachments` | 1 | Vendor |
| `getAttachment(params)` | `GET /attachments/{id}` | 1 | |
| `updateAttachment(params)` | `POST /attachments/{id}` | 1 | Vendor |
| `downloadAttachment(params)` | `GET /attachments/{id}/download` | 1 | |

#### Vendors
| Method | API Endpoint | Phase | Notes |
|--------|-------------|-------|-------|
| `getVendorAllocation(params)` | `GET /vendors/allocation` | **4** | Phase 4 — gate behind feature flag |

### 5.5 Request Parameter Objects

All methods accept a single typed parameter object:

```typescript
interface CrunchworkRequestParams {
  tenantId: string;
}

interface GetClaimParams extends CrunchworkRequestParams {
  claimId: string;
}

interface CreateJobParams extends CrunchworkRequestParams {
  body: CrunchworkJobDto;
}
```

### 5.6 Error Handling

Map Crunchwork HTTP errors to NestJS exceptions:

| Crunchwork Status | NestJS Exception |
|-------------------|-----------------|
| 400 | `BadRequestException` (with API error details) |
| 401 | `UnauthorizedException` (trigger token refresh) |
| 404 | `NotFoundException` |
| 429 | `HttpException(429)` (with retry-after) |
| 500 | `InternalServerErrorException` |

### 5.7 Retry & Rate Limit Handling

Implement automatic retry for:
- **401 responses**: Invalidate cached token, re-acquire via `exchangeCredentials()`, retry once. If second attempt also 401, throw `UnauthorizedException`.
- **429 responses**: Read `Retry-After` header. Wait the specified duration, then retry. Max 3 retries. Log each occurrence at `warn` level. For bulk operations, implement a request queue with configurable concurrency to avoid triggering rate limits.
- **5xx responses**: Exponential backoff (1s, 2s, 4s), max 3 retries. Log each attempt.

```typescript
private async requestWithRetry<T>(options: RequestOptions): Promise<T> {
  let lastError: Error;
  for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
    try {
      return await this.request<T>(options);
    } catch (error) {
      lastError = error;
      if (error.response?.status === 401 && attempt === 0) {
        this.authService.invalidateToken();
        continue;
      }
      if (error.response?.status === 429) {
        const retryAfter = parseInt(error.response.headers['retry-after'] || '5', 10);
        this.logger.warn(
          `CrunchworkService.requestWithRetry - 429 rate limited, retrying after ${retryAfter}s`
        );
        await this.sleep(retryAfter * 1000);
        continue;
      }
      if (error.response?.status >= 500) {
        const delay = Math.pow(2, attempt) * 1000;
        this.logger.warn(
          `CrunchworkService.requestWithRetry - ${error.response.status}, retrying in ${delay}ms`
        );
        await this.sleep(delay);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}
```

### 5.8 Module Registration

```typescript
@Module({
  imports: [HttpModule.register({ timeout: 30000 })],
  providers: [CrunchworkAuthService, CrunchworkService],
  exports: [CrunchworkService],
})
export class CrunchworkModule {}
```

---

## Acceptance Criteria

- [ ] Token exchange works with the staging Crunchwork API
- [ ] Tokens are cached and refreshed before expiry
- [ ] All API methods defined with typed parameter objects
- [ ] 401 responses trigger automatic token refresh
- [ ] API errors are mapped to appropriate NestJS exceptions
- [ ] Log messages prefixed with `CrunchworkService.<methodName>`

# 002e — Multi-Tenant Connection Management

**Date:** 2026-03-25 (revised)
**Status:** Implementation Plan
**Parent:** [002 — Master Index](./002-implementation-plan.md)
**Depends on:** [002a](./002a-schema-and-migrations.md), [002b](./002b-webhook-pipeline-refactor.md)

---

## 0. Scope

Refactor `CrunchworkAuthService` and `CrunchworkService` to load credentials and configuration from `integration_connections` (database) instead of `.env` / `ConfigService`. Refactor webhook connection resolution to be authoritative. Seed the initial connection from existing env vars.

After this sub-plan:
- CW API calls use per-tenant, per-connection credentials from the database.
- Multiple tenants can have independent CW connections.
- The HMAC webhook secret is per-connection.
- `.env` CW vars become fallback/bootstrap values only.

**Relationship to More0:** The tool endpoints that More0 calls (e.g., `crunchwork-fetch`) receive a `connectionId` parameter. The `ConnectionResolverService` and refactored `CrunchworkService` use that `connectionId` to load the correct credentials. More0 itself does not manage credentials — it passes `connectionId` through the workflow as context.

---

## 1. Work Items

### 1.1 — Create `ConnectionResolverService`

**File:** `apps/api/src/modules/external/connection-resolver.service.ts` **(Create)**

**Methods:**

#### `resolveForWebhook`
```typescript
async resolveForWebhook(params: {
  payloadTenantId: string;
  payloadClient: string;
}): Promise<IntegrationConnectionRow | null>
```
Queries `integration_connections` where `providerTenantId` and `clientIdentifier` match and `isActive = true`.

#### `resolveForTenant`
```typescript
async resolveForTenant(params: {
  tenantId: string;
  providerCode?: string;
}): Promise<IntegrationConnectionRow | null>
```
Queries `integration_connections` for a tenant's active connection (default provider: `crunchwork`).

#### `getCredentials`
```typescript
async getCredentials(params: {
  connectionId: string;
}): Promise<{ clientId: string; clientSecret: string; authUrl: string; baseUrl: string; activeTenantId: string }>
```
Loads connection row, extracts credentials from `credentials` JSONB. MVP: plaintext JSON. Encryption is a future enhancement.

**Caching:** Connection rows cached in-memory with 60s TTL (`Map<string, { row, expiresAt }>`).

---

### 1.2 — Refactor `CrunchworkAuthService`

**File:** `apps/api/src/crunchwork/crunchwork-auth.service.ts` **(Modify)**

**Changes:**
- `getAccessToken` accepts `{ connectionId }` parameter.
- Token cache changes from single `{ token, expiresAt }` to `Map<string, { token, expiresAt }>` keyed by `connectionId`.
- Loads credentials from `ConnectionResolverService.getCredentials()`.
- `invalidateToken` accepts `{ connectionId }`.

**Backward compatibility:** Add `getAccessTokenFromEnv()` that uses env-based config. Used only by legacy code during transition.

---

### 1.3 — Refactor `CrunchworkService`

**File:** `apps/api/src/crunchwork/crunchwork.service.ts` **(Modify)**

**Changes:**
- All public methods change `tenantId: string` to `connectionId: string`.
- Private `request` method resolves `baseUrl` and `activeTenantId` from the connection via `ConnectionResolverService.getCredentials()`.

**Updated `request`:**
```typescript
private async request<T>(options: {
  method: 'GET' | 'POST';
  path: string;
  connectionId: string;
  body?: unknown;
  params?: Record<string, string>;
}): Promise<T> {
  const creds = await this.connectionResolver.getCredentials({
    connectionId: options.connectionId,
  });
  const token = await this.authService.getAccessToken({
    connectionId: options.connectionId,
  });
  const url = `${creds.baseUrl}${options.path}`;
  // ... rest unchanged ...
}
```

**All affected methods (signature change `tenantId` → `connectionId`):**
`createClaim`, `updateClaim`, `getClaim`, `queryClaimByNumber`, `queryClaimByExtRef`, `listJobs`, `createJob`, `getJob`, `updateJob`, `createQuote`, `updateQuote`, `getQuote`, `getJobQuotes`, `getPurchaseOrder`, `updatePurchaseOrder`, `getJobPurchaseOrders`, `createInvoice`, `getInvoice`, `updateInvoice`, `getJobInvoices`, `createMessage`, `getMessage`, `acknowledgeMessage`, `createTask`, `getTask`, `updateTask`, `getJobTasks`, `createAppointment`, `getAppointment`, `updateAppointment`, `cancelAppointment`, `createReport`, `getReport`, `updateReport`, `createAttachment`, `getAttachment`, `updateAttachment`, `getVendorAllocation`

---

### 1.4 — Refactor `WebhookHmacService`

**File:** `apps/api/src/modules/webhooks/webhook-hmac.service.ts` **(Modify)**

**Change:** Accept `hmacSecret` parameter instead of reading from global config.
```typescript
verify(params: { rawBody: Buffer; signature: string; hmacSecret: string }): boolean
```

Controller resolves connection first, passes connection's `webhookSecret`. Falls back to env-based `crunchwork.hmacKey` if no connection found.

---

### 1.5 — Update Webhook Controllers for Per-Connection HMAC

**File:** `apps/api/src/modules/webhooks/webhooks.controller.ts` **(Modify)**
**File:** `apps/api/src/modules/webhooks/webhook-alias.controller.ts` **(Modify)**

**Updated flow:**
```typescript
// Resolve connection FIRST (before HMAC)
const connection = await this.webhooksService.resolveConnection({...});

// HMAC verify using connection-specific secret (or env fallback)
const hmacSecret = connection?.webhookSecret
  || this.configService.get<string>('crunchwork.hmacKey')
  || '';
const hmacVerified = signature
  ? this.hmacService.verify({ rawBody, signature, hmacSecret })
  : false;
```

---

### 1.6 — Update Feature Module Services

These services call `CrunchworkService` for outbound operations. They must now resolve a `connectionId`.

**Files to modify:**

| File | Change |
|------|--------|
| `modules/claims/claims.service.ts` | Inject `ConnectionResolverService`, resolve `connectionId` from `tenantId` |
| `modules/jobs/jobs.service.ts` | Same pattern |
| `modules/quotes/quotes.service.ts` | Same |
| `modules/purchase-orders/purchase-orders.service.ts` | Same |
| `modules/invoices/invoices.service.ts` | Same |
| `modules/messages/messages.service.ts` | Same |
| `modules/tasks/tasks.service.ts` | Same |
| `modules/appointments/appointments.service.ts` | Same |
| `modules/reports/reports.service.ts` | Same |
| `modules/attachments/attachments.service.ts` | Same |
| `modules/vendors/vendors.service.ts` | Same |

**Pattern:**
```typescript
const connection = await this.connectionResolver.resolveForTenant({ tenantId });
if (!connection) throw new BadRequestException('No active CW connection for tenant');
const cwJob = await this.crunchworkService.getJob({
  connectionId: connection.id,
  jobId: cwJobId,
});
```

---

### 1.7 — Update Tool Endpoints

**File:** `apps/api/src/modules/external/tools/external-tools.controller.ts` **(Modify)**

The `crunchwork-fetch` tool endpoint already receives `connectionId` from the More0 workflow and passes it to `CrunchworkService`. After this sub-plan, that `connectionId` resolves to DB-stored credentials instead of env vars. No controller change needed — the refactor is in the service layer.

---

### 1.8 — Seed Script: Migrate `.env` Credentials to Database

**File:** `apps/api/src/database/seeds/seed-initial-connection.ts` **(Create)**

Reads env vars (`CW_BASE_URL`, `CW_AUTH_URL`, `CW_CLIENT_ID`, `CW_CLIENT_SECRET`, `CW_ACTIVE_TENANT_ID`, `CW_CLIENT_IDENTIFIER`, `CW_HMAC_KEY`) and inserts an `integration_connections` row.

Add script to `package.json`:
```json
"db:seed-connection": "ts-node src/database/seeds/seed-initial-connection.ts"
```

---

### 1.9 — Export `ConnectionResolverService`

**File:** `apps/api/src/modules/external/external.module.ts` **(Modify)**

Add `ConnectionResolverService` to providers and exports.

---

## 2. New Files Summary

| # | File (relative to `apps/api/src/`) | Purpose |
|---|-----|---------|
| 1 | `modules/external/connection-resolver.service.ts` | Connection resolution + credential loading |
| 2 | `database/seeds/seed-initial-connection.ts` | One-time seed script |

## 3. Modified Files Summary

| # | File | Change |
|---|------|--------|
| 1 | `crunchwork/crunchwork-auth.service.ts` | Per-connection token caching |
| 2 | `crunchwork/crunchwork.service.ts` | All methods accept `connectionId` |
| 3 | `modules/webhooks/webhook-hmac.service.ts` | Accept `hmacSecret` parameter |
| 4 | `modules/webhooks/webhooks.controller.ts` | Per-connection HMAC verification |
| 5 | `modules/webhooks/webhook-alias.controller.ts` | Same |
| 6–16 | Feature module services (11 files) | Resolve connection before CW calls |
| 17 | `modules/external/external.module.ts` | Add ConnectionResolverService |

---

## 4. Breaking Change Strategy

Changing `CrunchworkService` method signatures is a breaking change for all callers.

**Recommendation:** Big-bang approach — change all signatures and callers in a single PR. The codebase is small (~11 feature services) and the change is mechanical.

---

## 5. Credential Security

**MVP:** Plaintext JSONB in `integration_connections.credentials`. Database access-controlled.

**Future:** AES-256-GCM encryption with `CREDENTIALS_ENCRYPTION_KEY` from env, or AWS Secrets Manager ARN references.

---

## 6. Test Strategy

| Test | Scope |
|------|-------|
| `ConnectionResolverService` unit test | Webhook resolution, tenant resolution, caching with TTL. |
| `CrunchworkAuthService` unit test | Per-connection token caching, independent tokens per connection. |
| `CrunchworkService` unit test | URL built from connection `baseUrl`, uses connection `activeTenantId`. |
| `WebhookHmacService` unit test | HMAC with connection-specific secret. |
| Feature service tests | Verify connection resolution before CW calls. |
| Seed script test | Run against test DB, verify connection row created. |

---

## 7. Estimated Effort

| Item | Estimate |
|------|----------|
| ConnectionResolverService | 2 hours |
| CrunchworkAuthService refactor | 2 hours |
| CrunchworkService refactor | 2 hours |
| WebhookHmacService refactor | 30 min |
| Webhook controllers update | 1 hour |
| Feature services update (11 files) | 3 hours |
| Seed script | 1 hour |
| Module wiring | 30 min |
| Unit tests | 3 hours |
| Integration tests | 2 hours |
| **Total** | **~2 days** |

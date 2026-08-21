# 53g — Auth Hardening for more0-ensure Endpoints

**Gap addressed:** G9 (webhook/invoke endpoints bypass JWT validation)

## Problem

The webhook and invoke controllers in more0-ensure are decorated with `@Public()`, which bypasses the JWT auth guard. While claims-manager sends a bearer token via the connection resolver, more0-ensure does not validate it. Any unauthenticated caller can:
- Start workflow runs via `/api/v1/invoke`
- Inject events via `/api/v1/webhooks/:source`
- Potentially manipulate job state through spoofed events

## Solution

### 1. Remove `@Public()` from gateway controllers

**File:** `more0-ensure/src/gateway/webhook.controller.ts`

Remove `@Public()` from the controller or route handler. The JWT guard will then require a valid bearer token.

```typescript
// Before
@Public()
@Post(':source')
async handleWebhook(/* ... */) { /* ... */ }

// After
@Post(':source')
async handleWebhook(/* ... */) { /* ... */ }
```

**File:** `more0-ensure/src/gateway/invoke.controller.ts`

Same change — remove `@Public()`.

### 2. Configure JWT validation

more0-ensure already has a JWT auth module in `src/auth/`. Verify it is configured to:

1. **Accept the same issuer** as claims-manager's auth server (check `AUTH_ISSUER` / `AUTH_AUDIENCE` in `.env`).
2. **Validate the token** sent by `OutboundEventsService` — which obtains a token via `client_credentials` grant from the auth server.

Check `src/auth/` for the JWT strategy configuration. Ensure:
- The `AUTH_JWKS_URI` or `AUTH_PUBLIC_KEY` points to the auth server
- The `AUTH_AUDIENCE` matches the audience configured for the more0-ensure client credentials

### 3. Add a service-to-service auth scope (optional enhancement)

For defence in depth, define a scope or permission that the claims-manager client credential must have:

```
scope: workflow:invoke workflow:webhook
```

Then validate this scope in the guards. This prevents user tokens (which have different scopes) from calling workflow endpoints.

### 4. Verify claims-manager sends valid tokens

**File:** `claims-manager/apps/api/src/modules/outbound-events/outbound-events.service.ts`

The `resolveEndpoint` method already acquires an OAuth2 access token via `client_credentials` and sends it as `Authorization: Bearer <token>`. Verify:

1. The client credentials configured on the `more0-ensure` connection have the correct `authUrl` pointing to the auth server.
2. The auth server issues tokens that more0-ensure's JWT guard can validate (same issuer, audience, signing key).

### 5. Handle auth failures gracefully

When more0-ensure rejects a request with 401, `OutboundEventsService` currently logs a warning and moves on (non-blocking). This is fine for events but could cause workflow starts to silently fail. Consider:

- Adding a retry with token refresh on 401
- Logging at `error` level for invoke failures (not just `warn`)

## Files Changed

| File | Repo | Change |
|------|------|--------|
| `src/gateway/webhook.controller.ts` | more0-ensure | Remove @Public() |
| `src/gateway/invoke.controller.ts` | more0-ensure | Remove @Public() |
| `src/auth/` (strategy/guard) | more0-ensure | Verify JWT config matches auth server |
| `.env` / `.env.example` | more0-ensure | Verify AUTH_* environment variables |

## Testing

1. Send a webhook without a bearer token → verify 401 response.
2. Send a webhook with an invalid token → verify 401.
3. Send a webhook with a valid token from claims-manager → verify 200 and event processed.
4. Invoke a workflow with valid token → verify run starts.
5. End-to-end: start a job in claims-manager → verify the workflow starts (token flow works).

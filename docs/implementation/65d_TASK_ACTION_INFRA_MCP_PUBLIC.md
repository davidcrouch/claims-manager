# 65d — Infrastructure: Expose claims-mcp to Auth'd External Clients

**Parent plan:** 65 (Task Actions Design)  
**Scope:** Terraform (deploy/terraform), Claims Manager auth-server config, DNS, More0 Ensure env  
**Status:** Plan  
**Depends on:** Nothing — can be done independently

---

## Objective

Make `claims-mcp` reachable over the public internet (via HTTPS LB) while keeping it protected by application-level JWT authentication. This allows More0 Ensure (separate GCP project/account, **separate auth domain**) to call claims-mcp via Streamable HTTP MCP with a Bearer JWT that **Claims Manager’s auth** will accept.

---

## Auth model (do not assume a shared IdP)

More0 Ensure and Claims Manager must be treated as **independent identity domains**. They may happen to use the same issuer in a given environment, but the plan must not require that.

| Direction | Caller | Receiver | Token must be accepted by |
|-----------|--------|----------|---------------------------|
| **Ensure → claims-mcp** (this plan) | More0 Ensure | claims-mcp | **Claims Manager auth** |
| **CM → Ensure** (existing outbound events; not this plan’s infra work) | Claims Manager | Ensure webhook/invoke | **Ensure’s auth** |

For Ensure → MCP: register Ensure as an **external M2M client of CM auth**. Ensure’s own IdP is irrelevant for this hop — Ensure only needs CM’s token endpoint + client credentials so it can obtain a JWT that claims-mcp validates.

For CM → Ensure: credentials live on the tenant’s `more0-ensure` integration connection (`clientId`, `clientSecret`, `authUrl`) and must satisfy **Ensure’s** JWT validation (`AUTH_ISSUER_URL` / `AUTH_JWKS_URI` on the Ensure side). That path is already implemented in `OutboundEventsService`; this plan does not change it.

---

## Current State

| Aspect | Value |
|--------|-------|
| Cloud Run ingress | `INGRESS_TRAFFIC_ALL` |
| Cloud Run auth | `allow_unauthenticated = false` (IAM-gated) |
| Invoker SAs | `frontend-sa`, `api-server-sa` only |
| App-level auth | `Authorization: Bearer <JWT>` required on every request (checked in `main.ts`) |
| Network path | Only reachable via Cloud Run IAM identity token from same-project SAs |

## Target State

| Aspect | Value |
|--------|-------|
| Cloud Run ingress | `INGRESS_TRAFFIC_ALL` (unchanged) |
| Cloud Run auth | `allow_unauthenticated = true` (LB-routable) |
| App-level auth | `Authorization: Bearer <JWT>` required (unchanged — this is the real gate; validated against **CM auth**) |
| Network path | Public HTTPS via LB serverless NEG, same pattern as `api-server` |
| LB hostname | `mcp-staging.<domain>` / `mcp.<domain>` |

**"Public" means reachable, not open.** Unauthenticated HTTP requests get 401 from the application.

---

## 1. Terraform Changes

### Staging: `deploy/terraform/environments/staging/cloud_run.tf`

```hcl
module "cloud_run_claims_mcp" {
  # …existing config…

  # Change from false to true:
  allow_unauthenticated = true

  # Remove invoker_members (no longer needed for IAM gating):
  # invoker_members = [...]
}
```

### Production: `deploy/terraform/environments/production/cloud_run.tf`

Same change.

### Keep `ms-graph-mcp` IAM-private — it has no external callers.

---

## 2. Load Balancer / Serverless NEG

Add a serverless NEG + backend service for `claims-mcp`, same pattern as the existing `api-server` NEG.

### Staging hostname

Add `mcp-staging.<domain>` to:
1. LB URL map (host rule → claims-mcp backend)
2. Google-managed SSL cert SANs
3. Cloudflare DNS (grey-cloud A record to LB IP)

### Production hostname

Add `mcp.<domain>` to the same resources.

### Terraform additions (in `cloud_run.tf` or a dedicated `lb.tf`)

```hcl
resource "google_compute_region_network_endpoint_group" "claims_mcp_neg" {
  name                  = "claims-mcp-neg"
  region                = var.region
  network_endpoint_type = "SERVERLESS"
  cloud_run {
    service = module.cloud_run_claims_mcp[0].service_name
  }
}

resource "google_compute_backend_service" "claims_mcp" {
  name        = "claims-mcp-backend"
  protocol    = "HTTPS"
  timeout_sec = 30
  backend {
    group = google_compute_region_network_endpoint_group.claims_mcp_neg.id
  }
}

# Add host rule to existing URL map:
# host: mcp-staging.<domain> → claims_mcp backend
# Add to existing managed cert SANs
```

---

## 3. claims-mcp Environment Variable

Set `CLAIMS_MCP_PUBLIC_URL` so OAuth discovery (RFC 9728) returns the correct public origin:

### Staging
```
CLAIMS_MCP_PUBLIC_URL=https://mcp-staging.<domain>
```

### Production
```
CLAIMS_MCP_PUBLIC_URL=https://mcp.<domain>
```

This is used by `oauth-discovery.ts` → `publicOrigin()` to build the `authorization_servers` metadata (CM’s auth-server URL).

---

## 4. Claims Manager Auth: M2M Client for More0 Ensure

Ensure must authenticate **to CM**, so create a dedicated OAuth2 client on **Claims Manager’s auth-server** (not on Ensure’s IdP):

| Field | Value |
|-------|-------|
| `client_id` | `more0-ensure-service` |
| `client_secret` | Generated; store in **More0 Ensure’s** secret manager (Ensure is the caller) |
| `grant_types` | `client_credentials` |
| `scopes` | `mcp:tools` (or whatever claims-mcp requires) |
| `audience` | CM auth audience (e.g. `https://api.<domain>`) |
| `token_endpoint` | CM auth token URL (e.g. `https://auth-staging.<domain>/token`) |

### File: `apps/auth-server` static clients config

```typescript
{
  clientId: 'more0-ensure-service',
  clientSecret: process.env.MORE0_ENSURE_CLIENT_SECRET,
  grantTypes: ['client_credentials'],
  scopes: ['mcp:tools'],
  description: 'More0 Ensure workflow engine — external M2M client for claims-mcp',
}
```

This client already exists in some form (`MORE0_ENSURE_SERVICE_CLIENT_ID`); confirm scope/audience match what claims-mcp validates in production.

---

## 5. More0 Ensure Environment Config

Point Ensure at **public claims-mcp** and **CM’s token endpoint** (receiver auth), regardless of what Ensure uses for its own APIs:

```env
MCP_SERVER_URL=https://mcp-staging.<domain>/mcp
MCP_TOKEN_URL=https://auth-staging.<domain>/token
MCP_TOKEN_AUDIENCE=https://api.<domain>
MCP_CLIENT_ID=more0-ensure-service
MCP_CLIENT_SECRET=<CM-issued secret, from Ensure secret manager>
```

**No Ensure application code changes required** if `McpClientService` already:
- Acquires tokens via `client_credentials` against `MCP_TOKEN_URL`
- Passes `Authorization: Bearer <token>`
- Passes `x-tenant-id`
- Uses Streamable HTTP

Ensure’s own `AUTH_ISSUER_URL` / `AUTH_JWKS_URI` remain for **inbound** CM → Ensure calls; they are orthogonal to these MCP env vars.

---

## 6. Hardening

| Measure | Implementation |
|---------|----------------|
| **Rate limiting** | Cloud Armor on the claims-mcp backend (e.g. 100 req/min per IP) |
| **CORS** | Deny browser origins — MCP is M2M only |
| **JWT validation** | claims-mcp validates against **CM** issuer/audience/JWKS |
| **Scope check** | Require `mcp:tools` (or equivalent) before tool calls |
| **Logging** | Log M2M `client_id` on authenticated requests for audit |

---

## Rollout Order

1. **Terraform**: `allow_unauthenticated = true` + LB NEG + hostname (staging first)
2. **CM auth-server**: Ensure M2M client exists with correct secret/scope/audience
3. **claims-mcp**: Set `CLAIMS_MCP_PUBLIC_URL`
4. **More0 Ensure**: Set `MCP_SERVER_URL` + `MCP_TOKEN_*` to CM public endpoints / CM-issued credentials
5. **Verify**: Ensure can call `create_task` via public claims-mcp
6. **Production**: Repeat steps 1–5

---

## Rollback

If issues arise, revert `allow_unauthenticated = false` in Terraform. Ensure cannot reach MCP from outside the project until restored. Workflows that need MCP will fail tool calls until connectivity/auth is fixed.

---

## Files Changed Summary

| File | Change |
|------|--------|
| `deploy/terraform/environments/staging/cloud_run.tf` | `allow_unauthenticated = true` for claims-mcp |
| `deploy/terraform/environments/production/cloud_run.tf` | Same |
| `deploy/terraform/...` LB / NEG / host rules | `mcp-staging` / `mcp` hostnames |
| `apps/auth-server` static clients | Confirm/extend `more0-ensure-service` as external M2M client of **CM** auth |
| More0 Ensure env (not this repo) | Public MCP URL + **CM** token URL + CM-issued client credentials |

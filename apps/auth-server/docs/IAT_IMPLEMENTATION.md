# Initial Access Token (IAT) Implementation

This document describes the Initial Access Token (IAT) implementation for self-serve Dynamic Client Registration (DCR) in the More0 MCP ecosystem.

## Quick Setup Guide

### Prerequisites

- Node.js 18+ (for built-in fetch support)
- pnpm package manager
- Auth server with Redis instance (Upstash or local)
- Auth server running

### 1. Environment Configuration

#### Auth Server (.env)
```bash
# IAT Configuration
DCR_IAT_SIGNING_KEY=your-base64-encoded-signing-key-here

# Existing auth server config
OIDC_ISSUER=http://localhost:4000
DYNAMIC_REGISTRATION_SECRET=your-console-shared-secret
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long
```

#### Generate IAT Signing Key
```bash
# Generate a secure 32-byte key and encode as base64
openssl rand -base64 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 2. Install Dependencies

```bash
# Auth Server
cd apps/auth-server
pnpm install
```

### 3. Start Services

```bash
# Start Auth Server
cd apps/auth-server
pnpm start
```

### 4. Verify Setup

```bash
# Test IAT endpoint
curl -X POST "http://localhost:4000/oauth/initial-access-token" \
  -H "Authorization: Bearer YOUR_USER_JWT_TOKEN" \
  -H "Content-Type: application/json"

# Expected response:
# {
#   "initial_access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "as_reg_endpoint": "http://localhost:4000/reg",
#   "expires_in": 600,
#   "token_type": "Bearer"
# }
```

## Overview

Initial Access Tokens (IAT) enable **autonomous MCP clients** to register themselves directly with the OAuth authorization server without going through the console/API first. This follows the OAuth 2.1 Dynamic Client Registration (RFC 7591) specification and enables the MCP ecosystem to support third-party clients and autonomous AI agents.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐
│   MCP Client    │    │  Auth Server    │
│  (Autonomous)   │    │  (OAuth Core)   │
├─────────────────┤    ├─────────────────┤
│ 1. Get IAT      │───▶│ POST /oauth/    │
│                 │    │ initial-access- │
│                 │    │ token           │
├─────────────────┤    ├─────────────────┤
│ 2. Register     │───▶│ POST /reg       │
│    with IAT     │    │ (Authorization: │
│                 │    │  Bearer <IAT>)  │
└─────────────────┘    └─────────────────┘
```

## API Endpoints

### 1. Issue Initial Access Token

**Endpoint:** `POST /oauth/initial-access-token`

**Authentication:** Required (user JWT token)

**Description:** Issues a short-lived token that allows MCP clients to register themselves.

**Request:**
```http
POST /oauth/initial-access-token
Authorization: Bearer <user-jwt-token>
Content-Type: application/json
```

**Response:**
```json
{
  "initial_access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "as_reg_endpoint": "http://localhost:4000/reg",
  "expires_in": 600,
  "token_type": "Bearer"
}
```

**IAT Token Payload:**
```json
{
  "typ": "dcr-iat",
  "tid": "tenant-id",
  "uid": "user-id",
  "scopes": ["mcp:read", "mcp:write", "mcp:invoke"],
  "max_clients": 10,
  "allowed_grant_types": ["client_credentials"],
  "allowed_auth_methods": ["client_secret_basic", "private_key_jwt"],
  "iat": 1640991600,
  "exp": 1640992200,
  "iss": "http://localhost:4000",
  "aud": "http://localhost:4000/reg"
}
```

### 2. Validate Initial Access Token

**Endpoint:** `POST /oauth/validate-iat`

**Description:** Validates an IAT token and returns its claims.

**Request:**
```http
POST /oauth/validate-iat
Authorization: Bearer <iat-token>
Content-Type: application/json
```

**Response:**
```json
{
  "valid": true,
  "claims": {
    "typ": "dcr-iat",
    "tid": "tenant-id",
    "uid": "user-id",
    "scopes": ["mcp:read", "mcp:write", "mcp:invoke"],
    "max_clients": 10,
    "iat": 1640991600,
    "exp": 1640992200
  },
  "expires_in": 300
}
```

### 3. Register Client with IAT

**Endpoint:** `POST /reg` (on Auth Server)

**Description:** Registers a new OAuth client using an IAT token.

**Request:**
```http
POST /reg
Authorization: Bearer <iat-token>
Content-Type: application/json

{
  "client_name": "My MCP Client",
  "grant_types": ["client_credentials"],
  "scope": "mcp:read mcp:write mcp:invoke",
  "token_endpoint_auth_method": "client_secret_basic"
}
```

**Response:**
```json
{
  "client_id": "generated-client-id",
  "client_secret": "generated-client-secret",
  "client_id_issued_at": 1640991600,
  "client_secret_expires_at": 0,
  "registration_access_token": "registration-token",
  "registration_client_uri": "http://localhost:4000/reg/client-id",
  "grant_types": ["client_credentials"],
  "scope": "mcp:read mcp:write mcp:invoke",
  "token_endpoint_auth_method": "client_secret_basic",
  "tenant_id": "tenant-id"
}
```

## Policy Enforcement

The IAT implementation includes comprehensive policy enforcement:

### 1. Scope Restrictions
- IAT tokens can only authorize registration with scopes listed in the token
- Requested scopes are filtered against allowed scopes

### 2. Grant Type Restrictions
- Only `client_credentials` grant type is allowed for MCP clients
- Other grant types are filtered out

### 3. Authentication Method Restrictions
- Only `client_secret_basic` and `private_key_jwt` are allowed
- Defaults to `client_secret_basic` if not specified

### 4. Tenant Binding
- All registered clients are bound to the tenant specified in the IAT
- Prevents cross-tenant client registration

### 5. Client Limits
- IAT tokens can specify maximum number of clients per tenant
- Enforced at the application level

## Security Considerations

### 1. Token Expiration
- IAT tokens expire in 10 minutes by default
- Short-lived tokens minimize security exposure

### 2. Single Use
- IAT tokens are designed for single registration
- Consider implementing token revocation after use

### 3. Signing Key Security
- IAT signing key must be kept secure
- Use strong, randomly generated keys
- Rotate keys periodically

### 4. Audit Logging
- All IAT operations are logged
- Includes tenant, user, and client information

## Environment Configuration

### API Server (.env)
```bash
# IAT Configuration
DCR_IAT_SIGNING_KEY=your-base64-encoded-signing-key-here
AUTH_ISSUER=http://localhost:4000
```

### Auth Server (.env)
```bash
# IAT Configuration
DCR_IAT_SIGNING_KEY=your-base64-encoded-signing-key-here
```

## Usage Examples

### 1. Node.js/TypeScript
```typescript
import { getInitialAccessToken, registerMcpClientWithIAT } from './examples/iat-usage-example';

// Get IAT from API server
const iatData = await getInitialAccessToken(userToken);

// Register MCP client
const client = await registerMcpClientWithIAT(iatData.initial_access_token, 'My MCP Client');
```

### 2. cURL
```bash
# Get IAT
curl -X POST "http://localhost:3001/api/v1/oauth/initial-access-token" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json"

# Register client
curl -X POST "http://localhost:4000/reg" \
  -H "Authorization: Bearer $IAT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "My MCP Client",
    "grant_types": ["client_credentials"],
    "scope": "mcp:read mcp:write mcp:invoke",
    "token_endpoint_auth_method": "client_secret_basic"
  }'
```

### 3. Python
```python
import requests

# Get IAT
iat_response = requests.post(
    'http://localhost:3001/api/v1/oauth/initial-access-token',
    headers={'Authorization': f'Bearer {user_token}'}
)
iat_data = iat_response.json()

# Register client
client_response = requests.post(
    'http://localhost:4000/reg',
    headers={
        'Authorization': f'Bearer {iat_data["initial_access_token"]}',
        'Content-Type': 'application/json'
    },
    json={
        'client_name': 'My MCP Client',
        'grant_types': ['client_credentials'],
        'scope': 'mcp:read mcp:write mcp:invoke',
        'token_endpoint_auth_method': 'client_secret_basic'
    }
)
client_data = client_response.json()
```

## Error Handling

### Common Error Responses

**401 Unauthorized:**
```json
{
  "error": "invalid_registration_authorization",
  "error_description": "Either x-console-admin header or valid IAT token required"
}
```

**400 Bad Request:**
```json
{
  "error": "invalid_request",
  "error_description": "Invalid IAT token"
}
```

**403 Forbidden:**
```json
{
  "error": "insufficient_scope",
  "error_description": "Requested scope not allowed by IAT policy"
}
```

## Monitoring and Observability

### Logs
- All IAT operations are logged with structured data
- Includes tenant, user, client, and policy information
- Log levels: INFO for successful operations, ERROR for failures

### Metrics
- IAT issuance rate
- Registration success/failure rates
- Policy enforcement violations
- Token expiration events

## Migration from Brokered Registration

The IAT implementation is **additive** and doesn't replace the existing brokered registration:

- **Brokered Registration**: Still available for console-based client creation
- **IAT Registration**: New option for autonomous client registration
- **Hybrid Approach**: Both methods can be used simultaneously

## Future Enhancements

### 1. Software Statements
- JWT-based registration authorization
- More flexible policy definition
- Third-party issuer support

### 2. Token Revocation
- Revoke IAT tokens after use
- Prevent token reuse attacks

### 3. Advanced Policy
- Time-based restrictions
- IP address whitelisting
- Custom scope validation

### 4. Monitoring Dashboard
- Real-time IAT usage metrics
- Policy violation alerts
- Client registration analytics

## Troubleshooting

### Common Issues

1. **"IAT signing key not configured"**
   - Ensure `DCR_IAT_SIGNING_KEY` is set in both API and Auth servers
   - Use base64-encoded key
   - **Fix**: Generate key with `openssl rand -base64 32`

2. **"Invalid IAT token"**
   - Check token expiration (10 minutes default)
   - Verify signing key matches between servers
   - Ensure correct issuer/audience
   - **Fix**: Regenerate IAT token

3. **"Scope not allowed"**
   - Check IAT token scopes
   - Verify requested scopes are in allowed list
   - **Fix**: Update IAT scopes or client request

4. **"Tenant binding failed"**
   - Ensure IAT contains valid tenant ID
   - Check tenant exists in system
   - **Fix**: Verify user authentication includes tenant ID

5. **"Authentication required"**
   - User JWT token missing or invalid
   - **Fix**: Ensure valid user token in Authorization header

6. **"Module not found" errors**
   - Missing dependencies
   - **Fix**: Run `pnpm install` in both servers

### Environment Variable Checklist

#### API Server Required Variables
```bash
# IAT Configuration
DCR_IAT_SIGNING_KEY=base64-encoded-key
AUTH_ISSUER=http://localhost:4000

# Existing variables
MOREZERO_API_URL=https://your-api-url
MOREZERO_LOG_LEVEL=info
```

#### Auth Server Required Variables
```bash
# IAT Configuration
DCR_IAT_SIGNING_KEY=base64-encoded-key

# Existing variables
OIDC_ISSUER=http://localhost:4000
DYNAMIC_REGISTRATION_SECRET=your-secret
```

### Debug Mode

Enable debug logging to troubleshoot IAT issues:

```bash
# API Server
MOREZERO_LOG_LEVELS="api-server:initial-access-token=debug"

# Auth Server
MOREZERO_LOG_LEVELS="auth-server:reg-guard=debug"
```

### Testing Commands

```bash
# 1. Test IAT endpoint
curl -X POST "http://localhost:3001/api/v1/oauth/initial-access-token" \
  -H "Authorization: Bearer YOUR_USER_JWT_TOKEN"

# 2. Test IAT validation
curl -X POST "http://localhost:3001/api/v1/oauth/validate-iat" \
  -H "Authorization: Bearer YOUR_IAT_TOKEN"

# 3. Test client registration
curl -X POST "http://localhost:4000/reg" \
  -H "Authorization: Bearer YOUR_IAT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"client_name":"Test Client","grant_types":["client_credentials"],"scope":"mcp:read"}'
```

### Health Checks

```bash
# Check API server health
curl http://localhost:3001/health

# Check Auth server health
curl http://localhost:4000/health

# Check OIDC discovery
curl http://localhost:4000/.well-known/openid_configuration
```

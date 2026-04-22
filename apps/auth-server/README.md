# EnsureOS Auth Server

Express-based OAuth 2.1/OIDC Authorization Server with MCP compliance, Dynamic Client Registration, and Initial Access Token support.

## Overview

This is a comprehensive OAuth 2.1/OpenID Connect authorization server built with Express.js that provides authentication and authorization services for the EnsureOS product. It supports both user authentication and machine-to-machine (M2M) client registration with Initial Access Tokens (IAT) for autonomous client onboarding.

## Key Features

### 🔐 **OAuth 2.1/OIDC Compliance**
- Full OAuth 2.1 and OpenID Connect 1.0 implementation
- Standards-compliant endpoints and flows
- PKCE enforcement for authorization code flows
- JWT token issuance with custom claims

### 🤖 **Machine-to-Machine (M2M) Support**
- Dynamic Client Registration (DCR) with IAT support
- Client Credentials grant type
- Tenant-scoped M2M client management
- Role and feature-based access control

### 🔑 **Initial Access Token (IAT) System**
- Self-serve client registration for autonomous MCP clients
- Policy-constrained token issuance
- Tenant isolation and authorization
- Short-lived tokens (10 minutes) for security

### 🌐 **Authentication Methods**
- Google OAuth integration
- Email/password authentication via backend API
- Session management with Redis
- Multi-tenant support

### 🛡️ **Security & Compliance**
- Rate limiting on all endpoints
- Security headers (Helmet.js)
- CORS configuration
- Comprehensive audit logging
- JWT signing and validation

## Quick Start

### 1. Prerequisites

- Node.js 18+ (for built-in fetch support)
- pnpm package manager
- Redis instance (Upstash or local)
- Backend API server for user authentication

For local development with shared infra, start `infra` first (Redis is exposed on `localhost:3250`).

### 2. Installation

```bash
# Install dependencies
pnpm install

# Copy environment template
cp env.template .env
```

### 3. Environment Configuration

Edit `.env` with your configuration:

```bash
# Core Configuration
OIDC_ISSUER=https://auth.yourdomain.com
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long
NODE_ENV=development
PORT=4000
HOST=0.0.0.0

# Redis Configuration (shared infra Redis)
REDIS_PROVIDER=self-hosted
REDIS_HOST=localhost
REDIS_PORT=3250

# OIDC Client Configuration
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
OIDC_REDIRECT_URI=https://your-app.com/api/auth/oidc/callback

# Backend API Integration
MOREZERO_KOTLIN_API_URL=https://your-backend-api.com

# IAT Configuration (for M2M client registration)
DCR_IAT_SIGNING_KEY=your-base64-encoded-iat-signing-key
DYNAMIC_REGISTRATION_SECRET=your-dcr-secret

# CORS Configuration
CORS_ORIGINS=https://your-app.com,https://your-console.com

# Google OAuth (Optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

BASE_URL=https://YOUR_DOMAIN             # e.g. http://localhost:3000 in dev
```

### 4. Generate IAT Signing Key

```bash
# Generate a secure 32-byte key and encode as base64
openssl rand -base64 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 6. Start the Server

```bash
# Development mode with hot reload
pnpm start:dev

# Production mode
pnpm build
pnpm start
```

## API Endpoints

### 🔍 **Discovery Endpoints**

- `GET /.well-known/openid-configuration` - OIDC discovery
- `GET /.well-known/oauth-authorization-server` - OAuth discovery

### 🔐 **Authentication Endpoints**

- `GET /auth` - Authorization endpoint
- `POST /token` - Token endpoint
- `GET /userinfo` - User info endpoint
- `GET /jwks` - JSON Web Key Set
- `POST /token/introspection` - Token introspection
- `POST /token/revocation` - Token revocation

### 👤 **User Authentication**

- `GET /interaction/:uid` - Login page
- `POST /interaction/:uid/login` - Password login
- `POST /logout` - Logout

### 🤖 **M2M Client Registration**

- `POST /reg` - Dynamic Client Registration
- `POST /oauth/initial-access-token` - Issue IAT for client registration
- `POST /oauth/validate-iat` - Validate IAT token

### 🛠️ **Utility Endpoints**

- `GET /health` - Health check
- `GET /` - Server information and available endpoints

## IAT (Initial Access Token) System

The IAT system enables autonomous MCP clients to register themselves without manual intervention:

### Architecture

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

### IAT Flow

1. **Get IAT**: Authenticated user requests IAT from `/oauth/initial-access-token`
2. **Register Client**: MCP client uses IAT to register at `/reg`
3. **Get Tokens**: Registered client exchanges credentials for access tokens

### IAT Token Payload

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
  "iss": "https://auth.yourdomain.com",
  "aud": "https://auth.yourdomain.com/reg"
}
```

## Development

### Scripts

- `pnpm start:dev` - Start with hot reload
- `pnpm start:watch` - Start with nodemon
- `pnpm build` - Build TypeScript
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint
- `pnpm test` - Run tests

### Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:cov

# Test IAT functionality
.\test\test-iat.ps1
```

### Setup IAT System

```bash
# Run the IAT setup script
.\scripts\setup-iat.ps1
```

## Architecture

```
src/
├── config/
│   ├── env-validation.ts      # Environment validation
│   ├── oidc-provider.ts       # OIDC provider configuration
│   └── upstash-adapter.ts     # Redis adapter
├── middleware/
│   ├── security.ts            # Security headers
│   ├── rate-limiting.ts       # Rate limiting
│   ├── error-handling.ts      # Error handling
│   └── audit-logging.ts       # Request logging
├── routes/
│   ├── auth-routes.ts         # Authentication routes
│   ├── oidc-routes.ts         # OIDC routes
│   ├── oauth-discovery.ts     # OAuth discovery
│   └── iat-routes.ts          # IAT routes
├── services/
│   ├── backend-service.ts     # Backend API integration
│   └── jwt-service.ts         # JWT utilities
├── docs/
│   └── IAT_IMPLEMENTATION.md  # IAT documentation
├── examples/
│   └── iat-usage-example.ts   # IAT usage examples
├── scripts/
│   └── setup-iat.ps1          # IAT setup script
└── server.ts                  # Main server file
```

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `OIDC_ISSUER` | OAuth issuer URL | `https://auth.yourdomain.com` |
| `JWT_SECRET` | JWT signing secret (32+ chars) | `your-super-secret-key` |
| `REDIS_PROVIDER` | Redis provider | `self-hosted` |
| `REDIS_HOST` | Redis host (self-hosted) | `localhost` |
| `REDIS_PORT` | Redis port (self-hosted) | `3250` |
| `OIDC_CLIENT_ID` | OIDC client ID | `your-client-id` |
| `OIDC_CLIENT_SECRET` | OIDC client secret | `your-client-secret` |
| `OIDC_REDIRECT_URI` | OIDC redirect URI | `https://app.com/callback` |
| `MOREZERO_KOTLIN_API_URL` | Backend API URL | `https://api.yourdomain.com` |
| `BASE_URL` | Base URL for redirects | `https://auth.yourdomain.com` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DCR_IAT_SIGNING_KEY` | IAT signing key (base64) | Generated |
| `DYNAMIC_REGISTRATION_SECRET` | DCR protection secret | Generated |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | - |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret | - |
| `CORS_ORIGINS` | Allowed CORS origins | `*` |
| `NODE_ENV` | Environment | `development` |
| `PORT` | Server port | `4000` |

## Security Features

- **Rate Limiting**: Per-endpoint rate limiting with configurable limits
- **Security Headers**: Helmet.js security headers
- **CORS**: Configurable CORS policy
- **Input Validation**: Request validation and sanitization
- **Audit Logging**: Comprehensive request/response logging
- **JWT Security**: Secure JWT signing and validation
- **IAT Security**: Short-lived tokens with policy constraints

## Monitoring

The server includes comprehensive logging and monitoring:

- Request/response logging with structured data
- Error tracking and reporting
- Performance metrics
- Health check endpoint
- Audit trail for all operations

## Deployment

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 4000
CMD ["npm", "start"]
```

### Production Checklist

1. ✅ Set all required environment variables
2. ✅ Ensure Redis is accessible and configured
3. ✅ Configure CORS origins for your clients
4. ✅ Set up SSL/TLS for production
5. ✅ Generate secure IAT signing key
6. ✅ Configure rate limiting appropriately
7. ✅ Set up monitoring and alerting

## Troubleshooting

### Common Issues

1. **OIDC Provider Not Found**: Check Redis connection
2. **Authentication Failures**: Verify backend URL configuration
3. **CORS Errors**: Update CORS_ORIGINS environment variable
4. **Rate Limiting**: Check rate limit configuration
5. **IAT Issues**: Verify DCR_IAT_SIGNING_KEY is set and valid

### Debug Mode

Set `NODE_ENV=development` for detailed logging.

### Health Check

```bash
curl http://localhost:4000/health
```

## Documentation

- [IAT Implementation Guide](docs/IAT_IMPLEMENTATION.md) - Complete IAT documentation
- [Usage Examples](examples/iat-usage-example.ts) - Code examples
- [Test Scripts](test/) - Testing utilities

## License

Same as the main project.

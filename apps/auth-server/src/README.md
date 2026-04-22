# Auth Server Architecture

## Overview

The `server.ts` file is the main entry point for the EnsureOS Auth Server, implementing a comprehensive OAuth 2.0/OIDC authentication server using Express.js and the `oidc-provider` library. This document explains the design decisions, architecture patterns, and middleware ordering that make this server production-ready.

## Architecture Design

### 1. **Modular Structure**

The server follows a modular architecture with clear separation of concerns:

```
server.ts
├── Imports (External, Internal - Logging, Routes, Middleware)
├── Constants & Configuration
├── Server Creation & Configuration
├── Route Mounting Functions
├── Server Startup & Lifecycle Management
└── Application Entry Point
```

### 2. **Middleware Pipeline Design**

The middleware pipeline follows Express.js best practices and OIDC provider requirements:

```typescript
// 1. Environment Validation
validateAuthServerEnvironment()

// 2. Express Configuration
app.set('trust proxy', 1)
app.set('view engine', 'ejs')

// 3. Proxy Header Middleware
// Fixes headers for OIDC provider in proxy environments

// 4. Security Middleware (Early)
helmetMiddleware()
securityHeaders
generalRateLimit

// 5. CORS Configuration
cors({ origin: getCorsOrigins(), credentials: true })

// 6. Session & Cookie Middleware
cookieParser()
session({ ... })

// 7. Body Parsing Middleware
express.json()
express.urlencoded({ extended: true })

// 8. Audit Logging & Static Files
auditLogging
express.static()

// 9. Basic Endpoints
/health, /

// 10. Route Mounting
mountRoutes()

// 11. Additional Body Parsing (for OIDC)
express.json({ limit: '10mb' })

// 12. Error Handling (Last)
notFoundHandler
errorHandler
```

## Design Principles

### 1. **Security-First Approach**

- **Early Security Middleware**: Security headers and rate limiting are applied before any request processing
- **CORS Before Authentication**: CORS is configured before any authentication middleware to prevent CORS issues
- **Session Security**: Secure session configuration with environment-based security settings

### 2. **OIDC Provider Integration**

- **Session Requirements**: OIDC provider requires sessions to be available before mounting
- **Body Parsing**: Multiple body parsing middleware layers to handle different request types
- **Proxy Headers**: Special handling for proxy environments to ensure proper OIDC functionality

### 3. **Middleware Ordering**

The middleware order is critical and follows these principles:

1. **Security First**: Apply security measures before processing requests
2. **CORS Before Auth**: Configure CORS before any authentication middleware
3. **Session Before OIDC**: Sessions must be available before OIDC provider
4. **Body Parsing Before Routes**: Ensure request bodies are parsed before route handlers
5. **Error Handling Last**: Error handlers must be the final middleware in the chain

### 4. **Route Mounting Strategy**

Routes are mounted in a specific order to ensure proper functionality:

```typescript
// 1. Custom Authentication Routes
createAuthRoutes(app, provider, jwtService)

// 2. Custom Token Endpoint (Debugging)
app.post('/token', ...)

// 4. OIDC Provider (Standard OAuth/OIDC endpoints)
app.use(provider.callback())

// 5. OAuth Discovery Routes (after OIDC provider)
createOAuthDiscoveryRoutes(app, provider)

// 6. IAT Routes (Dynamic Client Registration)
createIatRoutes(app)
```

## Key Components

### 1. **Environment Validation**

```typescript
if (!validateAuthServerEnvironment()) {
   log.error({ validationFailed: true }, 'Environment validation failed');
   process.exit(1);
}
```

- Validates all required environment variables before server startup
- Prevents server startup with missing configuration
- Provides clear error messages for debugging

### 2. **OIDC Provider Initialization**

```typescript
let provider: any;
try {
   provider = await createOidcProvider();
   log.info({ providerCreated: true, issuer: provider.issuer }, 'OIDC provider created successfully');
} catch (error) {
   log.error({ error: error.message }, 'Failed to create OIDC provider');
   process.exit(1);
}
```

- Asynchronous provider creation with error handling
- Comprehensive logging for debugging
- Graceful failure with proper error messages

### 3. **Proxy Header Middleware**

```typescript
app.use((req, res, next) => {
   // Fix host header for OIDC provider in proxy environments
   if (req.headers['x-forwarded-host']) {
      const forwardedHost = Array.isArray(req.headers['x-forwarded-host'])
         ? req.headers['x-forwarded-host'][0]
         : req.headers['x-forwarded-host'];
      req.headers.host = forwardedHost;
   }
   // ... additional proxy header handling
});
```

- Essential for OIDC provider functionality in proxy environments
- Handles various proxy header formats
- Ensures proper host resolution for OIDC endpoints

### 4. **Route Mounting Function**

The `mountRoutes()` function encapsulates all route mounting logic:

- **Service Initialization**: Creates shared service instances to avoid multiple initializations
- **Route Grouping**: Groups related routes together with clear logging
- **Debugging Support**: Comprehensive logging for route mounting process

### 5. **Error Handling Strategy**

```typescript
// 404 handler
app.use(notFoundHandler);

// Error handling middleware (must be last)
app.use(errorHandler);
```

- **404 Handler**: Handles requests to non-existent routes
- **Error Handler**: Catches and processes all unhandled errors
- **Last Middleware**: Error handlers must be the final middleware in the chain

## Configuration Management

### 1. **Environment Variables**

The server uses a centralized configuration approach:

```typescript
const serverConfig = getServerConfig();
const corsOrigins = getCorsOrigins();
```

- **Centralized Configuration**: All configuration is managed through dedicated functions
- **Environment Validation**: Ensures all required variables are present
- **Type Safety**: Configuration functions provide type-safe access to settings

### 2. **Session Configuration**

```typescript
app.use(session({
   secret: process.env.JWT_SECRET,
   resave: false,
   saveUninitialized: false,
   cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
   }
}));
```

- **Environment-Based Security**: Different security settings for development/production
- **Secure Cookies**: HTTP-only cookies with appropriate security flags
- **Session Management**: Proper session configuration for OIDC provider

## Logging Strategy

### 1. **Structured Logging**

```typescript
const log = createLogger('auth-server:server', LoggerType.NODEJS);

log.info({
   host: serverConfig.host,
   port: serverConfig.port,
   url: `http://${serverConfig.host}:${serverConfig.port}`,
   version,
   oidcIssuer: serverConfig.oidcIssuer,
   environment: nodeEnv,
   isProduction: nodeEnv === 'production'
}, 'EnsureOS Auth Server is running');
```

- **Structured Data**: All log messages include relevant context data
- **Consistent Format**: Uniform logging format across all components
- **Debug Information**: Comprehensive debugging information for troubleshooting

### 2. **Request Logging (Optional)**

The server includes commented-out comprehensive request logging middleware:

```typescript
/*
// Comprehensive OAuth/OIDC request logging middleware
app.use((req, res, next) => {
   // Logs all OAuth/OIDC requests with detailed information
   // Includes request body, headers, and response data
});
*/
```

- **Debugging Support**: Detailed request logging for OAuth/OIDC flows
- **Security Considerations**: Sensitive data is redacted in logs
- **Optional Feature**: Can be enabled for debugging purposes

## Production Considerations

### 1. **Graceful Shutdown**

```typescript
const gracefulShutdown = (signal: string) => {
   log.debug({ signal, action: 'graceful_shutdown' }, 'Signal received, shutting down gracefully');
   server.close(() => {
      process.exit(0);
   });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

- **Signal Handling**: Proper handling of shutdown signals
- **Graceful Closure**: Allows server to finish processing requests before shutdown
- **Logging**: Comprehensive logging of shutdown process

### 2. **Error Recovery**

```typescript
try {
   const app = await createServer();
   // ... server startup
} catch (error) {
   log.error({ 
      error: error.message, 
      stack: error.stack 
   }, 'Failed to start server');
   process.exit(1);
}
```

- **Comprehensive Error Handling**: All errors are caught and logged
- **Stack Traces**: Full stack traces for debugging
- **Graceful Failure**: Server exits cleanly on startup errors

### 3. **Performance Considerations**

- **Service Reuse**: Shared service instances to avoid multiple initializations
- **Efficient Middleware**: Middleware is ordered for optimal performance
- **Memory Management**: Proper cleanup and resource management

## Development Features

### 1. **Debug Endpoints**

- **Health Check**: `/health` endpoint for monitoring
- **Home Page**: `/` endpoint with server information and available endpoints
- **Route Debugging**: Comprehensive route listing for development

### 2. **Development Logging**

- **Environment Information**: Detailed environment logging
- **Endpoint Testing**: Automatic endpoint testing on startup
- **Route Registration**: Debug information for all registered routes

## Security Features

### 1. **Security Headers**

- **Helmet Middleware**: Comprehensive security headers
- **Custom Security Headers**: Additional security measures
- **CORS Configuration**: Proper CORS setup for cross-origin requests

### 2. **Rate Limiting**

- **General Rate Limiting**: Applied to all requests
- **Specific Rate Limiting**: Commented-out specific rate limiting for auth endpoints
- **Configurable Limits**: Rate limits can be configured per endpoint type

### 3. **Input Validation**

- **Body Parsing**: Proper body parsing with size limits
- **Request Validation**: Input validation through middleware
- **Error Handling**: Comprehensive error handling for invalid requests

## Conclusion

The `server.ts` file implements a production-ready OAuth 2.0/OIDC authentication server with:

- **Security-First Design**: Comprehensive security measures throughout
- **OIDC Compliance**: Full compliance with OIDC provider requirements
- **Production Readiness**: Graceful shutdown, error handling, and monitoring
- **Development Support**: Extensive debugging and logging capabilities
- **Maintainable Code**: Clear structure and comprehensive documentation

The architecture follows Express.js best practices and OIDC provider requirements, ensuring both security and functionality while maintaining code readability and maintainability.

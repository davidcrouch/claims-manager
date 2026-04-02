// ============================================================================
// EXTERNAL IMPORTS
// ============================================================================
import express, { Application } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ============================================================================
// INTERNAL IMPORTS - LOGGING & CONFIGURATION
// ============================================================================
import { createLogger, LoggerType } from './lib/logger.js';
import { startTelemetry, createTelemetryLogger } from '@morezero/telemetry';
import { trace, context, SpanStatusCode, propagation } from '@opentelemetry/api';
import { GlobalCacheManager } from './lib/cache/global-cache-manager.js';
import { validateAuthServerEnvironment, getServerConfig, getCorsOrigins, getServiceName, getServiceVersion, getRedisConfig } from './config/env-validation.js';
import { createOidcProvider } from './config/oidc-provider.js';

// ============================================================================
// INTERNAL IMPORTS - ROUTES
// ============================================================================
import createAuthRoutes from './routes/auth-routes.js';
import createOAuthDiscoveryRoutes from './routes/oauth-discovery.js';
import createIatRoutes from './routes/iat-routes.js';
import createTokenExchangeRoutes from './routes/token-exchange-routes.js';
import createGoogleRoutes from './routes/google-routes.js';
import createSignupRoutes from './routes/signup-routes.js';
import createClientRoutes from './routes/client-routes.js';

// ============================================================================
// INTERNAL IMPORTS - MIDDLEWARE
// ============================================================================
import { securityHeaders, helmetMiddleware } from './middleware/security.js';
import { generalRateLimit, authRateLimit, oauthRateLimit, tokenRateLimit } from './middleware/rate-limiting.js';
import { auditLogging } from './middleware/audit-logging.js';
import { errorHandler, notFoundHandler } from './middleware/error-handling.js';

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: '.env' });

// Increase max listeners to prevent EventEmitter memory leak warnings
// TODO: Investigate and fix the root cause of multiple event listeners
process.setMaxListeners(20);

// Logger instance with telemetry context
const baseLogger = createLogger('auth-server:server', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'server', 'Server', 'auth-server');

// Service configuration with validation
const serviceName = getServiceName();
const serviceVersion = getServiceVersion();
const serviceEnvironment = process.env.NODE_ENV || 'development';


// ============================================================================
// SERVER CREATION & CONFIGURATION
// ============================================================================

async function createServer(): Promise<Application> {
   const tracer = trace.getTracer('server', '1.0.0');

   return tracer.startActiveSpan('createServer', {
      attributes: {
         'server.operation': 'create',
         'server.environment': process.env.NODE_ENV || 'development'
      }
   }, async (span) => {
      // ========================================================================
      // ENVIRONMENT VALIDATION
      // ========================================================================
      if (!validateAuthServerEnvironment()) {
         span.setAttributes({ 'server.validation_failed': true });
         span.setStatus({ code: SpanStatusCode.ERROR, message: 'Environment validation failed' });
         process.exit(1);
      }

      const app = express();
      const serverConfig = getServerConfig();

      // ========================================================================
      // OIDC PROVIDER INITIALIZATION
      // ========================================================================
      let provider: any;
      try {
         provider = await createOidcProvider();
         span.setAttributes({ 'server.oidc_provider_created': true, 'server.oidc_issuer': provider.issuer });
      } catch (error) {
         span.recordException(error);
         span.setAttributes({ 'server.oidc_provider_created': false, 'server.oidc_error': error.message });
         span.setStatus({ code: SpanStatusCode.ERROR, message: 'Failed to create OIDC provider' });
         process.exit(1);
      }

      // ========================================================================
      // EXPRESS CONFIGURATION
      // ========================================================================
      app.set('trust proxy', 1);
      app.set('view engine', 'ejs');
      app.set('views', join(__dirname, '..', 'views'));

      // ========================================================================
      // PROXY HEADER MIDDLEWARE
      // ========================================================================
      //
      //  TODO: The code many not be required anymore after design modifications to OIDC provider
      //
      /*
      app.use((req, res, next) => {
         // Fix host header for OIDC provider in proxy environments
         if (req.headers['x-forwarded-host']) {
            const forwardedHost = Array.isArray(req.headers['x-forwarded-host'])
               ? req.headers['x-forwarded-host'][0]
               : req.headers['x-forwarded-host'];
            req.headers.host = forwardedHost;
         }
   
         // Ensure proxy headers are present for OIDC provider
         if (!req.headers['x-forwarded-proto']) {
            req.headers['x-forwarded-proto'] = req.secure ? 'https' : 'http';
         }
         if (!req.headers['x-forwarded-host']) {
            req.headers['x-forwarded-host'] = req.get('host');
         }
         if (!req.headers['x-forwarded-for']) {
            req.headers['x-forwarded-for'] = req.ip;
         }
   
         next();
      });
   */

      // ========================================================================
      // SECURITY MIDDLEWARE
      // ========================================================================
      app.use(helmetMiddleware());
      app.use(securityHeaders);
      app.use(generalRateLimit);

      // ========================================================================
      // CORS CONFIGURATION
      // ========================================================================
      app.use(cors({
         origin: getCorsOrigins(),
         credentials: true
      }));

      // ========================================================================
      // TRACE CONTEXT EXTRACTION
      // ========================================================================
      app.use((req, res, next) => {
         try {
            const extractedContext = propagation.extract(context.active(), req.headers);
            context.with(extractedContext, () => {
               next();
            });
         } catch (error) {
            // If trace extraction fails, continue without trace context
            next();
         }
      });

      // ========================================================================
      // COOKIE MIDDLEWARE (Cookie parser needed for OIDC provider)
      // ========================================================================
      app.use(cookieParser());

      // Note: Express sessions removed - OIDC provider manages its own sessions via Redis

      // ========================================================================
      // BODY PARSING MIDDLEWARE
      // NOTE: Intentionally deferred until after mounting oidc-provider to avoid
      //       upstream body parsing on provider endpoints (e.g., /token)
      // ========================================================================


      // ========================================================================
      // AUDIT LOGGING & STATIC FILES
      // ========================================================================
      app.use(auditLogging);
      app.use(express.static(join(__dirname, '..', 'public')));

      // ========================================================================
      // BASIC ENDPOINTS (Health check and home page)
      // ========================================================================
      app.get('/health', (req, res) => {
         res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: getServiceVersion(),
            uptime: process.uptime()
         });
      });

      app.get('/', (req, res) => {
         const baseUrl = `${req.protocol}://${req.get('host')}`;

         res.render('home', {
            title: 'MoreZero Auth Server',
            health: {
               status: 'ok',
               uptime: process.uptime(),
               environment: process.env.NODE_ENV || 'development',
               version: getServiceVersion(),
               service: 'auth-server'
            },
            endpoints: {
               health: `${baseUrl}/health`,
               oidc: `${baseUrl}/.well-known/openid-configuration`,
               oauth: `${baseUrl}/.well-known/oauth-authorization-server`,
               auth: `${baseUrl}/authorize`,
               token: `${baseUrl}/token`,
               tokenExchange: `${baseUrl}/token/exchange`,
               userinfo: `${baseUrl}/userinfo`,
               reg: `${baseUrl}/register`,
               iat: `${baseUrl}/oauth/initial-access-token`,
               validateIat: `${baseUrl}/oauth/validate-iat`
            }
         });
      });

      // ========================================================================
      // RATE LIMITING - TOKEN EXCHANGE SECURITY
      // ========================================================================
      // Apply specific rate limiting to auth endpoints
      //  app.use('/login/google', oauthRateLimit); // More lenient for OAuth flows
      //  app.use('/login', authRateLimit);
      //  app.use('/consent', authRateLimit);
      //  app.use('/token', tokenRateLimit);
      //  app.use('/api/auth/exchange', oauthRateLimit); // More lenient for token exchange

      // ========================================================================
      // BODY PARSING MIDDLEWARE (must be BEFORE routes that need req.body)
      // ========================================================================
      app.use(express.json({ limit: '10mb' }));
      app.use(express.urlencoded({ extended: true, limit: '10mb' }));

      // ========================================================================
      // ROUTE MOUNTING
      // ========================================================================
      await mountRoutes(app, provider);

      // ========================================================================
      // ROUTE DEBUGGING (List all registered routes for development)
      // ========================================================================
      // Routes are registered and ready

      // ========================================================================
      // ERROR HANDLING MIDDLEWARE (404 handler and error handler - must be last)
      // ========================================================================
      app.use(notFoundHandler);
      app.use(errorHandler);

      span.setAttributes({ 'server.routes_mounted': true, 'server.middleware_configured': true });
      span.setStatus({ code: SpanStatusCode.OK });

      return app;
   });
}

// ============================================================================
// ROUTE MOUNTING FUNCTIONS
// ============================================================================

async function mountRoutes(app: Application, provider: any): Promise<void> {
   const tracer = trace.getTracer('server', '1.0.0');

   return tracer.startActiveSpan('mountRoutes', {
      attributes: {
         'server.operation': 'mount_routes',
         'server.has_provider': !!provider
      }
   }, async (span) => {
      // ========================================================================
      // AUTHENTICATION ROUTES (Create shared service instances to avoid multiple initializations)
      // ========================================================================
      const { JwtService } = await import('./services/jwt-service.js');
      const jwtService = new JwtService();

      createAuthRoutes(app, provider, jwtService);

      // ========================================================================
      // GOOGLE OAUTH ROUTES (Google OAuth 2.0 authentication)
      // ========================================================================
      createGoogleRoutes(app, provider);

      // ========================================================================
      // SIGNUP ROUTES (Application signup - forwards to api-server with subdomain context)
      // ========================================================================
      createSignupRoutes(app);

      // ========================================================================
      // IAT & CLIENT ROUTES (Mount BEFORE OIDC provider so they are not 404'd)
      // ========================================================================
      createIatRoutes(app);
      createClientRoutes(app, provider);

      // ========================================================================
      // OIDC PROVIDER MOUNTING (Mount OIDC provider at root after body parsing middleware)
      // ========================================================================
      app.use((req, res, next) => {
         if (req.path.startsWith('/authorize') || req.path.startsWith('/interaction')) {
            log.info({
               method: req.method,
               path: req.path,
               cookies: Object.keys(req.cookies || {}),
               rawCookie: req.headers.cookie ? req.headers.cookie.substring(0, 200) : '(missing)',
               origin: req.headers.origin || '(none)',
               referer: req.headers.referer || '(none)',
            }, 'auth-server:server - Request reaching OIDC provider');
         }
         next();
      });
      app.use(provider.callback());

      // ========================================================================
      // OAUTH DISCOVERY ROUTES (must be after OIDC provider)
      // ========================================================================
      createOAuthDiscoveryRoutes(app, provider);

      // ========================================================================
      // TOKEN EXCHANGE ROUTES (OAuth 2.0 Token Exchange - RFC 8693)
      // ========================================================================
      createTokenExchangeRoutes(app, provider);

      span.setAttributes({ 'server.routes_mounted': true });
      span.setStatus({ code: SpanStatusCode.OK });
   });
}

// ============================================================================
// SERVER STARTUP & LIFECYCLE MANAGEMENT
// ============================================================================

async function startServer(): Promise<void> {
   const tracer = trace.getTracer('server', '1.0.0');

   return tracer.startActiveSpan('startServer', {
      attributes: {
         'server.operation': 'start',
         'server.environment': process.env.NODE_ENV || 'development',
         'server.service_name': serviceName
      }
   }, async (span) => {
      try {
         // Start telemetry before creating the server
         try {
            await startTelemetry({
               serviceName: serviceName,
               serviceVersion: serviceVersion,
               environment: serviceEnvironment,
               enabled: process.env.OTEL_SDK_DISABLED !== 'true'
            });

            span.setAttributes({ 'server.telemetry_initialized': true });
         } catch (error) {
            log.error({ functionName: 'createServer', error: error.message }, 'Failed to initialize telemetry');
            span.setAttributes({ 'server.telemetry_initialized': false, 'server.telemetry_error': error.message });
            // Continue without telemetry rather than crashing
         }

         // Initialize GlobalCacheManager for Redis connections
         try {
            const redisConfig = getRedisConfig();
            await GlobalCacheManager.initialize(redisConfig);

            log.info({
               functionName: 'startServer',
               redisInitialized: true,
               purpose: 'global_cache_connection',
               redisProvider: redisConfig.provider
            }, 'Global cache manager initialized successfully');
            
            span.setAttributes({ 'server.cache_initialized': true });
         } catch (error) {
            log.error({ functionName: 'startServer', error: error.message }, 'Failed to initialize global cache manager');
            span.setAttributes({ 'server.cache_initialized': false, 'server.cache_error': error.message });
            throw error; // Don't continue without cache - it's required
         }

         const app = await createServer();
         const serverConfig = getServerConfig();
         const version = serviceVersion;
         const nodeEnv = process.env.NODE_ENV || 'development';

         const server = app.listen(serverConfig.port, serverConfig.host, () => {
            log.info({
               functionName: 'startServer',
               host: serverConfig.host,
               port: serverConfig.port,
               url: `http://${serverConfig.host}:${serverConfig.port}`,
               version,
               oidcIssuer: serverConfig.oidcIssuer,
               environment: nodeEnv,
               isProduction: nodeEnv === 'production'
            }, 'MoreZero Auth Server is running');

            // Server is running successfully
         });

         // Graceful shutdown
         const gracefulShutdown = (signal: string) => {
            log.debug({
               functionName: 'gracefulShutdown',
               signal,
               action: 'graceful_shutdown'
            }, 'Signal received, shutting down gracefully');
            server.close(() => {
               process.exit(0);
            });
         };

         process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
         process.on('SIGINT', () => gracefulShutdown('SIGINT'));

         span.setAttributes({ 'server.started': true, 'server.port': serverConfig.port });
         span.setStatus({ code: SpanStatusCode.OK });

      } catch (error) {
         log.error({ functionName: 'startServer', error: error.message, stack: error.stack }, 'Failed to start server');
         span.recordException(error);
         span.setAttributes({ 'server.started': false, 'server.error': error.message });
         span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
         process.exit(1);
      } finally {
         span.end();
      }
   });
}

// Start the server
startServer();

export { createServer, startServer };
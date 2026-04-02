import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';
import { createLogger, LoggerType } from '../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';

const baseLogger = createLogger('auth-server:security-middleware', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'security-middleware', 'SecurityMiddleware', 'auth-server');

export function securityHeaders(req: Request, res: Response, next: NextFunction) {
   log.debug({ functionName: 'securityHeaders', path: req.path, method: req.method }, 'Applying security headers');

   // Set security headers
   res.setHeader('X-Content-Type-Options', 'nosniff');
   res.setHeader('X-Frame-Options', 'DENY');
   res.setHeader('X-XSS-Protection', '1; mode=block');
   res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
   res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

   // Set CSP header
   res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none';"
   );

   next();
}

export function helmetMiddleware() {
   return helmet({
      contentSecurityPolicy: {
         directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            fontSrc: ["'self'", "data:"],
            connectSrc: ["'self'", "https:"],
            frameAncestors: ["'none'"],
         },
      },
      hsts: {
         maxAge: 31536000,
         includeSubDomains: true,
         preload: true,
      },
   });
}

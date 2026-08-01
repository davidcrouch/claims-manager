import { randomBytes } from 'crypto';
import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';
import { createLogger, LoggerType } from '../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';

const baseLogger = createLogger('auth-server:security-middleware', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'security-middleware', 'SecurityMiddleware', 'auth-server');

export function securityHeaders(req: Request, res: Response, next: NextFunction) {
   log.debug({ functionName: 'securityHeaders', path: req.path, method: req.method }, 'auth-server:security-middleware:securityHeaders - Applying security headers');

   const nonce = randomBytes(16).toString('base64');
   res.locals.cspNonce = nonce;

   res.setHeader('X-Content-Type-Options', 'nosniff');
   res.setHeader('X-Frame-Options', 'DENY');
   res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
   res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

   res.setHeader(
      'Content-Security-Policy',
      `default-src 'self'; script-src 'nonce-${nonce}' 'strict-dynamic'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self'; frame-ancestors 'none'; base-uri 'self';`
   );

   next();
}

export function helmetMiddleware() {
   const isProd = process.env.NODE_ENV === 'production';
   return helmet({
      contentSecurityPolicy: false,
      hsts: isProd
         ? {
              maxAge: 31536000,
              includeSubDomains: true,
              preload: true,
           }
         : false,
   });
}

import { Request, Response, NextFunction } from 'express';
import { createLogger, LoggerType } from '../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';

const baseLogger = createLogger('auth-server:audit-logging', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'audit-logging', 'AuditLogging', 'auth-server');

export function auditLogging(req: Request, res: Response, next: NextFunction) {
   const startTime = Date.now();
   const originalSend = res.send;

   // Override res.send to capture response details
   res.send = function(body) {
      const duration = Date.now() - startTime;
      
      // Log the request and response
      log.info({
         method: req.method,
         path: req.path,
         query: req.query,
         statusCode: res.statusCode,
         duration: `${duration}ms`,
         ip: req.ip,
         userAgent: req.get('User-Agent'),
         contentLength: res.get('Content-Length') || 0,
         timestamp: new Date().toISOString()
      }, 'HTTP Request completed');

      // Call the original send method
      return originalSend.call(this, body);
   };

   next();
}

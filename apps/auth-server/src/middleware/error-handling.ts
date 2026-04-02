import { Request, Response, NextFunction } from 'express';
import { createLogger, LoggerType } from '../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';

const baseLogger = createLogger('auth-server:error-handling', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'error-handling', 'ErrorHandler', 'auth-server');

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
   const tracer = trace.getTracer('error-handling', '1.0.0');
   
   return tracer.startActiveSpan('errorHandler', {
      attributes: {
         'error.name': err.name,
         'error.message': err.message,
         'error.path': req.path,
         'error.method': req.method,
         'error.ip': req.ip || '',
         'error.user_agent': req.get('User-Agent') || '',
         'error.headers_sent': res.headersSent
      }
   }, (span) => {
      log.error({
         functionName: 'errorHandler',
         error: err.message,
         stack: err.stack,
         path: req.path,
         method: req.method,
         ip: req.ip,
         userAgent: req.get('User-Agent'),
         body: req.body,
         query: req.query,
         params: req.params,
         headers: req.headers,
         fullError: err
      }, 'Unhandled error occurred - DETAILED');

      // Don't leak error details in production
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      if (res.headersSent) {
         span.setAttributes({ 'error.headers_sent': true });
         span.setStatus({ code: SpanStatusCode.ERROR, message: 'Headers already sent' });
         return next(err);
      }

      // Handle specific error types
      if (err.name === 'ValidationError') {
         span.setAttributes({ 'error.type': 'validation_error' });
         span.setStatus({ code: SpanStatusCode.ERROR, message: 'Validation error' });
         return res.status(400).json({
            error: 'invalid_request',
            error_description: 'Invalid request parameters'
         });
      }

      if (err.name === 'SessionNotFound') {
         span.setAttributes({ 'error.type': 'session_not_found' });
         span.setStatus({ code: SpanStatusCode.ERROR, message: 'Session not found' });
         return res.status(400).json({
            error: 'invalid_request',
            error_description: 'Session not found or expired. Please try again.'
         });
      }

      if (err.name === 'UnauthorizedError') {
         span.setAttributes({ 'error.type': 'unauthorized' });
         span.setStatus({ code: SpanStatusCode.ERROR, message: 'Unauthorized' });
         return res.status(401).json({
            error: 'unauthorized',
            error_description: 'Authentication required'
         });
      }

      if (err.name === 'ForbiddenError') {
         span.setAttributes({ 'error.type': 'forbidden' });
         span.setStatus({ code: SpanStatusCode.ERROR, message: 'Forbidden' });
         return res.status(403).json({
            error: 'forbidden',
            error_description: 'Access denied'
         });
      }

      // Default error response
      span.setAttributes({ 'error.type': 'server_error', 'error.is_development': isDevelopment });
      span.setStatus({ code: SpanStatusCode.ERROR, message: 'Server error' });
      
      res.status(500).json({
         error: 'server_error',
         error_description: isDevelopment ? err.message : 'Internal server error'
      });
      
      span.end();
   });
}

export function notFoundHandler(req: Request, res: Response) {
   const tracer = trace.getTracer('error-handling', '1.0.0');
   
   return tracer.startActiveSpan('notFoundHandler', {
      attributes: {
         'not_found.path': req.path,
         'not_found.method': req.method,
         'not_found.ip': req.ip || '',
         'not_found.user_agent': req.get('User-Agent') || ''
      }
   }, (span) => {
      log.warn({
         functionName: 'notFoundHandler',
         path: req.path,
         method: req.method,
         ip: req.ip
      }, 'Route not found');

      span.setStatus({ code: SpanStatusCode.ERROR, message: 'Route not found' });
      
      res.status(404).json({
         error: 'not_found',
         error_description: 'The requested resource was not found'
      });
      
      span.end();
   });
}

import { Request, Response, NextFunction } from 'express';
import { trace, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('auth-server-http', '1.0.0');

export function httpTracingMiddleware() {
   return (req: Request, res: Response, next: NextFunction) => {
      const span = tracer.startSpan(`HTTP ${req.method} ${req.path}`, {
         attributes: {
            'http.method': req.method,
            'http.url': req.originalUrl,
            'http.target': req.path,
            'http.user_agent': req.get('user-agent') || '',
         },
      });

      res.on('finish', () => {
         span.setAttributes({
            'http.status_code': res.statusCode,
            'http.response_content_length': res.get('content-length') || '0',
         });
         if (res.statusCode >= 400) {
            span.setStatus({ code: SpanStatusCode.ERROR, message: `HTTP ${res.statusCode}` });
         } else {
            span.setStatus({ code: SpanStatusCode.OK });
         }
         span.end();
      });

      next();
   };
}

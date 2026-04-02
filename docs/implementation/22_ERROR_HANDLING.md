# 22 — Error Handling & Logging

## Objective

Implement global error handling, structured logging, and observability across the API server.

---

## Steps

### 22.1 Global Exception Filter

```
src/common/filters/
├── http-exception.filter.ts
├── crunchwork-exception.filter.ts
└── all-exceptions.filter.ts
```

#### Standard Error Response Format

```typescript
interface ErrorResponse {
  statusCode: number;
  message: string;
  error: string;
  details?: any;
  timestamp: string;
  path: string;
  requestId: string;
}
```

### 22.2 HTTP Exception Filter

```typescript
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptionFilter');

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const errorResponse: ErrorResponse = {
      statusCode: status,
      message: typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as any).message,
      error: HttpStatus[status],
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId: request.headers['x-request-id'] as string,
    };

    this.logger.error(
      `HttpExceptionFilter.catch - ${status} ${request.method} ${request.url}`,
      exception.stack,
    );

    response.status(status).json(errorResponse);
  }
}
```

### 22.3 Crunchwork Exception Filter

Specifically handles errors from the Crunchwork API and maps them:

```typescript
@Catch(CrunchworkApiException)
export class CrunchworkExceptionFilter implements ExceptionFilter {
  catch(exception: CrunchworkApiException, host: ArgumentsHost) {
    // Map Crunchwork errors to user-friendly messages
    // Include upstream error details in dev mode only
    // Log full Crunchwork error for debugging
  }
}
```

### 22.4 Structured Logging

All log messages follow the convention: `[PackageName.MethodName] - message`

```typescript
this.logger.log('ClaimsService.create - creating claim for tenant', { tenantId });
this.logger.error('CrunchworkService.request - API error', { status, url, error });
this.logger.warn('WebhookHmacService.verify - HMAC verification failed', { eventId });
```

### 22.5 Request Logging Interceptor

```typescript
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const elapsed = Date.now() - start;
        this.logger.log(
          `LoggingInterceptor.intercept - ${method} ${url} ${elapsed}ms`
        );
      }),
    );
  }
}
```

### 22.6 Request ID

Generate or propagate a request ID for tracing:

```typescript
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const requestId = req.headers['x-request-id'] || uuid();
    req.headers['x-request-id'] = requestId;
    res.setHeader('x-request-id', requestId);
    next();
  }
}
```

### 22.7 Validation Error Formatting

Configure the global `ValidationPipe` to return structured errors:

```typescript
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  exceptionFactory: (errors) => {
    const messages = errors.map(err =>
      Object.values(err.constraints || {}).join(', ')
    );
    return new BadRequestException({
      message: 'Validation failed',
      details: messages,
    });
  },
}));
```

---

## Acceptance Criteria

- [ ] All errors return consistent `ErrorResponse` format
- [ ] Crunchwork API errors mapped to appropriate HTTP status codes
- [ ] Validation errors include field-level details
- [ ] All requests logged with method, URL, and duration
- [ ] Request IDs propagated through the stack
- [ ] Log messages follow `[Package.Method]` convention
- [ ] Sensitive data (tokens, credentials) never logged

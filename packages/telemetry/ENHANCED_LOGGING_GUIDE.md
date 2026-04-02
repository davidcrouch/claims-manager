# Enhanced Telemetry Logging Guide

This guide shows how to use the enhanced telemetry logging capabilities that capture comprehensive context including server name, module name, function names, user ID, and team ID.

## Features

The enhanced telemetry logging automatically captures:

- **Service Information**: serviceName, serviceVersion, environment
- **Module & Function Context**: moduleName, functionName, className
- **User & Team Context**: userId, teamId, companyId
- **Request Context**: requestId, sessionId
- **OpenTelemetry Context**: traceId, spanId, traceFlags
- **Custom Data**: Any additional metadata you provide

## Basic Usage

### 1. Import the utilities

```typescript
import { getTelemetryLogData, createTelemetryLoggerContext } from '@morezero/telemetry/shared';
import { createTelemetryLogger } from '../telemetry/telemetry-logger';
```

### 2. Create a telemetry logger for your module

```typescript
export class MyService {
  private readonly log: AppLogger;
  private readonly telemetryLogger: ReturnType<typeof createTelemetryLogger>;

  constructor(loggerService: LoggerService) {
    this.log = createModuleLogger(loggerService, 'my-service');
    this.telemetryLogger = createTelemetryLogger(this.log, 'my-service', 'morezero-api-server');
  }
}
```

### 3. Use function-specific logging

```typescript
async createUser(context: AccessContext, userData: CreateUserData) {
  const functionLogger = this.telemetryLogger.forFunction('createUser', 'MyService');
  
  // Log with full telemetry context
  functionLogger.logWithUser('info', 'Creating user', context, {
    additionalData: {
      userName: userData.name,
      userEmail: userData.email,
      userRole: userData.role
    }
  });
  
  try {
    const result = await this.databaseService.createUser(context, userData);
    
    functionLogger.logWithUser('info', 'User created successfully', context, {
      additionalData: {
        userId: result.id,
        userName: result.name,
        createdAt: result.createdAt?.toISOString()
      }
    });
    
    return result;
  } catch (error) {
    functionLogger.logWithUser('error', 'Failed to create user', context, {
      additionalData: {
        error: error.message,
        userName: userData.name
      }
    });
    throw error;
  }
}
```

## Advanced Usage

### Manual telemetry data extraction

```typescript
import { getTelemetryLogData } from '@morezero/telemetry/shared';

// Extract comprehensive telemetry data
const telemetryData = getTelemetryLogData({
  moduleName: 'user-service',
  functionName: 'updateUser',
  className: 'UserService',
  userId: 'user-123',
  teamId: 'team-456',
  companyId: 'company-789',
  requestId: 'req-abc',
  sessionId: 'session-xyz',
  additionalData: {
    customField: 'customValue',
    operationType: 'update'
  }
});

// This will include:
// - traceId, spanId, traceFlags (from OpenTelemetry)
// - serviceName, serviceVersion, environment (from process.env)
// - moduleName, functionName, className (from parameters)
// - userId, teamId, companyId (from parameters)
// - requestId, sessionId (from parameters)
// - customField, operationType (from additionalData)
```

### Using telemetry logger context

```typescript
import { createTelemetryLoggerContext } from '@morezero/telemetry/shared';

const loggerContext = createTelemetryLoggerContext('user-service', 'createUser', 'UserService');

// Get log data for current context
const logData = loggerContext.getLogData({
  userId: 'user-123',
  teamId: 'team-456',
  additionalData: { operation: 'create' }
});

// Use with user context
const userLogger = loggerContext.withUserContext('user-123', 'team-456', 'company-789');
const userLogData = userLogger.getLogData({
  additionalData: { operation: 'create' }
});
```

## Integration with OpenTelemetry Spans

The telemetry logging works seamlessly with OpenTelemetry spans:

```typescript
import { trace, SpanStatusCode } from '@opentelemetry/api';

async createUser(context: AccessContext, userData: CreateUserData) {
  const tracer = trace.getTracer('user-service', '1.0.0');
  const functionLogger = this.telemetryLogger.forFunction('createUser', 'UserService');
  
  return tracer.startActiveSpan('createUser', {
    attributes: {
      'user.name': userData.name,
      'user.team_id': context.teamId,
      'user.role': userData.role
    }
  }, async (span) => {
    functionLogger.logWithUser('info', 'Creating user', context, {
      additionalData: {
        userName: userData.name,
        userRole: userData.role
      }
    });
    
    try {
      const result = await this.databaseService.createUser(context, userData);
      
      functionLogger.logWithUser('info', 'User created successfully', context, {
        additionalData: {
          userId: result.id,
          userName: result.name
        }
      });
      
      span.setAttributes({
        'user.id': result.id,
        'user.created_at': result.createdAt?.toISOString()
      });
      
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
      
    } catch (error) {
      functionLogger.logWithUser('error', 'Failed to create user', context, {
        additionalData: {
          error: error.message,
          userName: userData.name
        }
      });
      
      span.setStatus({ 
        code: SpanStatusCode.ERROR, 
        message: error.message 
      });
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  });
}
```

## Log Output Example

With enhanced telemetry logging, your logs will include comprehensive context:

```json
{
  "level": 30,
  "time": 1640995200000,
  "msg": "User created successfully",
  "traceId": "abc123def456",
  "spanId": "def456ghi789",
  "traceFlags": 1,
  "serviceName": "morezero-api-server",
  "serviceVersion": "0.2.1",
  "environment": "production",
  "moduleName": "user-service",
  "functionName": "createUser",
  "className": "UserService",
  "userId": "user-123",
  "teamId": "team-456",
  "companyId": "company-789",
  "requestId": "req-abc",
  "sessionId": "session-xyz",
  "userName": "John Doe",
  "userRole": "admin",
  "operation": "create"
}
```

## Benefits

1. **Comprehensive Context**: Every log entry includes full context about service, module, function, user, and team
2. **Distributed Tracing**: Automatic correlation with OpenTelemetry traces
3. **Easy Debugging**: Rich context makes it easy to trace issues across services
4. **Consistent Format**: Standardized logging format across all services
5. **Performance Monitoring**: Track operations by user, team, and function
6. **Audit Trail**: Complete audit trail with user and team context

## Migration Guide

To migrate existing logging to enhanced telemetry logging:

1. Replace basic logging with telemetry logger
2. Add function and class context
3. Include user context where available
4. Add relevant additional data
5. Ensure OpenTelemetry spans are properly integrated

This will give you much richer observability and debugging capabilities across your entire application stack.

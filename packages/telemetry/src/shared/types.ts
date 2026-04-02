export interface TelemetryConfig {
  serviceName?: string;
  serviceVersion?: string;
  environment?: string;
  traceEndpoint?: string;
  metricsEndpoint?: string;
  enabled?: boolean;
}

export interface NodeTelemetryConfig extends TelemetryConfig {
  serviceName: string;
  autoInstrumentations?: boolean;
  customInstrumentations?: any[];
}

export interface WebTelemetryConfig extends TelemetryConfig {
  serviceName: string;
  propagateTraceHeaders?: boolean;
  corsUrls?: RegExp | RegExp[];
}

export interface TelemetryContext {
  traceId?: string;
  spanId?: string;
  traceFlags?: number;
}

export interface TelemetryLogData {
  // Service information
  serviceName?: string;
  serviceVersion?: string;
  environment?: string;
  
  // Module and function information
  moduleName?: string;
  functionName?: string;
  className?: string;
  
  // User and team context
  userId?: string;
  teamId?: string;
  
  // Request context
  requestId?: string;
  sessionId?: string;
  
  // Additional metadata
  [key: string]: any;
}

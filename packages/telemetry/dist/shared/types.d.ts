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
    serviceName?: string;
    serviceVersion?: string;
    environment?: string;
    moduleName?: string;
    functionName?: string;
    className?: string;
    userId?: string;
    teamId?: string;
    requestId?: string;
    sessionId?: string;
    [key: string]: any;
}
//# sourceMappingURL=types.d.ts.map
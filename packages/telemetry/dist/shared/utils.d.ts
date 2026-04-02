import type { TelemetryContext, TelemetryLogData } from './types.js';
export { context, trace, SpanStatusCode } from '@opentelemetry/api';
export declare function getCurrentTelemetryContext(): TelemetryContext;
export declare function withTelemetryContext<T>(fn: () => T): T;
export declare function isTelemetryEnabled(): boolean;
/**
 * Extract comprehensive telemetry data for logging
 */
export declare function getTelemetryLogData(options: {
    moduleName?: string;
    functionName?: string;
    className?: string;
    userId?: string;
    teamId?: string;
    companyId?: string;
    requestId?: string;
    sessionId?: string;
    serviceName?: string;
    serviceVersion?: string;
    environment?: string;
    additionalData?: Record<string, any>;
    [key: string]: any;
}): TelemetryLogData;
/**
 * Create a telemetry-aware logger context
 */
export declare function createTelemetryLoggerContext(moduleName: string, functionName?: string, className?: string, serviceName?: string): {
    getLogData: (additionalData?: Record<string, any>) => TelemetryLogData;
    withUserContext: (userId: string, teamId?: string, companyId?: string) => {
        getLogData: (additionalData?: Record<string, any>) => TelemetryLogData;
    };
};
/**
 * Create a telemetry-aware logger that automatically includes telemetry context
 * This function creates log facades that handle getLogData internally
 */
export declare function createTelemetryLogger(logger: any, moduleName: string, className?: string, serviceName?: string): any;
/**
 * Create telemetry log functions that automatically include context
 * This is the main API for telemetry logging - just call these functions directly
 */
export declare function createTelemetryLogFunctions(logger: any, moduleName: string, functionName?: string, className?: string, serviceName?: string): {
    trace: (data: Record<string, any> | undefined, message: string) => any;
    debug: (data: Record<string, any> | undefined, message: string) => any;
    info: (data: Record<string, any> | undefined, message: string) => any;
    warn: (data: Record<string, any> | undefined, message: string) => any;
    error: (data: Record<string, any> | undefined, message: string) => any;
    fatal: (data: Record<string, any> | undefined, message: string) => any;
};
//# sourceMappingURL=utils.d.ts.map
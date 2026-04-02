import { context, trace } from '@opentelemetry/api';
// Re-export OpenTelemetry API for convenience
export { context, trace, SpanStatusCode } from '@opentelemetry/api';
export function getCurrentTelemetryContext() {
    const activeSpan = trace.getActiveSpan();
    if (!activeSpan) {
        return {};
    }
    const spanContext = activeSpan.spanContext();
    return {
        traceId: spanContext.traceId,
        spanId: spanContext.spanId,
        traceFlags: spanContext.traceFlags,
    };
}
export function withTelemetryContext(fn) {
    const activeSpan = trace.getActiveSpan();
    if (!activeSpan) {
        return fn();
    }
    return context.with(trace.setSpan(context.active(), activeSpan), fn);
}
export function isTelemetryEnabled() {
    return process.env.OTEL_SDK_DISABLED !== 'true' &&
        process.env.NODE_ENV !== 'development' &&
        typeof process !== 'undefined';
}
/**
 * Extract comprehensive telemetry data for logging
 */
export function getTelemetryLogData(options) {
    const activeSpan = trace.getActiveSpan();
    const spanContext = activeSpan?.spanContext();
    // Extract known fields
    const { moduleName, functionName, className, userId, teamId, companyId, requestId, sessionId, serviceName, serviceVersion, environment, additionalData, ...extraFields // Capture any additional fields passed directly
     } = options;
    return {
        // OpenTelemetry context
        traceId: spanContext?.traceId,
        spanId: spanContext?.spanId,
        traceFlags: spanContext?.traceFlags,
        // Service information (removed serviceName to avoid duplication with service.name from logger)
        serviceVersion: serviceVersion || process.env.npm_package_version || process.env.SERVICE_VERSION,
        environment: environment || process.env.NODE_ENV || 'development',
        // Module and function information
        moduleName,
        functionName,
        className,
        // User and team context
        userId,
        teamId,
        // Request context
        requestId,
        sessionId,
        // Additional metadata (from both additionalData and extra fields passed directly)
        ...extraFields,
        ...additionalData,
    };
}
/**
 * Create a telemetry-aware logger context
 */
export function createTelemetryLoggerContext(moduleName, functionName, className, serviceName) {
    return {
        getLogData: (additionalData) => getTelemetryLogData({
            moduleName,
            functionName,
            className,
            serviceName,
            ...additionalData,
        }),
        withUserContext: (userId, teamId, companyId) => ({
            getLogData: (additionalData) => getTelemetryLogData({
                moduleName,
                functionName,
                className,
                serviceName,
                userId,
                teamId,
                companyId,
                ...additionalData,
            }),
        }),
    };
}
/**
 * Create a telemetry-aware logger that automatically includes telemetry context
 * This function creates log facades that handle getLogData internally
 */
export function createTelemetryLogger(logger, moduleName, className, serviceName) {
    return {
        ...logger,
        // Override each log method to automatically include telemetry context
        trace: (objOrMsg, msg, ...args) => {
            if (typeof objOrMsg === 'object' && objOrMsg !== null) {
                const telemetryData = getTelemetryLogData({
                    moduleName,
                    className,
                    serviceName,
                    functionName: objOrMsg.functionName,
                    userId: objOrMsg.userId,
                    teamId: objOrMsg.teamId,
                    ...objOrMsg,
                });
                return logger.trace(telemetryData, msg, ...args);
            }
            else {
                const telemetryData = getTelemetryLogData({
                    moduleName,
                    className,
                    serviceName,
                    functionName: objOrMsg,
                });
                return logger.trace(telemetryData, objOrMsg, ...args);
            }
        },
        debug: (objOrMsg, msg, ...args) => {
            if (typeof objOrMsg === 'object' && objOrMsg !== null) {
                const telemetryData = getTelemetryLogData({
                    moduleName,
                    className,
                    serviceName,
                    functionName: objOrMsg.functionName,
                    userId: objOrMsg.userId,
                    teamId: objOrMsg.teamId,
                    ...objOrMsg,
                });
                return logger.debug(telemetryData, msg, ...args);
            }
            else {
                const telemetryData = getTelemetryLogData({
                    moduleName,
                    className,
                    serviceName,
                    functionName: objOrMsg,
                });
                return logger.debug(telemetryData, objOrMsg, ...args);
            }
        },
        info: (objOrMsg, msg, ...args) => {
            if (typeof objOrMsg === 'object' && objOrMsg !== null) {
                const telemetryData = getTelemetryLogData({
                    moduleName,
                    className,
                    serviceName,
                    functionName: objOrMsg.functionName,
                    userId: objOrMsg.userId,
                    teamId: objOrMsg.teamId,
                    ...objOrMsg,
                });
                return logger.info(telemetryData, msg, ...args);
            }
            else {
                const telemetryData = getTelemetryLogData({
                    moduleName,
                    className,
                    serviceName,
                    functionName: objOrMsg,
                });
                return logger.info(telemetryData, objOrMsg, ...args);
            }
        },
        warn: (objOrMsg, msg, ...args) => {
            if (typeof objOrMsg === 'object' && objOrMsg !== null) {
                const telemetryData = getTelemetryLogData({
                    moduleName,
                    className,
                    serviceName,
                    functionName: objOrMsg.functionName,
                    userId: objOrMsg.userId,
                    teamId: objOrMsg.teamId,
                    ...objOrMsg,
                });
                return logger.warn(telemetryData, msg, ...args);
            }
            else {
                const telemetryData = getTelemetryLogData({
                    moduleName,
                    className,
                    serviceName,
                    functionName: objOrMsg,
                });
                return logger.warn(telemetryData, objOrMsg, ...args);
            }
        },
        error: (objOrMsg, msg, ...args) => {
            if (typeof objOrMsg === 'object' && objOrMsg !== null) {
                const telemetryData = getTelemetryLogData({
                    moduleName,
                    className,
                    serviceName,
                    functionName: objOrMsg.functionName,
                    userId: objOrMsg.userId,
                    teamId: objOrMsg.teamId,
                    ...objOrMsg,
                });
                return logger.error(telemetryData, msg, ...args);
            }
            else if (objOrMsg instanceof Error) {
                const telemetryData = getTelemetryLogData({
                    moduleName,
                    className,
                    functionName: msg,
                });
                return logger.error(objOrMsg, telemetryData, ...args);
            }
            else {
                const telemetryData = getTelemetryLogData({
                    moduleName,
                    className,
                    serviceName,
                    functionName: objOrMsg,
                });
                return logger.error(telemetryData, objOrMsg, ...args);
            }
        },
        fatal: (objOrMsg, msg, ...args) => {
            if (typeof objOrMsg === 'object' && objOrMsg !== null) {
                const telemetryData = getTelemetryLogData({
                    moduleName,
                    className,
                    serviceName,
                    functionName: objOrMsg.functionName,
                    userId: objOrMsg.userId,
                    teamId: objOrMsg.teamId,
                    ...objOrMsg,
                });
                return logger.fatal(telemetryData, msg, ...args);
            }
            else if (objOrMsg instanceof Error) {
                const telemetryData = getTelemetryLogData({
                    moduleName,
                    className,
                    functionName: msg,
                });
                return logger.fatal(objOrMsg, telemetryData, ...args);
            }
            else {
                const telemetryData = getTelemetryLogData({
                    moduleName,
                    className,
                    serviceName,
                    functionName: objOrMsg,
                });
                return logger.fatal(telemetryData, objOrMsg, ...args);
            }
        },
    };
}
/**
 * Create telemetry log functions that automatically include context
 * This is the main API for telemetry logging - just call these functions directly
 */
export function createTelemetryLogFunctions(logger, moduleName, functionName, className, serviceName) {
    return {
        trace: (data = {}, message) => {
            const telemetryData = getTelemetryLogData({
                moduleName,
                className,
                serviceName,
                functionName,
                ...data,
            });
            return logger.trace(telemetryData, message);
        },
        debug: (data = {}, message) => {
            const telemetryData = getTelemetryLogData({
                moduleName,
                className,
                serviceName,
                functionName,
                ...data,
            });
            return logger.debug(telemetryData, message);
        },
        info: (data = {}, message) => {
            const telemetryData = getTelemetryLogData({
                moduleName,
                className,
                serviceName,
                functionName,
                ...data,
            });
            return logger.info(telemetryData, message);
        },
        warn: (data = {}, message) => {
            const telemetryData = getTelemetryLogData({
                moduleName,
                className,
                serviceName,
                functionName,
                ...data,
            });
            return logger.warn(telemetryData, message);
        },
        error: (data = {}, message) => {
            const telemetryData = getTelemetryLogData({
                moduleName,
                className,
                serviceName,
                functionName,
                ...data,
            });
            return logger.error(telemetryData, message);
        },
        fatal: (data = {}, message) => {
            const telemetryData = getTelemetryLogData({
                moduleName,
                className,
                serviceName,
                functionName,
                ...data,
            });
            return logger.fatal(telemetryData, message);
        }
    };
}
//# sourceMappingURL=utils.js.map
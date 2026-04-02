// Main exports - re-export everything (explicit .js for Node ESM)
export * from './shared/index.js';
export * from './node/index.js';
export * from './web/index.js';

// Re-export OpenTelemetry API for convenience
export { context, trace, SpanStatusCode } from '@opentelemetry/api';

// Convenience exports for common use cases
export { startNodeTelemetry as startTelemetry } from './node/index.js';
export { startWebTelemetry as startClientTelemetry } from './web/index.js';

// Re-export the telemetry log functions
export { createTelemetryLogFunctions, createTelemetryLogger } from './shared/index.js';
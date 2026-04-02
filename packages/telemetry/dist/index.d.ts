export * from './shared/index.js';
export * from './node/index.js';
export * from './web/index.js';
export { context, trace, SpanStatusCode } from '@opentelemetry/api';
export { startNodeTelemetry as startTelemetry } from './node/index.js';
export { startWebTelemetry as startClientTelemetry } from './web/index.js';
export { createTelemetryLogFunctions, createTelemetryLogger } from './shared/index.js';
//# sourceMappingURL=index.d.ts.map
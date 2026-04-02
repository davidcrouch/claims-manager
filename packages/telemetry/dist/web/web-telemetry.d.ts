import type { WebTelemetryConfig } from '../shared/types.js';
export declare function createWebTracerProvider(config: WebTelemetryConfig): Promise<import("@opentelemetry/sdk-trace-web").WebTracerProvider>;
export declare function startWebTelemetry(config: WebTelemetryConfig): Promise<import("@opentelemetry/sdk-trace-web").WebTracerProvider | undefined>;
//# sourceMappingURL=web-telemetry.d.ts.map
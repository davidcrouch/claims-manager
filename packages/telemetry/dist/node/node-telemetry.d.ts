import type { NodeTelemetryConfig } from '../shared/types.js';
export declare function createNodeSDK(config: NodeTelemetryConfig): Promise<import("@opentelemetry/sdk-node").NodeSDK>;
export declare function startNodeTelemetry(config: NodeTelemetryConfig): Promise<import("@opentelemetry/sdk-node").NodeSDK | undefined>;
//# sourceMappingURL=node-telemetry.d.ts.map
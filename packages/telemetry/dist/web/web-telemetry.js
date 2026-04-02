export async function createWebTracerProvider(config) {
    // Dynamic imports to avoid bundling in server-side code
    const [{ WebTracerProvider }, { OTLPTraceExporter }, { SimpleSpanProcessor }, { ZoneContextManager }, { registerInstrumentations }, { DocumentLoadInstrumentation }, { UserInteractionInstrumentation }, { FetchInstrumentation }] = await Promise.all([
        import('@opentelemetry/sdk-trace-web'),
        import('@opentelemetry/exporter-trace-otlp-http'),
        import('@opentelemetry/sdk-trace-base'),
        import('@opentelemetry/context-zone'),
        import('@opentelemetry/instrumentation'),
        import('@opentelemetry/instrumentation-document-load'),
        import('@opentelemetry/instrumentation-user-interaction'),
        import('@opentelemetry/instrumentation-fetch')
    ]);
    const resources = await import('@opentelemetry/resources');
    const Resource = resources.Resource || resources.default;
    const resource = new Resource({
        'service.name': config.serviceName,
        'service.version': config.serviceVersion,
    });
    const traceExporter = new OTLPTraceExporter({
        url: config.traceEndpoint || `${process.env.NEXT_PUBLIC_OTEL_TRACES_URL || 'http://localhost:4318'}/v1/traces`
    });
    const provider = new WebTracerProvider({
        resource: resource,
        spanProcessors: [new SimpleSpanProcessor(traceExporter)]
    });
    provider.register({ contextManager: new ZoneContextManager() });
    registerInstrumentations({
        instrumentations: [
            new DocumentLoadInstrumentation(),
            new UserInteractionInstrumentation(),
            new FetchInstrumentation({
                propagateTraceHeaderCorsUrls: config.corsUrls || /.*/
            }),
        ],
    });
    return provider;
}
export async function startWebTelemetry(config) {
    // Only run in the browser
    if (typeof window === 'undefined') {
        console.log('@morezero/telemetry: Web telemetry skipped (not in browser)');
        return;
    }
    if (config.enabled === false) {
        console.log('@morezero/telemetry: Web telemetry disabled by configuration');
        return;
    }
    try {
        const provider = await createWebTracerProvider(config);
        console.log(`@morezero/telemetry: Web telemetry started for service: ${config.serviceName || 'morezero-web'}`);
        return provider;
    }
    catch (error) {
        console.warn('@morezero/telemetry: Failed to initialize web telemetry:', error);
        throw error;
    }
}
//# sourceMappingURL=web-telemetry.js.map
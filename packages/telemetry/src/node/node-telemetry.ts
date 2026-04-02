import type { NodeTelemetryConfig } from '../shared/types.js';

function isDisabled(config: NodeTelemetryConfig): boolean {
  return config.enabled === false || process.env.OTEL_SDK_DISABLED === 'true';
}

export async function createNodeSDK(config: NodeTelemetryConfig) {
  const [
    { NodeSDK },
    { resourceFromAttributes },
    { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION },
    { getNodeAutoInstrumentations },
    { OTLPTraceExporter },
    { PeriodicExportingMetricReader },
    { OTLPMetricExporter },
  ] = await Promise.all([
    import('@opentelemetry/sdk-node'),
    import('@opentelemetry/resources'),
    import('@opentelemetry/semantic-conventions'),
    import('@opentelemetry/auto-instrumentations-node'),
    import('@opentelemetry/exporter-trace-otlp-http'),
    import('@opentelemetry/sdk-metrics'),
    import('@opentelemetry/exporter-metrics-otlp-http'),
  ]);

  const serviceName = config.serviceName || process.env.OTEL_SERVICE_NAME || 'morezero-dev';

  const traceExporter = new OTLPTraceExporter({
    url: config.traceEndpoint || process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
  });

  const metricExporter = new OTLPMetricExporter({
    url: config.metricsEndpoint || process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT,
  });

  const instrumentations = config.autoInstrumentations !== false
    ? [
        getNodeAutoInstrumentations({}),
        ...(config.customInstrumentations || [])
      ]
    : (config.customInstrumentations || []);

  return new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: config.serviceVersion || process.env.npm_package_version,
      'deployment.environment': config.environment || process.env.NODE_ENV || 'development',
    }),
    traceExporter,
    metricReader: new PeriodicExportingMetricReader({
      exporter: metricExporter,
    }),
    instrumentations,
  });
}

export async function startNodeTelemetry(config: NodeTelemetryConfig) {
  if (isDisabled(config)) {
    console.log('@morezero/telemetry: Telemetry disabled by configuration');
    return;
  }

  try {
    const sdk = await createNodeSDK(config);
    await sdk.start();

    console.log(`@morezero/telemetry: Node telemetry started for service: ${config.serviceName || 'morezero-dev'}`);

    process.on('SIGTERM', async () => {
      await sdk.shutdown();
      process.exit(0);
    });

    return sdk;
  } catch (error) {
    console.error('@morezero/telemetry: Failed to start node telemetry:', error);
    throw error;
  }
}

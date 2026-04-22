import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

@Injectable()
export class More0Service {
  private readonly logger = new Logger('More0Service');
  private readonly registryUrl: string;
  private readonly gatewayUrl: string;
  private readonly appKey: string;
  private readonly organizationId: string;
  private readonly apiKey: string;
  private readonly enabled: boolean;
  private readonly mockMode: boolean;

  constructor(private readonly configService: ConfigService) {
    this.registryUrl = this.configService.get<string>(
      'more0.registryUrl',
      'http://localhost:3201',
    );
    this.gatewayUrl = this.configService.get<string>(
      'more0.gatewayUrl',
      'http://localhost:3205',
    );
    this.appKey = this.configService.get<string>(
      'more0.appKey',
      'claims-manager-webhook',
    );
    this.organizationId = this.configService.get<string>(
      'more0.organizationId',
      'claims-manager-webhook',
    );
    this.apiKey = this.configService.get<string>('more0.apiKey', '');
    this.enabled = this.configService.get<boolean>('more0.enabled', false);
    this.mockMode = !this.enabled || !this.apiKey;

    if (this.mockMode) {
      this.logger.warn(
        'More0Service — running in MOCK mode (MORE0_ENABLED=false or MORE0_API_KEY missing). Workflow calls will be logged but not dispatched.',
      );
    } else {
      this.logger.log(
        `More0Service — registry=${this.registryUrl} gateway=${this.gatewayUrl} org=${this.organizationId} app=${this.appKey}`,
      );
    }
  }

  isEnabled(): boolean {
    return !this.mockMode;
  }

  /**
   * Invoke a capability (typically a workflow) via the More0 HTTP gateway,
   * as used by `apps/client-tests/stream-http-gateway`. This is the path the
   * webhook pipeline uses when WEBHOOK_PROCESSING_MODE=more0.
   *
   * POSTs to `${gatewayUrl}/api/v1/invoke` with body `{ cap, method, params }`
   * and `x-organization-id` header. Returns the JSON response — for async
   * workflows that is typically `{ runId, status }`.
   */
  async invokeViaGateway(params: {
    cap: string;
    method: string;
    params: Record<string, unknown>;
    organizationId?: string;
    timeoutMs?: number;
  }): Promise<{ runId?: string; status?: string; data?: unknown }> {
    const logPrefix = 'More0Service.invokeViaGateway';
    const organizationId = params.organizationId ?? this.organizationId;

    if (this.mockMode) {
      const mockRunId = `mock-${randomUUID()}`;
      this.logger.log(
        `${logPrefix} [MOCK] — cap=${params.cap} method=${params.method} org=${organizationId} runId=${mockRunId}`,
      );
      this.logger.log(
        `${logPrefix} [MOCK] — params: ${JSON.stringify(params.params)}`,
      );
      return { runId: mockRunId, status: 'mocked' };
    }

    const url = `${this.gatewayUrl}/api/v1/invoke`;
    this.logger.log(
      `${logPrefix} — POST ${url} cap=${params.cap} method=${params.method} org=${organizationId}`,
    );

    const controller = new AbortController();
    const timeout = params.timeoutMs ?? 30000;
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'x-organization-id': organizationId,
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({
          cap: params.cap,
          method: params.method,
          params: params.params,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const bodyText = await response.text();
        throw new Error(
          `${logPrefix} — HTTP ${response.status}: ${bodyText.slice(0, 500)}`,
        );
      }

      const json = (await response.json()) as {
        runId?: string;
        status?: string;
        data?: unknown;
      };
      this.logger.log(
        `${logPrefix} — cap=${params.cap} runId=${json.runId ?? 'n/a'} status=${json.status ?? 'n/a'}`,
      );
      return json;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `${logPrefix} — failed cap=${params.cap}: ${err.message}`,
      );
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * @deprecated Prefer `invokeViaGateway` for workflow dispatch. The legacy
   * registry-SDK path is retained for the existing backfill endpoints
   * (docs 19/21). Planned removal once those are migrated to the gateway.
   */
  async invokeWorkflow(params: {
    workflowName: string;
    input: Record<string, unknown>;
    context?: { tenantId: string; userId?: string };
  }): Promise<{ runId: string }> {
    const fqcn = params.workflowName.includes('.')
      ? params.workflowName
      : `${this.appKey}.${params.workflowName}`;

    if (this.mockMode) {
      const mockRunId = `mock-${randomUUID()}`;
      this.logger.log(
        `More0Service.invokeWorkflow [MOCK] — ${fqcn} (runId: ${mockRunId})`,
      );
      this.logger.log(
        `More0Service.invokeWorkflow [MOCK] — input: ${JSON.stringify(params.input, null, 2)}`,
      );
      if (params.context) {
        this.logger.log(
          `More0Service.invokeWorkflow [MOCK] — context: ${JSON.stringify(params.context)}`,
        );
      }
      return { runId: mockRunId };
    }

    this.logger.log(
      `More0Service.invokeWorkflow — invoking ${fqcn} with input keys: ${Object.keys(params.input).join(', ')}`,
    );

    try {
      const response = await fetch(
        `${this.registryUrl}/api/v1/workflows/invoke`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
          },
          body: JSON.stringify({
            workflowName: fqcn,
            input: params.input,
            context: params.context,
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `More0 workflow invocation failed (${response.status}): ${errorText}`,
        );
      }

      const result = (await response.json()) as { runId: string };
      this.logger.log(
        `More0Service.invokeWorkflow — workflow ${fqcn} started with runId: ${result.runId}`,
      );
      return { runId: result.runId };
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `More0Service.invokeWorkflow — failed to invoke ${fqcn}: ${err.message}`,
      );
      throw error;
    }
  }

  /**
   * @deprecated See `invokeWorkflow`. Retained for synchronous backfill /
   * ad-hoc invocations that still target the registry SDK directly.
   */
  async invokeWorkflowSync(params: {
    workflowName: string;
    input: Record<string, unknown>;
    context?: { tenantId: string };
    timeoutMs?: number;
  }): Promise<Record<string, unknown>> {
    const fqcn = params.workflowName.includes('.')
      ? params.workflowName
      : `${this.appKey}.${params.workflowName}`;

    if (this.mockMode) {
      this.logger.log(`More0Service.invokeWorkflowSync [MOCK] — ${fqcn}`);
      this.logger.log(
        `More0Service.invokeWorkflowSync [MOCK] — input: ${JSON.stringify(params.input, null, 2)}`,
      );
      if (params.context) {
        this.logger.log(
          `More0Service.invokeWorkflowSync [MOCK] — context: ${JSON.stringify(params.context)}`,
        );
      }
      return { mockRunId: `mock-${randomUUID()}`, status: 'mocked' };
    }

    this.logger.log(
      `More0Service.invokeWorkflowSync — invoking ${fqcn} synchronously`,
    );

    const response = await fetch(
      `${this.registryUrl}/api/v1/workflows/invoke-sync`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({
          workflowName: fqcn,
          input: params.input,
          context: params.context,
          timeoutMs: params.timeoutMs ?? 30000,
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `More0 sync workflow invocation failed (${response.status}): ${errorText}`,
      );
    }

    return (await response.json()) as Record<string, unknown>;
  }
}

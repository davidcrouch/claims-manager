import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

@Injectable()
export class More0Service {
  private readonly logger = new Logger('More0Service');
  private readonly registryUrl: string;
  private readonly appKey: string;
  private readonly apiKey: string;
  private readonly mockMode: boolean;

  constructor(private readonly configService: ConfigService) {
    this.registryUrl = this.configService.get<string>('more0.registryUrl', 'http://localhost:3200');
    this.appKey = this.configService.get<string>('more0.appKey', 'claims-manager');
    this.apiKey = this.configService.get<string>('more0.apiKey', '');
    this.mockMode = !this.apiKey;

    if (this.mockMode) {
      this.logger.warn(
        'More0Service — running in MOCK mode (no MORE0_API_KEY configured). Workflow calls will be logged but not dispatched.',
      );
    }
  }

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
      const response = await fetch(`${this.registryUrl}/api/v1/workflows/invoke`, {
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
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`More0 workflow invocation failed (${response.status}): ${errorText}`);
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
      this.logger.log(
        `More0Service.invokeWorkflowSync [MOCK] — ${fqcn}`,
      );
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

    const response = await fetch(`${this.registryUrl}/api/v1/workflows/invoke-sync`, {
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
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`More0 sync workflow invocation failed (${response.status}): ${errorText}`);
    }

    return (await response.json()) as Record<string, unknown>;
  }
}

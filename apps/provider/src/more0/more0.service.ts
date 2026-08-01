import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

@Injectable()
export class More0Service {
  private readonly logger = new Logger('provider.More0Service');
  private readonly gatewayUrl: string;
  private readonly organizationId: string;
  private readonly apiKey: string;
  private readonly mockMode: boolean;

  constructor(private readonly configService: ConfigService) {
    this.gatewayUrl = this.configService.get<string>(
      'more0.gatewayUrl',
      'http://localhost:3205',
    );
    this.organizationId = this.configService.get<string>(
      'more0.organizationId',
      'claims-manager-webhook',
    );
    this.apiKey = this.configService.get<string>('more0.apiKey', '');
    const enabled = this.configService.get<boolean>('more0.enabled', false);
    this.mockMode = !enabled || !this.apiKey;

    if (this.mockMode) {
      this.logger.warn(
        'provider.More0Service — MOCK mode (MORE0_ENABLED=false or MORE0_API_KEY missing)',
      );
    } else {
      this.logger.log(
        `provider.More0Service — gateway=${this.gatewayUrl} org=${this.organizationId}`,
      );
    }
  }

  isEnabled(): boolean {
    return !this.mockMode;
  }

  async invokeViaGateway(params: {
    cap: string;
    method: string;
    params: Record<string, unknown>;
    organizationId?: string;
    timeoutMs?: number;
  }): Promise<{ runId?: string; status?: string; data?: unknown }> {
    const logPrefix = 'provider.More0Service.invokeViaGateway';
    const organizationId = params.organizationId ?? this.organizationId;

    if (this.mockMode) {
      const mockRunId = `mock-${randomUUID()}`;
      this.logger.log(
        `${logPrefix} [MOCK] — cap=${params.cap} method=${params.method} runId=${mockRunId}`,
      );
      return { runId: mockRunId, status: 'mocked' };
    }

    const url = `${this.gatewayUrl}/api/v1/invoke`;
    this.logger.log(
      `${logPrefix} — POST ${url} cap=${params.cap} method=${params.method}`,
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
        const text = await response.text();
        throw new Error(`More0 gateway ${response.status}: ${text}`);
      }

      return (await response.json()) as {
        runId?: string;
        status?: string;
        data?: unknown;
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

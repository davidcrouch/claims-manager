import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const METADATA_IDENTITY_URL =
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity';

@Injectable()
export class ApiProcessClient {
  private readonly logger = new Logger('provider.ApiProcessClient');
  private readonly endpointBase: string | null;
  private readonly audience: string | null;
  private readonly token: string | null;

  constructor(private readonly configService: ConfigService) {
    const base = (
      this.configService.get<string>('apiInternal.baseUrl') ?? ''
    ).trim();
    const token = (
      this.configService.get<string>('apiInternal.token') ?? ''
    ).trim();
    const prefix = (
      this.configService.get<string>('apiInternal.prefix') ?? '/api/v1'
    ).trim();

    if (!base || !token) {
      this.endpointBase = null;
      this.audience = null;
      this.token = null;
      this.logger.warn(
        'provider.ApiProcessClient — API_INTERNAL_URL or INTERNAL_API_TOKEN missing; api dispatch disabled',
      );
      return;
    }

    const trimmedBase = base.replace(/\/+$/, '');
    const trimmedPrefix = prefix.replace(/^\/?/, '/').replace(/\/+$/, '');
    this.endpointBase = `${trimmedBase}${trimmedPrefix}`;
    this.audience = trimmedBase;
    this.token = token;
    this.logger.log(
      `provider.ApiProcessClient — configured endpointBase=${this.endpointBase}`,
    );
  }

  isConfigured(): boolean {
    return Boolean(this.endpointBase && this.token && this.audience);
  }

  /**
   * Ask api-server to run the inproc (or configured) webhook pipeline for an
   * already-persisted inbound_webhook_events row.
   */
  async processEvent(params: {
    eventId: string;
    timeoutMs?: number;
  }): Promise<{ ok: boolean; status?: string; reason?: string }> {
    const logPrefix = 'provider.ApiProcessClient.processEvent';
    if (!this.isConfigured() || !this.endpointBase || !this.token || !this.audience) {
      return { ok: false, reason: 'not_configured' };
    }

    const timeoutMs = params.timeoutMs ?? 120_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-internal-token': this.token,
    };

    try {
      const idToken = await this.fetchCloudRunIdToken(this.audience);
      if (idToken) {
        headers.Authorization = `Bearer ${idToken}`;
      } else if (process.env.K_SERVICE) {
        this.logger.warn(
          `${logPrefix} — no Cloud Run ID token; IAM invoke will likely 403`,
        );
      }

      const url = `${this.endpointBase}/internal/webhooks/process-event`;
      this.logger.log(
        `${logPrefix} — POST ${url} eventId=${params.eventId}`,
      );
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ eventId: params.eventId }),
        signal: controller.signal,
      });
      const bodyText = await res.text().catch(() => '');
      let parsed: { status?: string; reason?: string } = {};
      try {
        parsed = bodyText ? (JSON.parse(bodyText) as typeof parsed) : {};
      } catch {
        /* non-JSON body */
      }

      if (!res.ok) {
        this.logger.error(
          `${logPrefix} — eventId=${params.eventId} status=${res.status} body=${bodyText.slice(0, 300)}`,
        );
        return {
          ok: false,
          status: String(res.status),
          reason: parsed.reason ?? bodyText.slice(0, 200),
        };
      }

      if (parsed.status === 'error' || parsed.status === 'skipped') {
        this.logger.warn(
          `${logPrefix} — eventId=${params.eventId} apiStatus=${parsed.status} reason=${parsed.reason ?? 'n/a'}`,
        );
        return {
          ok: false,
          status: parsed.status,
          reason: parsed.reason,
        };
      }

      this.logger.log(
        `${logPrefix} — eventId=${params.eventId} ok apiStatus=${parsed.status ?? 'ok'}`,
      );
      return { ok: true, status: parsed.status ?? 'ok' };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `${logPrefix} — eventId=${params.eventId} failed: ${message}`,
      );
      return { ok: false, reason: message };
    } finally {
      clearTimeout(timer);
    }
  }

  private async fetchCloudRunIdToken(audience: string): Promise<string | null> {
    if (!process.env.K_SERVICE) {
      return null;
    }

    try {
      const url = `${METADATA_IDENTITY_URL}?audience=${encodeURIComponent(audience)}`;
      const res = await fetch(url, {
        headers: { 'Metadata-Flavor': 'Google' },
        signal: AbortSignal.timeout(2_000),
      });
      if (!res.ok) {
        this.logger.warn(
          `provider.ApiProcessClient.fetchCloudRunIdToken — status=${res.status} audience=${audience}`,
        );
        return null;
      }
      const token = (await res.text()).trim();
      return token || null;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `provider.ApiProcessClient.fetchCloudRunIdToken — failed: ${message}`,
      );
      return null;
    }
  }
}

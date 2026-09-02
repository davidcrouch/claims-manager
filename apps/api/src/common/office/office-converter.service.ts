import { Injectable, Logger } from '@nestjs/common';
import { GoogleAuth } from 'google-auth-library';

/** Default 3 minutes — large scope-of-work / estimate docs often exceed 60s. */
const DEFAULT_CONVERT_TIMEOUT_MS = 180_000;

function gotenbergBaseUrl(): string | null {
  const raw = process.env.GOTENBERG_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, '');
}

function convertTimeoutMs(): number {
  const raw = Number(process.env.GOTENBERG_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_CONVERT_TIMEOUT_MS;
}

function mimeForFileName(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.doc') && !lower.endsWith('.docx')) return 'application/msword';
  if (lower.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  return 'application/octet-stream';
}

@Injectable()
export class OfficeConverterService {
  private readonly logger = new Logger('OfficeConverterService');
  private readonly auth = new GoogleAuth();

  isAvailable(): boolean {
    return gotenbergBaseUrl() != null;
  }

  async convertToPdf(params: {
    buffer: Buffer;
    sourceFileName?: string;
  }): Promise<Buffer> {
    const logPrefix = 'OfficeConverterService.convertToPdf';
    const baseUrl = gotenbergBaseUrl();
    if (!baseUrl) {
      throw new Error(
        'No PDF converter available. Set GOTENBERG_URL to a running Gotenberg instance.',
      );
    }

    const sourceFileName = params.sourceFileName ?? 'source.docx';
    const url = `${baseUrl}/forms/libreoffice/convert`;
    const timeoutMs = convertTimeoutMs();
    this.logger.log(
      `${logPrefix} — bytes=${params.buffer.length} file=${sourceFileName} timeoutMs=${timeoutMs} url=${url}`,
    );

    const form = new FormData();
    form.append(
      'files',
      new File([new Uint8Array(params.buffer)], sourceFileName, {
        type: mimeForFileName(sourceFileName),
      }),
    );

    const headers = await this.authHeaders(url);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        body: form,
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = (await response.text().catch(() => '')).trim().slice(0, 500);
        throw new Error(
          `Gotenberg convert failed ${response.status}${detail ? `: ${detail}` : ''}`,
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      const output = Buffer.from(arrayBuffer);
      if (!output.length) {
        throw new Error('Gotenberg conversion returned empty buffer');
      }
      this.logger.debug(`${logPrefix} — complete bytes=${output.length}`);
      return output;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Gotenberg conversion timed out after ${timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Cloud Run IAM: when the API runs on Cloud Run and GOTENBERG_URL is a
   * *.run.app host, attach an identity token so the private service accepts the call.
   */
  private async authHeaders(url: string): Promise<Record<string, string> | undefined> {
    const logPrefix = 'OfficeConverterService.authHeaders';
    const isCloudRun =
      !!process.env.K_SERVICE && /\.run\.app$/i.test(new URL(url).hostname);
    if (!isCloudRun) return undefined;

    try {
      const client = await this.auth.getIdTokenClient(new URL(url).origin);
      const reqHeaders = await client.getRequestHeaders();
      const authorization =
        reqHeaders['Authorization'] ??
        reqHeaders['authorization'] ??
        (reqHeaders as { Authorization?: string }).Authorization;
      if (!authorization) return undefined;
      return {
        Authorization: authorization.startsWith('Bearer ')
          ? authorization
          : `Bearer ${authorization}`,
      };
    } catch (err) {
      this.logger.warn(
        `${logPrefix} — failed url=${url}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return undefined;
    }
  }
}

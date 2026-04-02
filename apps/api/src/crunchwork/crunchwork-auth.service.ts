import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface TokenCacheEntry {
  accessToken: string;
  expiresAt: number;
}

@Injectable()
export class CrunchworkAuthService {
  private readonly logger = new Logger('CrunchworkAuthService');
  private readonly tokenCache = new Map<string, TokenCacheEntry>();

  constructor(private readonly httpService: HttpService) {}

  async getAccessToken(params: {
    connectionId: string;
    credentials: { clientId: string; clientSecret: string; authUrl: string };
  }): Promise<string> {
    const cached = this.tokenCache.get(params.connectionId);
    if (cached && Date.now() < cached.expiresAt - 60000) {
      return cached.accessToken;
    }
    return this.exchangeCredentials({
      connectionId: params.connectionId,
      credentials: params.credentials,
    });
  }

  invalidateToken(params: { connectionId: string }): void {
    this.tokenCache.delete(params.connectionId);
  }

  invalidateAllTokens(): void {
    this.tokenCache.clear();
  }

  private async exchangeCredentials(params: {
    connectionId: string;
    credentials: { clientId: string; clientSecret: string; authUrl: string };
  }): Promise<string> {
    this.logger.debug(
      `CrunchworkAuthService.exchangeCredentials — acquiring token for connection=${params.connectionId}`,
    );

    const { clientId, clientSecret, authUrl } = params.credentials;
    if (!clientId || !clientSecret || !authUrl) {
      throw new Error(
        `CrunchworkAuthService.exchangeCredentials — missing credentials for connection=${params.connectionId}`,
      );
    }

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await firstValueFrom(
      this.httpService.get(authUrl, {
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }),
    );

    const entry: TokenCacheEntry = {
      accessToken: response.data.access_token,
      expiresAt: Date.now() + response.data.expires_in * 1000,
    };
    this.tokenCache.set(params.connectionId, entry);

    this.logger.debug(
      `CrunchworkAuthService.exchangeCredentials — token acquired for connection=${params.connectionId}`,
    );

    return entry.accessToken;
  }
}

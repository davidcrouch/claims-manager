import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class WebhookHmacService {
  verify(params: { rawBody: Buffer; signature: string; hmacSecret: string }): boolean {
    if (!params.hmacSecret) {
      return false;
    }
    const hmac = crypto
      .createHmac('sha256', params.hmacSecret)
      .update(params.rawBody)
      .digest('base64');
    try {
      return crypto.timingSafeEqual(
        Buffer.from(hmac),
        Buffer.from(params.signature),
      );
    } catch {
      return false;
    }
  }
}

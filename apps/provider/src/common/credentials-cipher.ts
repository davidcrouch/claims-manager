import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const ENCODING = 'base64';
const PREFIX = 'enc:';

@Injectable()
export class CredentialsCipher {
  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService) {
    const raw = this.configService.get<string>('CREDENTIALS_ENCRYPTION_KEY');
    if (!raw) {
      throw new Error(
        'provider.CredentialsCipher — CREDENTIALS_ENCRYPTION_KEY env var is required',
      );
    }
    this.key = crypto.createHash('sha256').update(raw).digest();
  }

  decrypt(ciphertext: string): string {
    if (!ciphertext.startsWith(PREFIX)) {
      throw new Error(
        'provider.CredentialsCipher.decrypt — value is not encrypted (missing enc: prefix)',
      );
    }

    const raw = Buffer.from(ciphertext.slice(PREFIX.length), ENCODING);
    const iv = raw.subarray(0, IV_LENGTH);
    const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString('utf8');
  }
}

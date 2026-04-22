import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash } from 'crypto';

export interface PutJsonParams {
  key: string;
  body: string | Buffer;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface PutJsonResult {
  bucket: string;
  key: string;
  etag: string | null;
  bytes: number;
  sha256: string;
  uri: string;
}

export interface GetSignedUrlParams {
  key: string;
  expiresIn?: number;
}

export interface KeyForPayloadParams {
  tenantId: string;
  providerEntityType: string;
  providerEntityId: string;
  hash: string;
}

@Injectable()
export class S3Service {
  private readonly logger = new Logger('S3Service');
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly archivePrefix: string;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>(
      's3.endpoint',
      'http://localhost:3230',
    );
    const region = this.configService.get<string>('s3.region', 'us-east-1');
    const bucket = this.configService.get<string>('s3.bucket', 'claims-manager');
    const accessKeyId = this.configService.get<string>('s3.accessKeyId', 'sail');
    const secretAccessKey = this.configService.get<string>(
      's3.secretAccessKey',
      'password',
    );
    const forcePathStyle = this.configService.get<boolean>(
      's3.forcePathStyle',
      true,
    );
    const archivePrefix = this.configService.get<string>(
      's3.archivePrefix',
      'webhooks/payloads',
    );

    this.bucket = bucket;
    this.archivePrefix = archivePrefix.replace(/^\/+|\/+$/g, '');

    this.client = new S3Client({
      endpoint,
      region,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle,
    });

    this.logger.log(
      `S3Service.ctor — endpoint=${endpoint} bucket=${bucket} prefix=${this.archivePrefix} forcePathStyle=${forcePathStyle}`,
    );
  }

  getBucket(): string {
    return this.bucket;
  }

  getArchivePrefix(): string {
    return this.archivePrefix;
  }

  /**
   * Build a deterministic S3 key for a webhook payload archive.
   * Shape: {archivePrefix}/{tenantId}/{providerEntityType}/{providerEntityId}/{hash}.json
   */
  keyForPayload(params: KeyForPayloadParams): string {
    const safeTenant = this.sanitizeSegment(params.tenantId);
    const safeType = this.sanitizeSegment(params.providerEntityType);
    const safeId = this.sanitizeSegment(params.providerEntityId);
    const safeHash = this.sanitizeSegment(params.hash);
    return `${this.archivePrefix}/${safeTenant}/${safeType}/${safeId}/${safeHash}.json`;
  }

  async putJson(params: PutJsonParams): Promise<PutJsonResult> {
    const logPrefix = 'S3Service.putJson';
    const body = Buffer.isBuffer(params.body)
      ? params.body
      : Buffer.from(params.body, 'utf-8');
    const sha256 = createHash('sha256').update(body).digest('hex');

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: params.key,
        Body: body,
        ContentType: params.contentType ?? 'application/json',
        Metadata: params.metadata,
        ChecksumSHA256: undefined,
      });
      const response = await this.client.send(command);
      const etag = response.ETag ? response.ETag.replace(/^"|"$/g, '') : null;
      this.logger.log(
        `${logPrefix} — bucket=${this.bucket} key=${params.key} bytes=${body.length} etag=${etag ?? 'n/a'}`,
      );
      return {
        bucket: this.bucket,
        key: params.key,
        etag,
        bytes: body.length,
        sha256,
        uri: `s3://${this.bucket}/${params.key}`,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `${logPrefix} — failed bucket=${this.bucket} key=${params.key}: ${err.message}`,
      );
      throw error;
    }
  }

  async getSignedDownloadUrl(params: GetSignedUrlParams): Promise<string> {
    const logPrefix = 'S3Service.getSignedDownloadUrl';
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: params.key,
    });
    const url = await getSignedUrl(this.client, command, {
      expiresIn: params.expiresIn ?? 900,
    });
    this.logger.debug(
      `${logPrefix} — bucket=${this.bucket} key=${params.key} expiresIn=${params.expiresIn ?? 900}`,
    );
    return url;
  }

  private sanitizeSegment(value: string): string {
    return (value || 'unknown')
      .toString()
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 128);
  }
}

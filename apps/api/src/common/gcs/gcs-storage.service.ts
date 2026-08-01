import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage, Bucket } from '@google-cloud/storage';

export interface GcsUploadUrlResult {
  uploadUrl: string;
  objectPath: string;
  bucket: string;
  uri: string;
}

export interface GcsDownloadUrlResult {
  downloadUrl: string;
}

@Injectable()
export class GcsStorageService {
  private readonly logger = new Logger(GcsStorageService.name);
  private readonly storage: Storage | null;
  private readonly bucket: Bucket | null;
  private readonly bucketName: string;
  private readonly corsOrigin: string | undefined;
  private readonly downloadUrlExpiry: number;

  constructor(private readonly configService: ConfigService) {
    const projectId = this.configService.get<string>('gcs.projectId');
    const bucketName = this.configService.get<string>('gcs.documentsBucket');
    this.corsOrigin = this.configService.get<string>('gcs.uploadCorsOrigin');
    this.downloadUrlExpiry = this.configService.get<number>('gcs.downloadUrlExpiry', 900);
    this.bucketName = bucketName || '';

    if (!projectId || !bucketName) {
      this.logger.warn(
        `GcsStorageService.ctor — GCS not configured (projectId=${projectId}, bucket=${bucketName}). Document uploads will be unavailable.`,
      );
      this.storage = null;
      this.bucket = null;
      return;
    }

    this.storage = new Storage({ projectId });
    this.bucket = this.storage.bucket(bucketName);

    this.logger.log(
      `GcsStorageService.ctor — projectId=${projectId} bucket=${bucketName} corsOrigin=${this.corsOrigin ?? 'none'}`,
    );
  }

  getBucketName(): string {
    return this.bucketName;
  }

  private requireBucket(logPrefix: string): Bucket {
    if (!this.bucket) {
      throw new Error(`${logPrefix} — GCS not configured. Set GCP_PROJECT_ID and GCS_DOCUMENTS_BUCKET.`);
    }
    return this.bucket;
  }

  async createResumableUploadUrl(params: {
    objectPath: string;
    contentType: string;
    metadata?: Record<string, string>;
  }): Promise<GcsUploadUrlResult> {
    const logPrefix = 'GcsStorageService.createResumableUploadUrl';
    const file = this.requireBucket(logPrefix).file(params.objectPath);

    try {
      const [uploadUrl] = await file.createResumableUpload({
        origin: this.corsOrigin,
        metadata: {
          contentType: params.contentType,
          metadata: params.metadata,
        },
      });

      this.logger.debug(
        `${logPrefix} — bucket=${this.bucketName} path=${params.objectPath} contentType=${params.contentType}`,
      );

      return {
        uploadUrl,
        objectPath: params.objectPath,
        bucket: this.bucketName,
        uri: `gs://${this.bucketName}/${params.objectPath}`,
      };
    } catch (error: any) {
      if (error?.code === 401 || error?.message?.includes('credentials expired')) {
        this.logger.error(
          `${logPrefix} — GCP credentials expired. Run "gcloud auth application-default login" and restart.`,
        );
      }
      this.logger.error(`${logPrefix} — failed path=${params.objectPath}: ${error.message}`);
      throw error;
    }
  }

  async getSignedDownloadUrl(params: {
    objectPath: string;
    expiresIn?: number;
  }): Promise<string> {
    const logPrefix = 'GcsStorageService.getSignedDownloadUrl';
    const file = this.requireBucket(logPrefix).file(params.objectPath);
    const expiresIn = params.expiresIn ?? this.downloadUrlExpiry;

    try {
      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + expiresIn * 1000,
        version: 'v4',
      });
      this.logger.debug(`${logPrefix} — path=${params.objectPath} expiresIn=${expiresIn}`);
      return url;
    } catch (error: any) {
      // ADC user credentials cannot sign — fall back to a stream-based proxy
      if (error?.message?.includes('Cannot sign') || error?.message?.includes('client_email')) {
        this.logger.warn(
          `${logPrefix} — signed URL unavailable (no service-account key). Use stream proxy for downloads.`,
        );
        return '';
      }
      this.logger.error(`${logPrefix} — failed path=${params.objectPath}: ${error.message}`);
      throw error;
    }
  }

  getReadStream(objectPath: string): NodeJS.ReadableStream {
    return this.requireBucket('GcsStorageService.getReadStream').file(objectPath).createReadStream();
  }

  async downloadBuffer(objectPath: string): Promise<Buffer> {
    const logPrefix = 'GcsStorageService.downloadBuffer';
    try {
      const [contents] = await this.requireBucket(logPrefix).file(objectPath).download();
      this.logger.debug(`${logPrefix} — path=${objectPath} bytes=${contents.length}`);
      return contents;
    } catch (error: any) {
      this.logger.error(`${logPrefix} — failed path=${objectPath}: ${error.message}`);
      throw error;
    }
  }

  async deleteObject(objectPath: string): Promise<void> {
    const logPrefix = 'GcsStorageService.deleteObject';
    try {
      await this.requireBucket(logPrefix).file(objectPath).delete({ ignoreNotFound: true });
      this.logger.debug(`${logPrefix} — path=${objectPath}`);
    } catch (error: any) {
      this.logger.error(`${logPrefix} — failed path=${objectPath}: ${error.message}`);
      throw error;
    }
  }

  async deletePrefix(prefix: string): Promise<void> {
    const logPrefix = 'GcsStorageService.deletePrefix';
    try {
      await this.requireBucket(logPrefix).deleteFiles({ prefix, force: true });
      this.logger.debug(`${logPrefix} — prefix=${prefix}`);
    } catch (error: any) {
      this.logger.error(`${logPrefix} — failed prefix=${prefix}: ${error.message}`);
      throw error;
    }
  }

  async exists(objectPath: string): Promise<boolean> {
    const [exists] = await this.requireBucket('GcsStorageService.exists').file(objectPath).exists();
    return exists;
  }

  async getMetadata(objectPath: string): Promise<{ size: number; contentType: string } | null> {
    const logPrefix = 'GcsStorageService.getMetadata';
    try {
      const [metadata] = await this.requireBucket(logPrefix).file(objectPath).getMetadata();
      return {
        size: Number(metadata.size ?? 0),
        contentType: metadata.contentType ?? 'application/octet-stream',
      };
    } catch (error: any) {
      if (error?.code === 404) {
        this.logger.debug(`${logPrefix} — not found path=${objectPath}`);
        return null;
      }
      throw error;
    }
  }
}

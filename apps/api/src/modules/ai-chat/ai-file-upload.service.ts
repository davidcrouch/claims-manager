import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { GcsStorageService } from '../../common/gcs/gcs-storage.service';
import { TenantContext } from '../../tenant/tenant-context';
import {
  isChatMimeTypeAllowed,
  MAX_CHAT_FILE_SIZE_BYTES,
} from './chat-attachment.constants';

@Injectable()
export class AiFileUploadService {
  private readonly logger = new Logger(AiFileUploadService.name);

  constructor(
    private readonly gcs: GcsStorageService,
    private readonly tenantContext: TenantContext,
  ) {}

  async uploadFile(params: {
    userId: string;
    conversationId: string;
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number };
  }): Promise<{ uri: string; signedUrl: string }> {
    const tenantId = this.tenantContext.getTenantId();

    if (params.file.size > MAX_CHAT_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        `[AiFileUploadService.uploadFile] file exceeds ${MAX_CHAT_FILE_SIZE_BYTES / (1024 * 1024)} MB limit`,
      );
    }

    if (!isChatMimeTypeAllowed(params.file.mimetype, params.file.originalname)) {
      throw new BadRequestException(
        `[AiFileUploadService.uploadFile] unsupported file type: ${params.file.mimetype}`,
      );
    }

    const objectPath = `chat-attachments/${tenantId}/${params.conversationId}/${Date.now()}-${params.file.originalname}`;

    this.logger.log(
      `[AiFileUploadService.uploadFile] uploading to GCS path=${objectPath} mime=${params.file.mimetype}`,
    );

    const { uri } = await this.gcs.uploadBuffer({
      objectPath,
      buffer: params.file.buffer,
      contentType: params.file.mimetype,
    });

    let signedUrl = '';
    try {
      signedUrl = await this.gcs.getSignedDownloadUrl({ objectPath });
    } catch {
      this.logger.warn(
        `[AiFileUploadService.uploadFile] signed URL generation failed, returning empty`,
      );
    }

    return { uri, signedUrl };
  }

  async getSignedUrl(uri: string): Promise<string> {
    const objectPath = this.parseGcsUri(uri);
    if (!objectPath) {
      throw new BadRequestException('[AiFileUploadService.getSignedUrl] invalid GCS URI');
    }

    this.logger.log(`[AiFileUploadService.getSignedUrl] resolving URL for path=${objectPath}`);
    return this.gcs.getSignedDownloadUrl({ objectPath });
  }

  private parseGcsUri(uri: string): string | null {
    const match = uri.match(/^gs:\/\/[^/]+\/(.+)$/);
    return match?.[1] ?? null;
  }
}

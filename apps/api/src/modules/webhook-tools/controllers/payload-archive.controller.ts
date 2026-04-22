import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { Public } from '../../../auth/decorators/public.decorator';
import { S3Service } from '../../../common/s3/s3.service';
import { ToolAuthGuard } from '../tool-auth.guard';

/**
 * HTTP endpoint that backs `tool.claims-manager-webhook.payload-archive`.
 * Called from the sandboxed inline-ts tool module
 * `apps/api/more0/definitions/tools/payload-archive/payload-archive.ts`.
 */
@Controller('api/v1/webhook-tools/payloads')
@Public()
@UseGuards(ToolAuthGuard)
export class PayloadArchiveController {
  private readonly logger = new Logger('PayloadArchiveController');

  constructor(private readonly s3Service: S3Service) {}

  @Post('archive')
  @HttpCode(HttpStatus.OK)
  async archive(
    @Body()
    body: {
      tenantId: string;
      providerEntityType: string;
      providerEntityId: string;
      payload: Record<string, unknown>;
      hash?: string;
    },
  ): Promise<{
    archiveObjectUri: string;
    bucket: string;
    key: string;
    etag: string | null;
    bytes: number;
    sha256: string;
  }> {
    const logPrefix = 'PayloadArchiveController.archive';
    if (
      !body?.tenantId ||
      !body?.providerEntityType ||
      !body?.providerEntityId ||
      !body?.payload
    ) {
      throw new BadRequestException(
        `${logPrefix} — missing required fields: tenantId, providerEntityType, providerEntityId, payload`,
      );
    }

    const serialized = JSON.stringify(body.payload);
    const sha256 =
      body.hash ?? createHash('sha256').update(serialized).digest('hex');

    const key = this.s3Service.keyForPayload({
      tenantId: body.tenantId,
      providerEntityType: body.providerEntityType,
      providerEntityId: body.providerEntityId,
      hash: sha256.substring(0, 16),
    });

    this.logger.log(
      `${logPrefix} — tenantId=${body.tenantId} ${body.providerEntityType}/${body.providerEntityId} key=${key} bytes=${serialized.length}`,
    );

    const result = await this.s3Service.putJson({
      key,
      body: serialized,
      contentType: 'application/json',
      metadata: {
        tenantId: body.tenantId,
        entityType: body.providerEntityType,
        entityId: body.providerEntityId,
        sha256,
      },
    });

    return {
      archiveObjectUri: result.uri,
      bucket: result.bucket,
      key: result.key,
      etag: result.etag,
      bytes: result.bytes,
      sha256: result.sha256,
    };
  }
}

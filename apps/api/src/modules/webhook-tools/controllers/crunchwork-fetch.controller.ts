import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../../../auth/decorators/public.decorator';
import { CrunchworkService } from '../../../crunchwork/crunchwork.service';
import { ToolAuthGuard } from '../tool-auth.guard';

/**
 * HTTP endpoint that backs `tool.claims-manager-webhook.crunchwork-fetch`.
 * Called from the sandboxed inline-ts tool module
 * `apps/api/more0/definitions/tools/crunchwork-fetch/crunchwork-fetch.ts`.
 */
@Controller('api/v1/webhook-tools/crunchwork')
@Public()
@UseGuards(ToolAuthGuard)
export class CrunchworkFetchController {
  private readonly logger = new Logger('CrunchworkFetchController');

  constructor(private readonly crunchworkService: CrunchworkService) {}

  @Post('fetch')
  @HttpCode(HttpStatus.OK)
  async fetch(
    @Body()
    body: {
      connectionId: string;
      providerEntityType: string;
      providerEntityId: string;
    },
  ): Promise<{ payload: Record<string, unknown> }> {
    this.logger.log(
      `CrunchworkFetchController.fetch — type=${body.providerEntityType} id=${body.providerEntityId}`,
    );

    const payload = await this.crunchworkService.fetchEntityByType({
      connectionId: body.connectionId,
      entityType: body.providerEntityType,
      entityId: body.providerEntityId,
    });

    return { payload };
  }
}

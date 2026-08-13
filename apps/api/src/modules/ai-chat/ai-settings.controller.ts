import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { P } from '../../auth/permission-constants';
import { AiSettingsService } from './ai-settings.service';
import type { UpsertAiSettingsDto } from './ai-chat.types';

@ApiTags('ai-settings')
@Controller('ai-settings')
export class AiSettingsController {
  constructor(private readonly service: AiSettingsService) {}

  @Get()
  @RequirePermission(P.ai.read)
  @ApiOperation({ summary: 'Get tenant AI settings' })
  async getSettings() {
    return this.service.getSettings();
  }

  @Put()
  @RequirePermission(P.ai.manage)
  @ApiOperation({ summary: 'Create or update tenant AI settings' })
  async upsertSettings(@Body() body: UpsertAiSettingsDto) {
    return this.service.upsertSettings(body);
  }
}

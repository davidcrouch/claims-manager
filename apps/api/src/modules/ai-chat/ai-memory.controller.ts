import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { P } from '../../auth/permission-constants';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { TenantContext } from '../../tenant/tenant-context';
import { AiMemoryService } from './ai-memory.service';

@ApiTags('ai-chat')
@Controller('ai-chat/memory')
export class AiMemoryController {
  private readonly logger = new Logger(AiMemoryController.name);

  constructor(
    private readonly memoryService: AiMemoryService,
    private readonly tenantContext: TenantContext,
  ) {}

  @Get()
  @RequirePermission(P.ai.read)
  @ApiOperation({ summary: 'List all user memories' })
  async list(@CurrentUser() user: AuthenticatedUser) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.log(
      `[AiMemoryController.list] tenant=${tenantId} user=${user.sub}`,
    );
    return this.memoryService.listAll(tenantId, user.sub);
  }

  @Post()
  @RequirePermission(P.ai.manage)
  @ApiOperation({ summary: 'Upsert a user memory (remember)' })
  async upsert(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { key: string; value: string; scope?: string; scopeId?: string },
  ) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.log(
      `[AiMemoryController.upsert] tenant=${tenantId} user=${user.sub} key=${body.key}`,
    );
    return this.memoryService.remember({
      tenantId,
      userId: user.sub,
      key: body.key,
      value: body.value,
      scope: body.scope,
      scopeId: body.scopeId,
    });
  }

  @Delete(':id')
  @RequirePermission(P.ai.manage)
  @ApiOperation({ summary: 'Delete a user memory by ID' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.log(
      `[AiMemoryController.remove] tenant=${tenantId} user=${user.sub} id=${id}`,
    );
    await this.memoryService.deleteById(tenantId, id);
    return { deleted: true };
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { TenantContext } from '../../tenant/tenant-context';
import { AiScheduledTasksService } from './ai-scheduled-tasks.service';

@ApiTags('ai-chat')
@Controller('ai-chat/scheduled-tasks')
export class AiScheduledTasksController {
  private readonly logger = new Logger(AiScheduledTasksController.name);

  constructor(
    private readonly tasksService: AiScheduledTasksService,
    private readonly tenantContext: TenantContext,
  ) {}

  @Get()
  @RequirePermission('ai.read')
  @ApiOperation({ summary: 'List scheduled tasks for current user' })
  async list(@CurrentUser() user: AuthenticatedUser) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.log(
      `[AiScheduledTasksController.list] tenant=${tenantId} user=${user.sub}`,
    );
    return this.tasksService.list(tenantId, user.sub);
  }

  @Post()
  @RequirePermission('ai.manage')
  @ApiOperation({ summary: 'Create a new scheduled task' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      name: string;
      scheduleType?: string;
      cronExpression?: string;
      runAt?: string;
      agentId?: string;
      conversationId?: string;
      prompt: string;
    },
  ) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.log(
      `[AiScheduledTasksController.create] tenant=${tenantId} user=${user.sub} name=${body.name}`,
    );
    return this.tasksService.create({
      tenantId,
      userId: user.sub,
      name: body.name,
      scheduleType: body.scheduleType ?? 'cron',
      cronExpression: body.cronExpression ?? null,
      runAt: body.runAt ? new Date(body.runAt) : null,
      agentId: body.agentId ?? null,
      conversationId: body.conversationId ?? null,
      prompt: body.prompt,
    });
  }

  @Patch(':id')
  @RequirePermission('ai.manage')
  @ApiOperation({ summary: 'Update or toggle a scheduled task' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      cronExpression?: string;
      runAt?: string;
      prompt?: string;
      agentId?: string;
      enabled?: boolean;
    },
  ) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.log(
      `[AiScheduledTasksController.update] tenant=${tenantId} user=${user.sub} id=${id}`,
    );
    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.cronExpression !== undefined) updateData.cronExpression = body.cronExpression;
    if (body.runAt !== undefined) updateData.runAt = new Date(body.runAt);
    if (body.prompt !== undefined) updateData.prompt = body.prompt;
    if (body.agentId !== undefined) updateData.agentId = body.agentId;
    if (body.enabled !== undefined) updateData.enabled = body.enabled;

    return this.tasksService.update(tenantId, user.sub, id, updateData);
  }

  @Delete(':id')
  @RequirePermission('ai.manage')
  @ApiOperation({ summary: 'Delete a scheduled task' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.log(
      `[AiScheduledTasksController.remove] tenant=${tenantId} user=${user.sub} id=${id}`,
    );
    await this.tasksService.remove(tenantId, user.sub, id);
    return { deleted: true };
  }
}

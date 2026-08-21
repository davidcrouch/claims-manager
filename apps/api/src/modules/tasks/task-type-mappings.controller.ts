import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { P } from '../../auth/permission-constants';
import { TaskTypeMappingsService } from './task-type-mappings.service';

@Controller('task-type-mappings')
export class TaskTypeMappingsController {
  constructor(private readonly service: TaskTypeMappingsService) {}

  @Get()
  @RequirePermission(P.workflows.read)
  async list(@Query('includeInactive') includeInactive?: string) {
    return this.service.list({
      includeInactive: includeInactive !== 'false' && includeInactive !== '0',
    });
  }

  @Get('task-types')
  @RequirePermission(P.workflows.read)
  async listTaskTypes() {
    return this.service.listCanonicalTypes();
  }

  @Post()
  @RequirePermission(P.org.settings.manage)
  async create(
    @Body()
    body: {
      titlePattern: string;
      taskType: string;
      matchMode?: string;
      priority?: number;
      isActive?: boolean;
    },
  ) {
    return this.service.create(body);
  }

  @Post('backfill')
  @RequirePermission(P.org.settings.manage)
  async backfill() {
    return this.service.backfillUntypedTasks();
  }

  @Patch(':id')
  @RequirePermission(P.org.settings.manage)
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      titlePattern?: string;
      taskType?: string;
      matchMode?: string;
      priority?: number;
      isActive?: boolean;
    },
  ) {
    return this.service.update({ id, ...body });
  }

  @Delete(':id')
  @RequirePermission(P.org.settings.manage)
  async remove(@Param('id') id: string) {
    return this.service.remove({ id });
  }
}

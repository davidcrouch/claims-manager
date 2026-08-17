import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { P } from '../../auth/permission-constants';

@Controller('schedule')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Get('events')
  @RequirePermission(P.workflows.read)
  async findEvents(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('eventType') eventType?: string,
    @Query('jobId') jobId?: string,
    @Query('mine') mine?: string,
    @Query('assignedToUserId') assignedToUserId?: string,
    @Query('limit') limit?: string,
    @CurrentUser('sub') userId?: string,
  ) {
    if (!from || !to) {
      throw new BadRequestException('Both "from" and "to" query parameters are required');
    }

    const parsedFrom = new Date(from);
    const parsedTo = new Date(to);
    if (isNaN(parsedFrom.getTime()) || isNaN(parsedTo.getTime())) {
      throw new BadRequestException('"from" and "to" must be valid ISO date strings');
    }

    const types = eventType
      ? eventType.split(',').map((t) => t.trim()).filter(Boolean)
      : undefined;

    const mineOnly = mine === '1' || mine === 'true';
    const assigneeFilter = mineOnly
      ? userId
      : assignedToUserId?.trim() || undefined;

    return this.scheduleService.findEvents({
      from,
      to,
      eventType: types,
      jobId,
      assignedToUserId: assigneeFilter,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }
}

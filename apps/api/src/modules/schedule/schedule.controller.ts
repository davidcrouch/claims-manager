import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { ScheduleService } from './schedule.service';

@Controller('schedule')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Get('events')
  async findEvents(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('eventType') eventType?: string,
    @Query('jobId') jobId?: string,
    @Query('limit') limit?: string,
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

    return this.scheduleService.findEvents({
      from,
      to,
      eventType: types,
      jobId,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }
}

import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { MessagesService } from './messages.service';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { P } from '../../auth/permission-constants';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('filter-options')
  @RequirePermission(P.messaging.read)
  async findFilterOptions() {
    return this.messagesService.findFilterOptions();
  }

  @Get()
  @RequirePermission(P.messaging.read)
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('jobId') jobId?: string,
    @Query('jobIds') jobIds?: string,
    @Query('claimId') claimId?: string,
    @Query('fromJobId') fromJobId?: string,
    @Query('toJobId') toJobId?: string,
    @Query('readStatus') readStatus?: string,
    @Query('fromUserIds') fromUserIds?: string,
    @Query('toUserIds') toUserIds?: string,
    @Query('fromNames') fromNames?: string,
    @Query('toNames') toNames?: string,
    @Query('search') search?: string,
    @Query('sort') sort?: string,
  ) {
    const jobIdList = jobIds
      ? jobIds.split(',').map((id) => id.trim()).filter((id) => id.length > 0)
      : undefined;
    return this.messagesService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      jobId,
      jobIds: jobIdList && jobIdList.length > 0 ? jobIdList : undefined,
      claimId,
      fromJobId,
      toJobId,
      readStatus,
      fromUserIds,
      toUserIds,
      fromNames,
      toNames,
      search,
      sort,
    });
  }

  @Get(':id')
  @RequirePermission(P.messaging.read)
  async findOne(@Param('id') id: string) {
    return this.messagesService.findOne({ id });
  }

  @Post()
  @RequirePermission(P.messaging.send)
  async create(
    @Body() body: Record<string, unknown>,
    @CurrentUser('sub') userId: string,
  ) {
    return this.messagesService.create({ body, userId });
  }

  @Post(':id/acknowledge')
  @RequirePermission(P.messaging.send)
  async acknowledge(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.messagesService.acknowledge({ id, userId });
  }
}

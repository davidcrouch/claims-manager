import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { MessagesService } from './messages.service';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { P } from '../../auth/permission-constants';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  @RequirePermission(P.messaging.read)
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('jobId') jobId?: string,
    @Query('claimId') claimId?: string,
    @Query('fromJobId') fromJobId?: string,
    @Query('toJobId') toJobId?: string,
  ) {
    return this.messagesService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      jobId,
      claimId,
      fromJobId,
      toJobId,
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

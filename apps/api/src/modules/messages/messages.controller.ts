import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { MessagesService } from './messages.service';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('jobId') jobId?: string,
    @Query('fromJobId') fromJobId?: string,
    @Query('toJobId') toJobId?: string,
  ) {
    return this.messagesService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      jobId,
      fromJobId,
      toJobId,
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.messagesService.findOne({ id });
  }

  @Post()
  async create(
    @Body() body: Record<string, unknown>,
    @CurrentUser('sub') userId: string,
  ) {
    return this.messagesService.create({ body, userId });
  }

  @Post(':id/acknowledge')
  async acknowledge(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.messagesService.acknowledge({ id, userId });
  }
}

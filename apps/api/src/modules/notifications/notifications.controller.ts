import {
  Controller,
  Get,
  Param,
  Patch,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async findAll(
    @Query('entityType') entityType?: string,
    @Query('isRead') isRead?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationsService.findAll({
      entityType,
      isRead: isRead !== undefined ? isRead === 'true' : undefined,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get('unread-count')
  async getUnreadCount() {
    return this.notificationsService.getUnreadCount();
  }

  @Get('unread-entity-ids')
  async getUnreadEntityIds(@Query('entityType') entityType: string) {
    return this.notificationsService.getUnreadEntityIds(entityType);
  }

  @Patch(':id/read')
  async markAsRead(@Param('id', ParseUUIDPipe) id: string) {
    await this.notificationsService.markAsRead(id);
    return { ok: true };
  }

  @Patch('entity/:entityType/:entityId/read')
  async markEntityAsRead(
    @Param('entityType') entityType: string,
    @Param('entityId', ParseUUIDPipe) entityId: string,
  ) {
    return this.notificationsService.markEntityAsRead(entityType, entityId);
  }
}

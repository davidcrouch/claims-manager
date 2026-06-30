import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationsRepository,
  type NotificationRow,
  type NotificationInsert,
} from '../../database/repositories';
import { TenantContext } from '../../tenant/tenant-context';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly notificationsRepo: NotificationsRepository,
    private readonly tenantContext: TenantContext,
  ) {}

  async findAll(params: {
    entityType?: string;
    isRead?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ data: NotificationRow[]; total: number }> {
    const tenantId = this.tenantContext.getTenantId();
    return this.notificationsRepo.findAll({ tenantId, ...params });
  }

  async getUnreadCount(): Promise<{ count: number }> {
    const tenantId = this.tenantContext.getTenantId();
    const count = await this.notificationsRepo.countUnreadByTenant({ tenantId });
    return { count };
  }

  async getUnreadEntityIds(entityType: string): Promise<string[]> {
    const tenantId = this.tenantContext.getTenantId();
    return this.notificationsRepo.getUnreadEntityIds({ tenantId, entityType });
  }

  async markAsRead(id: string): Promise<void> {
    await this.notificationsRepo.markAsRead({ id });
  }

  async markEntityAsRead(entityType: string, entityId: string): Promise<{ updated: number }> {
    const tenantId = this.tenantContext.getTenantId();
    const updated = await this.notificationsRepo.markAsReadByEntity({
      tenantId,
      entityType,
      entityId,
    });
    return { updated };
  }

  async createFromWebhook(params: {
    tenantId: string;
    entityType: string;
    entityId: string;
    eventType: string;
    metadata?: Record<string, unknown>;
  }): Promise<NotificationRow> {
    const title = this.buildTitle(params.eventType, params.entityType);
    return this.notificationsRepo.create({
      data: {
        tenantId: params.tenantId,
        entityType: params.entityType,
        entityId: params.entityId,
        eventType: params.eventType,
        title,
        metadata: params.metadata ?? {},
      },
    });
  }

  private buildTitle(eventType: string, entityType: string): string {
    const label = entityType.replace(/_/g, ' ');
    if (eventType.startsWith('NEW_')) {
      return `New ${label} received`;
    }
    if (eventType.startsWith('UPDATE_')) {
      return `${label.charAt(0).toUpperCase() + label.slice(1)} updated`;
    }
    return `${label.charAt(0).toUpperCase() + label.slice(1)} notification`;
  }
}

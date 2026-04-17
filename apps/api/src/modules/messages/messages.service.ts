import { Injectable, NotImplementedException, Optional, BadRequestException } from '@nestjs/common';
import { MessagesRepository, type MessageInsert } from '../../database/repositories';
import { TenantContext } from '../../tenant/tenant-context';
import { CrunchworkService } from '../../crunchwork/crunchwork.service';
import { ConnectionResolverService } from '../external/connection-resolver.service';

@Injectable()
export class MessagesService {
  private readonly acknowledgeEnabled = process.env.MESSAGE_ACKNOWLEDGE_ENABLED === 'true';

  constructor(
    private readonly messagesRepo: MessagesRepository,
    private readonly tenantContext: TenantContext,
    private readonly crunchworkService: CrunchworkService,
    @Optional() private readonly connectionResolver?: ConnectionResolverService,
  ) {}

  private async resolveConnectionId(tenantId: string): Promise<string> {
    if (!this.connectionResolver) return tenantId;
    const connection = await this.connectionResolver.resolveForTenant({ tenantId });
    if (!connection) {
      throw new BadRequestException('No active CW connection for tenant');
    }
    return connection.id;
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    jobId?: string;
    fromJobId?: string;
    toJobId?: string;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.messagesRepo.findAll({
      tenantId,
      page: params.page,
      limit: params.limit,
      jobId: params.jobId,
      fromJobId: params.fromJobId,
      toJobId: params.toJobId,
    });
  }

  async findOne(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.messagesRepo.findOne({ id: params.id, tenantId });
  }

  async create(params: { body: Record<string, unknown> }) {
    const tenantId = this.tenantContext.getTenantId();
    const connectionId = await this.resolveConnectionId(tenantId);
    const apiMessage = await this.crunchworkService.createMessage({
      connectionId,
      body: params.body,
    });

    const apiObj = apiMessage as Record<string, unknown>;
    const insertData: MessageInsert = {
      tenantId,
      fromClaimId: apiObj.fromClaimId as string,
      fromJobId: apiObj.fromJobId as string,
      toClaimId: apiObj.toClaimId as string,
      toJobId: apiObj.toJobId as string,
      subject: apiObj.subject as string,
      body: apiObj.body as string,
      messagePayload: apiMessage as Record<string, unknown>,
    };
    return this.messagesRepo.create({ data: insertData });
  }

  async acknowledge(params: { id: string }) {
    if (!this.acknowledgeEnabled) {
      throw new NotImplementedException(
        '[MessagesService.acknowledge] Message acknowledgement is Phase 5 - set MESSAGE_ACKNOWLEDGE_ENABLED=true',
      );
    }

    const existing = await this.findOne({ id: params.id });
    if (!existing) return null;

    const tenantId = this.tenantContext.getTenantId();
    const connectionId = await this.resolveConnectionId(tenantId);
    await this.crunchworkService.acknowledgeMessage({
      connectionId,
      messageId: params.id,
    });

    return this.messagesRepo.update({
      id: params.id,
      data: { acknowledgedAt: new Date() },
    });
  }
}

import {
  Injectable,
  Logger,
  NotImplementedException,
  Optional,
  BadRequestException,
} from '@nestjs/common';
import {
  MessagesRepository,
  JobsRepository,
  ClaimsRepository,
  ExternalLinksRepository,
  ExternalObjectsRepository,
  type MessageInsert,
} from '../../database/repositories';
import { TenantContext } from '../../tenant/tenant-context';
import { CrunchworkService } from '../../crunchwork/crunchwork.service';
import { ConnectionResolverService } from '../external/connection-resolver.service';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger('MessagesService');
  private readonly acknowledgeEnabled = process.env.MESSAGE_ACKNOWLEDGE_ENABLED === 'true';

  constructor(
    private readonly messagesRepo: MessagesRepository,
    private readonly jobsRepo: JobsRepository,
    private readonly claimsRepo: ClaimsRepository,
    private readonly externalLinksRepo: ExternalLinksRepository,
    private readonly externalObjectsRepo: ExternalObjectsRepository,
    private readonly tenantContext: TenantContext,
    private readonly crunchworkService: CrunchworkService,
    @Optional() private readonly connectionResolver?: ConnectionResolverService,
  ) {}

  private async resolveConnectionId(tenantId: string): Promise<string> {
    if (!this.connectionResolver) {
      throw new BadRequestException(
        'MessagesService.resolveConnectionId — ConnectionResolverService not available',
      );
    }
    this.crunchworkService.setConnectionResolver(this.connectionResolver);
    const connection = await this.connectionResolver.resolveForTenant({ tenantId });
    if (!connection) {
      throw new BadRequestException('No active CW connection for tenant');
    }
    return connection.id;
  }

  private async resolveProviderJobId(params: {
    tenantId: string;
    internalJobId?: string | null;
  }): Promise<string | undefined> {
    if (!params.internalJobId) return undefined;
    const job = await this.jobsRepo.findByIdAndTenant({
      id: params.internalJobId,
      tenantId: params.tenantId,
    });
    return job?.externalReference ?? job?.externalJobId ?? undefined;
  }

  private async resolveProviderClaimId(params: {
    tenantId: string;
    internalClaimId?: string | null;
  }): Promise<string | undefined> {
    if (!params.internalClaimId) return undefined;
    const claim = await this.claimsRepo.findByIdAndTenant({
      id: params.internalClaimId,
      tenantId: params.tenantId,
    });
    return claim?.externalReference ?? claim?.externalClaimId ?? undefined;
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    jobId?: string;
    claimId?: string;
    fromJobId?: string;
    toJobId?: string;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.messagesRepo.findAll({
      tenantId,
      page: params.page,
      limit: params.limit,
      jobId: params.jobId,
      claimId: params.claimId,
      fromJobId: params.fromJobId,
      toJobId: params.toJobId,
    });
  }

  async findOne(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.messagesRepo.findOne({ id: params.id, tenantId });
  }

  async create(params: { body: Record<string, unknown>; userId?: string }) {
    const logPrefix = 'MessagesService.create';
    const tenantId = this.tenantContext.getTenantId();
    const connectionId = await this.resolveConnectionId(tenantId);

    const internalFromJobId = (params.body.fromJobId as string | undefined) ?? undefined;
    const internalToJobId = (params.body.toJobId as string | undefined) ?? undefined;
    const internalFromClaimId = (params.body.fromClaimId as string | undefined) ?? undefined;
    const internalToClaimId = (params.body.toClaimId as string | undefined) ?? undefined;

    const [cwFromJobId, cwToJobId, cwFromClaimId, cwToClaimId] = await Promise.all([
      this.resolveProviderJobId({ tenantId, internalJobId: internalFromJobId }),
      this.resolveProviderJobId({ tenantId, internalJobId: internalToJobId }),
      this.resolveProviderClaimId({ tenantId, internalClaimId: internalFromClaimId }),
      this.resolveProviderClaimId({ tenantId, internalClaimId: internalToClaimId }),
    ]);

    if (!cwFromJobId && !cwFromClaimId) {
      throw new BadRequestException(
        `${logPrefix} — fromJobId/fromClaimId must resolve to a provider external reference`,
      );
    }
    if (!cwToJobId && !cwToClaimId) {
      throw new BadRequestException(
        `${logPrefix} — toJobId/toClaimId must resolve to a provider external reference`,
      );
    }

    const text =
      (typeof params.body.text === 'string' && params.body.text) ||
      (typeof params.body.body === 'string' && params.body.body) ||
      '';
    if (!text.trim()) {
      throw new BadRequestException(`${logPrefix} — message text is required`);
    }

    // CW maps messageType.externalReference to an internal lookup. Known
    // IAG staging values are "General" and "Status Update" — "Message" is not mapped.
    const messageTypeExtRef =
      (params.body.messageType as { externalReference?: string } | undefined)?.externalReference ??
      (typeof params.body.messageTypeExternalReference === 'string'
        ? params.body.messageTypeExternalReference
        : undefined) ??
      'General';

    const cwBody: Record<string, unknown> = {
      messageType: { externalReference: messageTypeExtRef },
      text,
      acknowledgementRequired: params.body.acknowledgementRequired === true,
    };
    if (cwFromJobId) cwBody.fromJobId = cwFromJobId;
    if (cwToJobId) cwBody.toJobId = cwToJobId;
    if (cwFromClaimId) cwBody.fromClaimId = cwFromClaimId;
    if (cwToClaimId) cwBody.toClaimId = cwToClaimId;
    if (params.body.toAssigneeRole) {
      cwBody.toAssigneeRole = params.body.toAssigneeRole;
    }

    this.logger.log(
      `${logPrefix} — posting to CW connectionId=${connectionId} messageType=${messageTypeExtRef} fromJob=${cwFromJobId ?? 'none'} toJob=${cwToJobId ?? 'none'} fromClaim=${cwFromClaimId ?? 'none'} toClaim=${cwToClaimId ?? 'none'}`,
    );

    const apiMessage = await this.crunchworkService.createMessage({
      connectionId,
      body: cwBody,
    });

    const apiObj = apiMessage as Record<string, unknown>;
    const cwMessageId = typeof apiObj.id === 'string' ? apiObj.id : undefined;
    const subject =
      (typeof params.body.subject === 'string' ? params.body.subject : undefined) ??
      (typeof apiObj.subject === 'string' ? apiObj.subject : undefined);
    const bodyText =
      (typeof apiObj.text === 'string' ? apiObj.text : undefined) ??
      (typeof apiObj.body === 'string' ? apiObj.body : undefined) ??
      text;

    const insertData: MessageInsert = {
      tenantId,
      fromClaimId: internalFromClaimId ?? null,
      fromJobId: internalFromJobId ?? null,
      toClaimId: internalToClaimId ?? null,
      toJobId: internalToJobId ?? null,
      subject: subject ?? null,
      body: bodyText,
      acknowledgementRequired: params.body.acknowledgementRequired === true,
      createdByUserId: params.userId ?? null,
      messagePayload: apiMessage as Record<string, unknown>,
      originType: 'user',
    };

    const created = await this.messagesRepo.create({ data: insertData });

    if (cwMessageId) {
      try {
        const { row: extObj } = await this.externalObjectsRepo.upsert({
          data: {
            tenantId,
            connectionId,
            providerCode: 'crunchwork',
            providerEntityType: 'message',
            providerEntityId: cwMessageId,
            normalizedEntityType: 'message',
            latestPayload: apiMessage as Record<string, unknown>,
            payloadHash: `create-${cwMessageId}`,
            fetchStatus: 'fetched',
            lastFetchedAt: new Date(),
            metadata: {},
          },
        });
        await this.externalLinksRepo.upsert({
          data: {
            tenantId,
            externalObjectId: extObj.id,
            internalEntityType: 'message',
            internalEntityId: created.id,
            linkRole: 'source',
            isPrimary: true,
            metadata: {},
          },
        });
      } catch (err) {
        this.logger.warn(
          `${logPrefix} — failed to link external object for message=${created.id}: ${(err as Error).message}`,
        );
      }
    }

    return created;
  }

  async acknowledge(params: { id: string; userId?: string }) {
    if (!this.acknowledgeEnabled) {
      throw new NotImplementedException(
        '[MessagesService.acknowledge] Message acknowledgement is Phase 5 - set MESSAGE_ACKNOWLEDGE_ENABLED=true',
      );
    }

    const existing = await this.findOne({ id: params.id });
    if (!existing) return null;

    const tenantId = this.tenantContext.getTenantId();
    const connectionId = await this.resolveConnectionId(tenantId);

    const links = await this.externalLinksRepo.findByInternalEntity({
      internalEntityType: 'message',
      internalEntityId: params.id,
    });
    const link = links[0];
    if (!link) {
      throw new BadRequestException(
        'MessagesService.acknowledge — no external link for message; cannot acknowledge in CW',
      );
    }
    const extObj = await this.externalObjectsRepo.findById({ id: link.externalObjectId });
    if (!extObj) {
      throw new BadRequestException(
        'MessagesService.acknowledge — external object not found for message',
      );
    }

    await this.crunchworkService.acknowledgeMessage({
      connectionId,
      messageId: extObj.providerEntityId,
    });

    return this.messagesRepo.update({
      id: params.id,
      data: {
        acknowledgedAt: new Date(),
        ...(params.userId ? { acknowledgedByUserId: params.userId } : {}),
      },
    });
  }
}

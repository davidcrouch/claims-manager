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
  ExternalLinksRepository,
  ExternalObjectsRepository,
  type MessageInsert,
} from '../../database/repositories';
import { TenantContext } from '../../tenant/tenant-context';
import { CrunchworkService } from '../../crunchwork/crunchwork.service';
import { ConnectionResolverService } from '../external/connection-resolver.service';
import { MESSAGE_SUBJECTS, isMessageSubject } from './message-subjects';
import { attachJobSummaries } from '../../common/attach-job-summaries';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger('MessagesService');
  private readonly acknowledgeEnabled = process.env.MESSAGE_ACKNOWLEDGE_ENABLED === 'true';

  constructor(
    private readonly messagesRepo: MessagesRepository,
    private readonly jobsRepo: JobsRepository,
    private readonly externalLinksRepo: ExternalLinksRepository,
    private readonly externalObjectsRepo: ExternalObjectsRepository,
    private readonly tenantContext: TenantContext,
    private readonly crunchworkService: CrunchworkService,
    @Optional() private readonly connectionResolver?: ConnectionResolverService,
  ) {}

  private async resolveConnection(params: { tenantId: string }): Promise<{
    connectionId: string;
    fromTenantId: string;
  }> {
    const logPrefix = 'MessagesService.resolveConnection';
    if (!this.connectionResolver) {
      throw new BadRequestException(
        `${logPrefix} — ConnectionResolverService not available`,
      );
    }
    this.crunchworkService.setConnectionResolver(this.connectionResolver);
    const connection = await this.connectionResolver.resolveForTenant({
      tenantId: params.tenantId,
    });
    if (!connection) {
      throw new BadRequestException(`${logPrefix} — no active CW connection for tenant`);
    }
    const fromTenantId = connection.providerTenantId?.trim() ?? '';
    if (!fromTenantId) {
      throw new BadRequestException(
        `${logPrefix} — connection missing providerTenantId`,
      );
    }
    return { connectionId: connection.id, fromTenantId };
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

  async findAll(params: {
    page?: number;
    limit?: number;
    jobId?: string;
    jobIds?: string[];
    claimId?: string;
    fromJobId?: string;
    toJobId?: string;
    readStatus?: string;
    fromUserIds?: string;
    toUserIds?: string;
    fromNames?: string;
    toNames?: string;
    search?: string;
    sort?: string;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    const result = await this.messagesRepo.findAll({
      tenantId,
      page: params.page,
      limit: params.limit,
      jobId: params.jobId,
      jobIds: params.jobIds,
      claimId: params.claimId,
      fromJobId: params.fromJobId,
      toJobId: params.toJobId,
      readStatus: params.readStatus,
      fromUserIds: params.fromUserIds,
      toUserIds: params.toUserIds,
      fromNames: params.fromNames,
      toNames: params.toNames,
      search: params.search,
      sort: params.sort,
    });
    return {
      data: await attachJobSummaries({
        tenantId,
        rows: result.data,
        jobsRepo: this.jobsRepo,
        jobIdOf: (row) => row.toJobId ?? row.fromJobId,
      }),
      total: result.total,
    };
  }

  async findFilterOptions() {
    const tenantId = this.tenantContext.getTenantId();
    return this.messagesRepo.findFilterOptions({ tenantId });
  }

  async findOne(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.messagesRepo.findOne({ id: params.id, tenantId });
  }

  async create(params: { body: Record<string, unknown>; userId?: string }) {
    const logPrefix = 'MessagesService.create';
    const tenantId = this.tenantContext.getTenantId();
    const { connectionId, fromTenantId } = await this.resolveConnection({ tenantId });

    const internalFromJobId = (params.body.fromJobId as string | undefined) ?? undefined;
    const internalToJobId = (params.body.toJobId as string | undefined) ?? undefined;
    const internalFromClaimId = (params.body.fromClaimId as string | undefined) ?? undefined;
    const internalToClaimId = (params.body.toClaimId as string | undefined) ?? undefined;
    this.logger.log(
      `${logPrefix} — incoming keys=${Object.keys(params.body).join(',')} fromJobId=${internalFromJobId ?? 'none'} toJobId=${internalToJobId ?? 'none'} fromClaimId=${internalFromClaimId ?? 'none'} toClaimId=${internalToClaimId ?? 'none'}`,
    );

    const [cwFromJobId, cwToJobId] = await Promise.all([
      this.resolveProviderJobId({ tenantId, internalJobId: internalFromJobId }),
      this.resolveProviderJobId({ tenantId, internalJobId: internalToJobId }),
    ]);

    if (!cwFromJobId) {
      throw new BadRequestException(
        `${logPrefix} — fromJobId must resolve to a provider external reference`,
      );
    }
    if (!cwToJobId) {
      throw new BadRequestException(
        `${logPrefix} — toJobId must resolve to a provider external reference`,
      );
    }

    const text =
      (typeof params.body.text === 'string' && params.body.text) ||
      (typeof params.body.body === 'string' && params.body.body) ||
      '';
    if (!text.trim()) {
      throw new BadRequestException(`${logPrefix} — message text is required`);
    }

    const subjectRaw =
      typeof params.body.subject === 'string' ? params.body.subject.trim() : '';
    if (!subjectRaw) {
      throw new BadRequestException(`${logPrefix} — subject is required`);
    }
    if (!isMessageSubject(subjectRaw)) {
      throw new BadRequestException(
        `${logPrefix} — subject must be one of: ${MESSAGE_SUBJECTS.join(', ')}`,
      );
    }
    const subject = subjectRaw;

    const cwBody: Record<string, unknown> = {
      messageType: { externalReference: subject },
      text,
      acknowledgementRequired: params.body.acknowledgementRequired === true,
      fromJobId: cwFromJobId,
      toJobId: cwToJobId,
      fromTenantId,
    };

    this.logger.log(
      `${logPrefix} — posting to CW connectionId=${connectionId} messageType=${subject} fromJob=${cwFromJobId} toJob=${cwToJobId} fromTenantId=${fromTenantId}`,
    );

    const apiMessage = await this.crunchworkService.createMessage({
      connectionId,
      body: cwBody,
    });

    const apiObj = apiMessage as Record<string, unknown>;
    const cwMessageId = typeof apiObj.id === 'string' ? apiObj.id : undefined;
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
      subject: subject,
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
    const { connectionId } = await this.resolveConnection({ tenantId });

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

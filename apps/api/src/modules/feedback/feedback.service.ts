import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  FeedbackItemsRepository,
  UsersRepository,
  type FeedbackItemRow,
} from '../../database/repositories';
import { TenantContext } from '../../tenant/tenant-context';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { UpdateFeedbackDto } from './dto/update-feedback.dto';

function formatReporterLabel(params: {
  name?: string | null;
  email?: string | null;
  fallbackId?: string | null;
}): string {
  const name = params.name?.trim() || null;
  const email = params.email?.trim() || null;
  if (name && email) return `${name} (${email})`;
  if (name) return name;
  if (email) return email;
  return params.fallbackId?.trim() || 'Unknown user';
}

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(
    private readonly feedbackRepo: FeedbackItemsRepository,
    private readonly usersRepo: UsersRepository,
    private readonly tenantContext: TenantContext,
  ) {}

  async create(params: {
    dto: CreateFeedbackDto;
    userId: string;
    email?: string;
  }): Promise<FeedbackItemRow> {
    const tenantId = this.tenantContext.getTenantId();
    const reporter = await this.resolveReporter({
      tenantId,
      userId: params.userId,
      email: params.email,
    });
    this.logger.log(
      `FeedbackService.create: type=${params.dto.type} title="${params.dto.title}" user=${reporter.userId} label="${reporter.label}"`,
    );
    return this.feedbackRepo.create({
      data: {
        tenantId,
        type: params.dto.type,
        title: params.dto.title,
        description: params.dto.description,
        priority: params.dto.priority ?? 'medium',
        reportedByUserId: reporter.userId,
        reportedByName: reporter.label,
        pageContext: params.dto.pageContext ?? {},
        relatedEntityType: params.dto.relatedEntityType,
        relatedEntityId: params.dto.relatedEntityId,
        conversationId: params.dto.conversationId,
        tags: params.dto.tags ?? [],
        payload: params.dto.payload ?? {},
      },
    });
  }

  async findAll(params: {
    type?: string;
    status?: string;
    priority?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: FeedbackItemRow[]; total: number }> {
    const tenantId = this.tenantContext.getTenantId();
    const result = await this.feedbackRepo.findAll({ tenantId, ...params });
    return {
      data: await this.enrichReporterLabels(result.data),
      total: result.total,
    };
  }

  async findOne(id: string): Promise<FeedbackItemRow> {
    const tenantId = this.tenantContext.getTenantId();
    const row = await this.feedbackRepo.findOne({ id, tenantId });
    if (!row) {
      throw new NotFoundException(`Feedback item ${id} not found`);
    }
    const [enriched] = await this.enrichReporterLabels([row]);
    return enriched;
  }

  async update(params: {
    id: string;
    dto: UpdateFeedbackDto;
  }): Promise<FeedbackItemRow> {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.log(
      `FeedbackService.update: id=${params.id} fields=${Object.keys(params.dto).join(',')}`,
    );
    const row = await this.feedbackRepo.update({
      id: params.id,
      tenantId,
      data: params.dto,
    });
    if (!row) {
      throw new NotFoundException(`Feedback item ${params.id} not found`);
    }
    const [enriched] = await this.enrichReporterLabels([row]);
    return enriched;
  }

  async getStats(): Promise<{
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    total: number;
  }> {
    const tenantId = this.tenantContext.getTenantId();
    const [byStatus, byType] = await Promise.all([
      this.feedbackRepo.countByStatus({ tenantId }),
      this.feedbackRepo.countByType({ tenantId }),
    ]);
    const total = Object.values(byStatus).reduce((sum, n) => sum + n, 0);
    return { byStatus, byType, total };
  }

  private async resolveReporter(params: {
    tenantId: string;
    userId: string;
    email?: string;
  }): Promise<{ userId: string; label: string }> {
    const orgUserId = await this.usersRepo.resolveOrgUserId({
      organizationId: params.tenantId,
      userId: params.userId,
      email: params.email,
    });
    const user = orgUserId
      ? await this.usersRepo.findById({ id: orgUserId })
      : null;
    return {
      userId: orgUserId ?? params.userId,
      label: formatReporterLabel({
        name: user?.name,
        email: user?.email ?? params.email,
        fallbackId: params.userId,
      }),
    };
  }

  /** Fill reportedByName from users table when missing or still a raw id. */
  private async enrichReporterLabels(
    rows: FeedbackItemRow[],
  ): Promise<FeedbackItemRow[]> {
    if (rows.length === 0) return rows;

    const needsLookup = rows.filter(
      (row) =>
        !row.reportedByName ||
        row.reportedByName === row.reportedByUserId ||
        looksLikeRawId(row.reportedByName),
    );
    if (needsLookup.length === 0) return rows;

    const byId = new Map<string, { name: string | null; email: string | null }>();
    await Promise.all(
      [...new Set(needsLookup.map((r) => r.reportedByUserId))].map(async (id) => {
        const user = await this.usersRepo.findById({ id });
        if (user) byId.set(id, { name: user.name, email: user.email });
      }),
    );

    return rows.map((row) => {
      const user = byId.get(row.reportedByUserId);
      if (!user) return row;
      const label = formatReporterLabel({
        name: user.name,
        email: user.email,
        fallbackId: row.reportedByUserId,
      });
      if (label === row.reportedByName) return row;
      return { ...row, reportedByName: label };
    });
  }
}

function looksLikeRawId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

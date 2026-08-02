import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ilike } from 'drizzle-orm';
import {
  ConversationRepository,
  type ChatConversationRow,
} from '../../database/repositories/conversation.repository';
import { TenantContext } from '../../tenant/tenant-context';

const LOG_PREFIX = 'ConversationsService';

export interface ConversationListItem {
  id: string;
  title: string | null;
  agentId: string | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  pinnedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationDetail extends ConversationListItem {
  messages: unknown[];
}

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    private readonly repo: ConversationRepository,
    private readonly tenantContext: TenantContext,
  ) {}

  private getTenantId(): string {
    return this.tenantContext.getTenantId();
  }

  private toListItem(row: ChatConversationRow): ConversationListItem {
    return {
      id: row.id,
      title: row.title,
      agentId: row.agentId,
      relatedEntityType: row.relatedEntityType,
      relatedEntityId: row.relatedEntityId,
      pinnedAt: row.pinnedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private assertOwner(row: ChatConversationRow, userId: string): void {
    if (row.userId !== userId) {
      throw new ForbiddenException(
        `[${LOG_PREFIX}] conversation does not belong to user`,
      );
    }
  }

  async list(userId: string, search?: string): Promise<ConversationListItem[]> {
    const tenantId = this.getTenantId();
    const rows = await this.repo.findByUser({ tenantId, userId, search });
    return rows.map((row) => this.toListItem(row));
  }

  async getById(userId: string, conversationId: string): Promise<ConversationDetail> {
    const tenantId = this.getTenantId();
    const row = await this.repo.findById(conversationId, tenantId);
    if (!row) {
      throw new NotFoundException(
        `[${LOG_PREFIX}.getById] conversation not found id=${conversationId}`,
      );
    }
    this.assertOwner(row, userId);

    return {
      ...this.toListItem(row),
      messages: (row.messagesJsonb as unknown[]) ?? [],
    };
  }

  async create(
    userId: string,
    title?: string,
    clientId?: string,
    agentId?: string,
    relatedEntityType?: string,
    relatedEntityId?: string,
  ): Promise<{ id: string }> {
    const tenantId = this.getTenantId();
    const created = await this.repo.create({
      ...(clientId ? { id: clientId } : {}),
      tenantId,
      userId,
      title: title ?? 'New conversation',
      agentId: agentId ?? null,
      relatedEntityType: relatedEntityType ?? null,
      relatedEntityId: relatedEntityId ?? null,
      messagesJsonb: [],
    });

    this.logger.log(
      `[${LOG_PREFIX}.create] conversation ${created.id} for user ${userId}`,
    );
    return { id: created.id };
  }

  async update(
    userId: string,
    conversationId: string,
    data: {
      title?: string;
      messages?: unknown[];
      agentId?: string;
      pinned?: boolean;
      relatedEntityType?: string;
      relatedEntityId?: string;
    },
  ): Promise<ConversationDetail> {
    const tenantId = this.getTenantId();
    const existing = await this.repo.findById(conversationId, tenantId);
    if (!existing) {
      throw new NotFoundException(
        `[${LOG_PREFIX}.update] conversation not found id=${conversationId}`,
      );
    }
    this.assertOwner(existing, userId);

    const updatePayload: Record<string, unknown> = {};
    if (data.title !== undefined) updatePayload.title = data.title;
    if (data.messages !== undefined) updatePayload.messagesJsonb = data.messages;
    if (data.agentId !== undefined) updatePayload.agentId = data.agentId;
    if (data.relatedEntityType !== undefined) updatePayload.relatedEntityType = data.relatedEntityType;
    if (data.relatedEntityId !== undefined) updatePayload.relatedEntityId = data.relatedEntityId;
    if (data.pinned !== undefined) {
      updatePayload.pinnedAt = data.pinned ? new Date() : null;
    }

    const updated = await this.repo.update(conversationId, tenantId, updatePayload);

    if (!updated) {
      throw new NotFoundException(
        `[${LOG_PREFIX}.update] failed to update conversation id=${conversationId}`,
      );
    }

    return {
      ...this.toListItem(updated),
      messages: (updated.messagesJsonb as unknown[]) ?? [],
    };
  }

  async delete(
    userId: string,
    conversationId: string,
  ): Promise<{ deleted: boolean }> {
    const tenantId = this.getTenantId();
    const existing = await this.repo.findById(conversationId, tenantId);
    if (!existing) {
      throw new NotFoundException(
        `[${LOG_PREFIX}.delete] conversation not found id=${conversationId}`,
      );
    }
    this.assertOwner(existing, userId);

    await this.repo.delete(conversationId, tenantId);
    this.logger.log(
      `[${LOG_PREFIX}.delete] conversation ${conversationId} deleted`,
    );
    return { deleted: true };
  }

  async pinConversation(userId: string, conversationId: string): Promise<void> {
    const tenantId = this.getTenantId();
    const existing = await this.repo.findById(conversationId, tenantId);
    if (!existing) {
      throw new NotFoundException(
        `[${LOG_PREFIX}.pinConversation] conversation not found id=${conversationId}`,
      );
    }
    this.assertOwner(existing, userId);

    await this.repo.update(conversationId, tenantId, { pinnedAt: new Date() });
    this.logger.log(`[${LOG_PREFIX}.pinConversation] pinned ${conversationId}`);
  }

  async unpinConversation(userId: string, conversationId: string): Promise<void> {
    const tenantId = this.getTenantId();
    const existing = await this.repo.findById(conversationId, tenantId);
    if (!existing) {
      throw new NotFoundException(
        `[${LOG_PREFIX}.unpinConversation] conversation not found id=${conversationId}`,
      );
    }
    this.assertOwner(existing, userId);

    await this.repo.update(conversationId, tenantId, { pinnedAt: null });
    this.logger.log(`[${LOG_PREFIX}.unpinConversation] unpinned ${conversationId}`);
  }

  async createShare(
    userId: string,
    conversationId: string,
    expiresInDays?: number,
  ): Promise<{ token: string; expiresAt: string | null }> {
    const tenantId = this.getTenantId();
    const existing = await this.repo.findById(conversationId, tenantId);
    if (!existing) {
      throw new NotFoundException(
        `[${LOG_PREFIX}.createShare] conversation not found id=${conversationId}`,
      );
    }
    this.assertOwner(existing, userId);

    const token = crypto.randomUUID().replace(/-/g, '');
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    await this.repo.createShare({
      tenantId,
      conversationId,
      createdBy: userId,
      shareToken: token,
      expiresAt,
    });

    this.logger.log(
      `[${LOG_PREFIX}.createShare] share created for conversation=${conversationId} token=${token}`,
    );
    return { token, expiresAt: expiresAt?.toISOString() ?? null };
  }

  async getSharedConversation(token: string): Promise<ConversationDetail | null> {
    const share = await this.repo.findShareByToken(token);
    if (!share) return null;
    if (share.expiresAt && new Date(share.expiresAt) < new Date()) return null;

    const row = await this.repo.findById(share.conversationId, share.tenantId);
    if (!row) return null;

    return {
      ...this.toListItem(row),
      messages: (row.messagesJsonb as unknown[]) ?? [],
    };
  }
}

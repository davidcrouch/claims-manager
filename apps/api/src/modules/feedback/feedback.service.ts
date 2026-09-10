import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FeedbackItemsRepository,
  FeedbackNotesRepository,
  UsersRepository,
  type FeedbackItemRow,
  type FeedbackNoteRow,
} from '../../database/repositories';
import { TenantContext } from '../../tenant/tenant-context';
import { EmailService } from '../communications/email/email.service';
import { EmailTemplateService } from '../communications/templates/email-template.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { UpdateFeedbackDto } from './dto/update-feedback.dto';

export type FeedbackActor = {
  userId: string;
  email?: string;
};

export type FeedbackNoteView = {
  id: string;
  body: string;
  createdByUserId: string | null;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
  canEdit: boolean;
};

export type FeedbackItemView = FeedbackItemRow & {
  notes: FeedbackNoteView[];
};

function stripTrailingEmail(label: string): string {
  const stripped = label.replace(/\s*\([^)]*@[^)]*\)\s*$/, '').trim();
  return stripped || label;
}

function formatReporterLabel(params: {
  name?: string | null;
  email?: string | null;
  fallbackId?: string | null;
}): string {
  const name = params.name?.trim() || null;
  if (name) return stripTrailingEmail(name);
  const email = params.email?.trim() || null;
  if (email) return email;
  return params.fallbackId?.trim() || 'Unknown user';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const TYPE_LABELS: Record<string, string> = {
  bug: 'Bug',
  feature_request: 'Feature Request',
  enhancement: 'Enhancement',
  question: 'Question',
  comment: 'Comment',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(
    private readonly feedbackRepo: FeedbackItemsRepository,
    private readonly notesRepo: FeedbackNotesRepository,
    private readonly usersRepo: UsersRepository,
    private readonly tenantContext: TenantContext,
    private readonly emailService: EmailService,
    private readonly emailTemplateService: EmailTemplateService,
    private readonly configService: ConfigService,
  ) {}

  async create(params: {
    dto: CreateFeedbackDto;
    userId: string;
    email?: string;
  }): Promise<FeedbackItemView> {
    const tenantId = this.tenantContext.getTenantId();
    const reporter = await this.resolveReporter({
      tenantId,
      userId: params.userId,
      email: params.email,
    });
    this.logger.log(
      `FeedbackService.create: type=${params.dto.type} title="${params.dto.title}" user=${reporter.userId} label="${reporter.label}"`,
    );
    const row = await this.feedbackRepo.create({
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
    this.queueSubmitterNotification({
      tenantId,
      item: row,
      actor: { userId: params.userId, email: params.email },
      kind: 'submitted',
      fallbackEmail: params.email,
    });
    return this.shapeItem({
      row,
      notes: [],
      actorIds: await this.resolveActorIds({ tenantId, actor: params }),
    });
  }

  async findAll(params: {
    type?: string;
    status?: string;
    priority?: string;
    search?: string;
    page?: number;
    limit?: number;
    actor?: FeedbackActor;
  }): Promise<{ data: FeedbackItemView[]; total: number }> {
    const tenantId = this.tenantContext.getTenantId();
    const result = await this.feedbackRepo.findAll({ tenantId, ...params });
    const actorIds = await this.resolveActorIds({ tenantId, actor: params.actor });
    return {
      data: await this.attachNotes({ rows: result.data, tenantId, actorIds }),
      total: result.total,
    };
  }

  async findOne(params: {
    id: string;
    actor?: FeedbackActor;
  }): Promise<FeedbackItemView> {
    const tenantId = this.tenantContext.getTenantId();
    const row = await this.feedbackRepo.findOne({ id: params.id, tenantId });
    if (!row) {
      throw new NotFoundException(`FeedbackService.findOne: item ${params.id} not found`);
    }
    const actorIds = await this.resolveActorIds({ tenantId, actor: params.actor });
    const [shaped] = await this.attachNotes({ rows: [row], tenantId, actorIds });
    return shaped;
  }

  async update(params: {
    id: string;
    dto: UpdateFeedbackDto;
    actor?: FeedbackActor;
  }): Promise<FeedbackItemView> {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.log(
      `FeedbackService.update: id=${params.id} fields=${Object.keys(params.dto).join(',')}`,
    );
    const existing = await this.feedbackRepo.findOne({ id: params.id, tenantId });
    if (!existing) {
      throw new NotFoundException(`FeedbackService.update: item ${params.id} not found`);
    }
    const previousStatus = existing.status;
    const row = await this.feedbackRepo.update({
      id: params.id,
      tenantId,
      data: params.dto,
    });
    if (!row) {
      throw new NotFoundException(`FeedbackService.update: item ${params.id} not found`);
    }
    if (params.dto.status && params.dto.status !== previousStatus) {
      this.queueSubmitterNotification({
        tenantId,
        item: row,
        actor: params.actor,
        kind: 'status',
        previousStatus,
        newStatus: params.dto.status,
      });
    }
    const actorIds = await this.resolveActorIds({ tenantId, actor: params.actor });
    const [shaped] = await this.attachNotes({ rows: [row], tenantId, actorIds });
    return shaped;
  }

  async addNote(params: {
    feedbackId: string;
    body: string;
    actor: FeedbackActor;
  }): Promise<FeedbackItemView> {
    const logPrefix = 'FeedbackService.addNote';
    const tenantId = this.tenantContext.getTenantId();
    const body = params.body.trim();
    if (!body) {
      throw new BadRequestException(`${logPrefix}: body is required`);
    }
    const item = await this.feedbackRepo.findOne({ id: params.feedbackId, tenantId });
    if (!item) {
      throw new NotFoundException(`${logPrefix}: item ${params.feedbackId} not found`);
    }
    const author = await this.resolveReporter({
      tenantId,
      userId: params.actor.userId,
      email: params.actor.email,
    });
    this.logger.log(
      `${logPrefix}: feedbackId=${params.feedbackId} user=${author.userId} label="${author.label}"`,
    );
    await this.notesRepo.create({
      data: {
        tenantId,
        feedbackItemId: params.feedbackId,
        body,
        createdByUserId: author.userId,
        createdByName: author.label,
      },
    });
    this.queueSubmitterNotification({
      tenantId,
      item,
      actor: params.actor,
      kind: 'note',
      noteBody: body,
      actorName: author.label,
    });
    return this.findOne({ id: params.feedbackId, actor: params.actor });
  }

  async updateNote(params: {
    feedbackId: string;
    noteId: string;
    body: string;
    actor: FeedbackActor;
  }): Promise<FeedbackItemView> {
    const logPrefix = 'FeedbackService.updateNote';
    const tenantId = this.tenantContext.getTenantId();
    const body = params.body.trim();
    if (!body) {
      throw new BadRequestException(`${logPrefix}: body is required`);
    }
    const note = await this.notesRepo.findOne({
      id: params.noteId,
      feedbackItemId: params.feedbackId,
      tenantId,
    });
    if (!note) {
      throw new NotFoundException(`${logPrefix}: note ${params.noteId} not found`);
    }
    const actorIds = await this.resolveActorIds({ tenantId, actor: params.actor });
    this.assertOwnNote({ logPrefix, note, actorIds });
    this.logger.log(
      `${logPrefix}: feedbackId=${params.feedbackId} noteId=${params.noteId} user=${params.actor.userId}`,
    );
    await this.notesRepo.update({ id: params.noteId, tenantId, body });
    return this.findOne({ id: params.feedbackId, actor: params.actor });
  }

  async deleteNote(params: {
    feedbackId: string;
    noteId: string;
    actor: FeedbackActor;
  }): Promise<FeedbackItemView> {
    const logPrefix = 'FeedbackService.deleteNote';
    const tenantId = this.tenantContext.getTenantId();
    const note = await this.notesRepo.findOne({
      id: params.noteId,
      feedbackItemId: params.feedbackId,
      tenantId,
    });
    if (!note) {
      throw new NotFoundException(`${logPrefix}: note ${params.noteId} not found`);
    }
    const actorIds = await this.resolveActorIds({ tenantId, actor: params.actor });
    this.assertOwnNote({ logPrefix, note, actorIds });
    this.logger.log(
      `${logPrefix}: feedbackId=${params.feedbackId} noteId=${params.noteId} user=${params.actor.userId}`,
    );
    await this.notesRepo.delete({ id: params.noteId, tenantId });
    return this.findOne({ id: params.feedbackId, actor: params.actor });
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

  private queueSubmitterNotification(params: {
    tenantId: string;
    item: FeedbackItemRow;
    actor?: FeedbackActor;
    kind: 'note' | 'status' | 'submitted';
    noteBody?: string;
    actorName?: string;
    previousStatus?: string;
    newStatus?: string;
    fallbackEmail?: string;
  }): void {
    void this.notifySubmitter(params).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `FeedbackService.notifySubmitter: failed feedbackId=${params.item.id} kind=${params.kind}: ${message}`,
      );
    });
  }

  private async notifySubmitter(params: {
    tenantId: string;
    item: FeedbackItemRow;
    actor?: FeedbackActor;
    kind: 'note' | 'status' | 'submitted';
    noteBody?: string;
    actorName?: string;
    previousStatus?: string;
    newStatus?: string;
    fallbackEmail?: string;
  }): Promise<void> {
    const logPrefix = 'FeedbackService.notifySubmitter';
    const recipient = await this.resolveSubmitterEmail({
      tenantId: params.tenantId,
      item: params.item,
      fallbackEmail: params.fallbackEmail ?? params.actor?.email,
    });
    if (!recipient) {
      this.logger.log(
        `${logPrefix}: no email for submitter feedbackId=${params.item.id} user=${params.item.reportedByUserId}`,
      );
      return;
    }

    const templateType =
      params.kind === 'submitted'
        ? 'feedback_submitted'
        : params.kind === 'note'
          ? 'feedback_note_added'
          : params.newStatus === 'resolved'
            ? 'feedback_resolved_verify'
            : 'feedback_status_changed';
    const template = await this.emailTemplateService.resolve({
      tenantId: params.tenantId,
      templateType,
    });
    const url = this.feedbackItemUrl(params.item.id);
    const title = params.item.title?.trim() || 'Feedback item';
    const noteBody = params.noteBody?.trim() || '';
    const description = params.item.description?.trim() || '';
    const typeLabel = TYPE_LABELS[params.item.type] ?? params.item.type;
    const rendered = this.emailTemplateService.renderTemplate(template, {
      recipient_name: recipient.name,
      recipient_name_html: escapeHtml(recipient.name),
      actor_name: params.actorName?.trim() || 'A teammate',
      actor_name_html: escapeHtml(params.actorName?.trim() || 'A teammate'),
      feedback_title: title,
      feedback_title_html: escapeHtml(title),
      type_label: typeLabel,
      description,
      description_html: escapeHtml(description).replace(/\r?\n/g, '<br/>') || 'No description.',
      note_body: noteBody,
      note_body_html: escapeHtml(noteBody).replace(/\r?\n/g, '<br/>'),
      previous_status_label: STATUS_LABELS[params.previousStatus ?? ''] ?? params.previousStatus ?? '',
      status_label: STATUS_LABELS[params.newStatus ?? ''] ?? params.newStatus ?? '',
      feedback_url: url,
      feedback_link_html: url
        ? `<p style="color: #333; line-height: 1.6;"><a href="${escapeHtml(url)}" style="color: #2563eb;">Open this feedback item</a></p>`
        : '',
    });

    const result = await this.emailService.send({
      to: recipient.email,
      subject: rendered.subject,
      html: rendered.bodyHtml,
      text: rendered.bodyText,
      tags: [
        {
          name: 'category',
          value:
            params.kind === 'submitted'
              ? 'feedback-submitted'
              : params.kind === 'note'
                ? 'feedback-note'
                : 'feedback-status',
        },
      ],
    });
    if (!result.success) {
      this.logger.error(
        `${logPrefix}: send failed feedbackId=${params.item.id} kind=${params.kind}: ${result.error ?? 'unknown'}`,
      );
      return;
    }
    this.logger.log(
      `${logPrefix}: sent feedbackId=${params.item.id} kind=${params.kind} template=${templateType} to=${recipient.email}`,
    );
  }

  private async resolveSubmitterEmail(params: {
    tenantId: string;
    item: FeedbackItemRow;
    fallbackEmail?: string;
  }): Promise<{ email: string; name: string } | null> {
    let user = await this.usersRepo.findById({ id: params.item.reportedByUserId });
    if (!user) {
      const orgUserId = await this.usersRepo.resolveOrgUserId({
        organizationId: params.tenantId,
        userId: params.item.reportedByUserId,
        email: params.fallbackEmail,
      });
      if (orgUserId) {
        user = await this.usersRepo.findById({ id: orgUserId });
      }
    }
    const email = user?.email?.trim() || params.fallbackEmail?.trim();
    if (!email) return null;
    return {
      email,
      name: formatReporterLabel({
        name: user?.name,
        fallbackId: params.item.reportedByName,
      }),
    };
  }

  private feedbackItemUrl(id: string): string {
    const base = (
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5000'
    ).replace(/\/+$/, '');
    return `${base}/admin/feedback?open=${encodeURIComponent(id)}`;
  }

  private assertOwnNote(params: {
    logPrefix: string;
    note: FeedbackNoteRow;
    actorIds: Set<string>;
  }) {
    const authorId = params.note.createdByUserId?.trim();
    if (!authorId || !params.actorIds.has(authorId)) {
      throw new ForbiddenException(
        `${params.logPrefix}: you can only change notes you submitted`,
      );
    }
  }

  private async resolveActorIds(params: {
    tenantId: string;
    actor?: FeedbackActor;
  }): Promise<Set<string>> {
    const ids = new Set<string>();
    const userId = params.actor?.userId?.trim();
    if (userId) ids.add(userId);
    if (!params.actor) return ids;
    const orgUserId = await this.usersRepo.resolveOrgUserId({
      organizationId: params.tenantId,
      userId: params.actor.userId,
      email: params.actor.email,
    });
    if (orgUserId) ids.add(orgUserId);
    return ids;
  }

  private async attachNotes(params: {
    rows: FeedbackItemRow[];
    tenantId: string;
    actorIds: Set<string>;
  }): Promise<FeedbackItemView[]> {
    const enriched = await this.enrichReporterLabels(params.rows);
    if (enriched.length === 0) return [];
    const notes = await this.notesRepo.findByFeedbackItemIds({
      tenantId: params.tenantId,
      feedbackItemIds: enriched.map((row) => row.id),
    });
    const notesByItem = new Map<string, FeedbackNoteRow[]>();
    for (const note of notes) {
      const list = notesByItem.get(note.feedbackItemId) ?? [];
      list.push(note);
      notesByItem.set(note.feedbackItemId, list);
    }
    return enriched.map((row) =>
      this.shapeItem({
        row,
        notes: notesByItem.get(row.id) ?? [],
        actorIds: params.actorIds,
      }),
    );
  }

  private shapeItem(params: {
    row: FeedbackItemRow;
    notes: FeedbackNoteRow[];
    actorIds: Set<string>;
  }): FeedbackItemView {
    return {
      ...params.row,
      notes: params.notes.map((note) => this.shapeNote({ note, actorIds: params.actorIds })),
    };
  }

  private shapeNote(params: {
    note: FeedbackNoteRow;
    actorIds: Set<string>;
  }): FeedbackNoteView {
    const authorId = params.note.createdByUserId?.trim() || null;
    const name = params.note.createdByName?.trim() || null;
    return {
      id: params.note.id,
      body: params.note.body,
      createdByUserId: authorId,
      createdByName: name ? stripTrailingEmail(name) : name,
      createdAt: params.note.createdAt,
      updatedAt: params.note.updatedAt,
      canEdit: !!authorId && params.actorIds.has(authorId),
    };
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

    const byId = new Map<string, { name: string | null; email: string | null }>();
    await Promise.all(
      [...new Set(needsLookup.map((r) => r.reportedByUserId))].map(async (id) => {
        const user = await this.usersRepo.findById({ id });
        if (user) byId.set(id, { name: user.name, email: user.email });
      }),
    );

    return rows.map((row) => {
      const user = byId.get(row.reportedByUserId);
      const label = user
        ? formatReporterLabel({
            name: user.name,
            email: user.email,
            fallbackId: row.reportedByUserId,
          })
        : row.reportedByName
          ? stripTrailingEmail(row.reportedByName)
          : row.reportedByName;
      if (!label || label === row.reportedByName) return row;
      return { ...row, reportedByName: label };
    });
  }
}

function looksLikeRawId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

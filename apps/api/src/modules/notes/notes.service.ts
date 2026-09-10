import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  JobNotesRepository,
  JobsRepository,
  UsersRepository,
  type JobNoteRow,
} from '../../database/repositories';
import { TenantContext } from '../../tenant/tenant-context';
import { CreateNoteDto } from './dto/create-note.dto';
import { attachJobSummaries } from '../../common/attach-job-summaries';

function formatAuthorLabel(params: {
  name?: string | null;
  email?: string | null;
  fallbackId?: string | null;
}): string {
  const name = params.name?.trim() || null;
  const email = params.email?.trim() || null;
  if (name) return name;
  if (email) return email;
  return params.fallbackId?.trim() || 'Unknown user';
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

@Injectable()
export class NotesService {
  private readonly logger = new Logger('NotesService');

  constructor(
    private readonly notesRepo: JobNotesRepository,
    private readonly jobsRepo: JobsRepository,
    private readonly usersRepo: UsersRepository,
    private readonly tenantContext: TenantContext,
  ) {}

  async findAll(params: {
    page?: number;
    limit?: number;
    jobId?: string;
    jobIds?: string[];
    search?: string;
    sort?: string;
  }): Promise<{ data: JobNoteRow[]; total: number }> {
    const tenantId = this.tenantContext.getTenantId();
    const result = await this.notesRepo.findAll({
      tenantId,
      page: params.page,
      limit: params.limit,
      jobId: params.jobId,
      jobIds: params.jobIds,
      search: params.search,
      sort: params.sort,
    });
    return {
      data: await attachJobSummaries({
        tenantId,
        rows: result.data,
        jobsRepo: this.jobsRepo,
      }),
      total: result.total,
    };
  }

  async findOne(params: { id: string }): Promise<JobNoteRow> {
    const tenantId = this.tenantContext.getTenantId();
    const row = await this.notesRepo.findOne({ id: params.id, tenantId });
    if (!row) {
      throw new NotFoundException(`NotesService.findOne — note ${params.id} not found`);
    }
    return row;
  }

  async create(params: {
    dto: CreateNoteDto;
    userId: string;
    email?: string;
  }): Promise<JobNoteRow> {
    const logPrefix = 'NotesService.create';
    const tenantId = this.tenantContext.getTenantId();
    const body = params.dto.body?.trim() ?? '';
    if (!stripHtml(body)) {
      throw new BadRequestException(`${logPrefix} — body is required`);
    }

    const job = await this.jobsRepo.findByIdAndTenant({
      id: params.dto.jobId,
      tenantId,
    });
    if (!job) {
      throw new BadRequestException(`${logPrefix} — job ${params.dto.jobId} not found`);
    }

    const author = await this.resolveAuthor({
      tenantId,
      userId: params.userId,
      email: params.email,
    });

    this.logger.log(
      `${logPrefix} — jobId=${params.dto.jobId} user=${author.userId} label="${author.label}"`,
    );

    return this.notesRepo.create({
      data: {
        tenantId,
        jobId: params.dto.jobId,
        body,
        createdByUserId: author.userId,
        createdByName: author.label,
      },
    });
  }

  async delete(params: { id: string }): Promise<{ deleted: true }> {
    const logPrefix = 'NotesService.delete';
    const tenantId = this.tenantContext.getTenantId();
    const deleted = await this.notesRepo.delete({ id: params.id, tenantId });
    if (!deleted) {
      throw new NotFoundException(`${logPrefix} — note ${params.id} not found`);
    }
    this.logger.log(`${logPrefix} — id=${params.id}`);
    return { deleted: true };
  }

  private async resolveAuthor(params: {
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
      label: formatAuthorLabel({
        name: user?.name,
        email: user?.email ?? params.email,
        fallbackId: params.userId,
      }),
    };
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JournalsService } from './journals.service';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { P } from '../../auth/permission-constants';
import {
  CreateJournalDto,
  UpdateJournalDto,
  LinkJournalDto,
  CreateJournalPageDto,
  UpdateJournalPageDto,
  CreatePageAttachmentDto,
  ReorderPagesDto,
} from './dto';

@Controller('journals')
export class JournalsController {
  constructor(private readonly journalsService: JournalsService) {}

  @Get()
  @RequirePermission(P.journals.read)
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('jobId') jobId?: string,
  ) {
    return this.journalsService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      status,
      jobId,
    });
  }

  @Get('entity/:entityType/:entityId')
  @RequirePermission(P.journals.read)
  async findByEntity(
    @Param('entityType') entityType: string,
    @Param('entityId', ParseUUIDPipe) entityId: string,
  ) {
    return this.journalsService.findByEntity({ entityType, entityId });
  }

  @Get(':id')
  @RequirePermission(P.journals.read)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.journalsService.findOne({ id });
  }

  @Post()
  @RequirePermission(P.journals.manage)
  async create(
    @Body() dto: CreateJournalDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.journalsService.create({ dto, userId });
  }

  @Patch(':id')
  @RequirePermission(P.journals.manage)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateJournalDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.journalsService.update({ id, dto, userId });
  }

  @Delete(':id')
  @RequirePermission(P.journals.manage)
  async softDelete(@Param('id', ParseUUIDPipe) id: string) {
    return this.journalsService.softDelete({ id });
  }

  // -- Entity linking --

  @Post(':journalId/link')
  @RequirePermission(P.journals.manage)
  async linkToEntity(
    @Param('journalId', ParseUUIDPipe) journalId: string,
    @Body() dto: LinkJournalDto,
  ) {
    return this.journalsService.linkToEntity({
      journalId,
      entityType: dto.entityType,
      entityId: dto.entityId,
    });
  }

  @Delete(':journalId/link/:entityType/:entityId')
  @RequirePermission(P.journals.manage)
  async unlinkFromEntity(
    @Param('journalId', ParseUUIDPipe) journalId: string,
    @Param('entityType') entityType: string,
    @Param('entityId', ParseUUIDPipe) entityId: string,
  ) {
    return this.journalsService.unlinkFromEntity({ journalId, entityType, entityId });
  }

  // -- Pages --

  @Get(':journalId/pages')
  @RequirePermission(P.journals.read)
  async getPages(
    @Param('journalId', ParseUUIDPipe) journalId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.journalsService.getPages({
      journalId,
      limit: limit ? parseInt(limit, 10) : 20,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  @Get(':journalId/pages/:pageId')
  @RequirePermission(P.journals.read)
  async getPage(
    @Param('journalId', ParseUUIDPipe) journalId: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
  ) {
    return this.journalsService.getPage({ journalId, pageId });
  }

  @Post(':journalId/pages')
  @RequirePermission(P.journals.manage)
  async createPage(
    @Param('journalId', ParseUUIDPipe) journalId: string,
    @Body() dto: CreateJournalPageDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.journalsService.createPage({ journalId, dto, userId });
  }

  @Patch(':journalId/pages/:pageId')
  @RequirePermission(P.journals.manage)
  async updatePage(
    @Param('journalId', ParseUUIDPipe) journalId: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Body() dto: UpdateJournalPageDto,
  ) {
    return this.journalsService.updatePage({ journalId, pageId, dto });
  }

  @Delete(':journalId/pages/:pageId')
  @RequirePermission(P.journals.manage)
  async deletePage(
    @Param('journalId', ParseUUIDPipe) journalId: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
  ) {
    return this.journalsService.deletePage({ journalId, pageId });
  }

  @Post(':journalId/pages/reorder')
  @RequirePermission(P.journals.manage)
  async reorderPages(
    @Param('journalId', ParseUUIDPipe) journalId: string,
    @Body() dto: ReorderPagesDto,
  ) {
    return this.journalsService.reorderPages({ journalId, pageIds: dto.pageIds });
  }

  // -- Attachments --

  @Post(':journalId/pages/:pageId/attachments')
  @RequirePermission(P.journals.manage)
  async createAttachment(
    @Param('journalId', ParseUUIDPipe) journalId: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Body() dto: CreatePageAttachmentDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.journalsService.createAttachment({ journalId, pageId, dto, userId });
  }

  @Delete(':journalId/pages/:pageId/attachments/:attachmentId')
  @RequirePermission(P.journals.manage)
  async deleteAttachment(
    @Param('journalId', ParseUUIDPipe) journalId: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ) {
    return this.journalsService.deleteAttachment({ journalId, pageId, attachmentId });
  }

  // -- File upload (presigned URL) --

  @Post(':journalId/pages/:pageId/upload-url')
  @RequirePermission(P.journals.manage)
  async getUploadUrl(
    @Param('journalId', ParseUUIDPipe) journalId: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Body() body: { fileName: string; mimeType: string },
  ) {
    return this.journalsService.getUploadUrl({ journalId, pageId, fileName: body.fileName, mimeType: body.mimeType });
  }

  @Get(':journalId/pages/:pageId/attachments/:attachmentId/download')
  @RequirePermission(P.journals.read)
  async getDownloadUrl(
    @Param('journalId', ParseUUIDPipe) journalId: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ) {
    return this.journalsService.getDownloadUrl({ journalId, pageId, attachmentId });
  }

  /** Stream bytes through the API (local ADC cannot mint signed URLs). */
  @Get(':journalId/pages/:pageId/attachments/:attachmentId/stream')
  @RequirePermission(P.journals.read)
  async streamAttachment(
    @Param('journalId', ParseUUIDPipe) journalId: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { stream, fileName, mimeType } = await this.journalsService.getDownloadStream({
      journalId,
      pageId,
      attachmentId,
    });
    res.set({
      'Content-Type': mimeType || 'application/octet-stream',
      'Cache-Control': 'private, max-age=300',
      'Content-Disposition': `inline; filename="${encodeURIComponent(fileName)}"`,
    });
    return new StreamableFile(stream as any);
  }
}

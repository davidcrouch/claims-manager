import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JournalsService } from './journals.service';
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
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.journalsService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      status,
    });
  }

  @Get('entity/:entityType/:entityId')
  async findByEntity(
    @Param('entityType') entityType: string,
    @Param('entityId', ParseUUIDPipe) entityId: string,
  ) {
    return this.journalsService.findByEntity({ entityType, entityId });
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.journalsService.findOne({ id });
  }

  @Post()
  async create(
    @Body() dto: CreateJournalDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.journalsService.create({ dto, userId });
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateJournalDto,
  ) {
    return this.journalsService.update({ id, dto });
  }

  @Delete(':id')
  async softDelete(@Param('id', ParseUUIDPipe) id: string) {
    return this.journalsService.softDelete({ id });
  }

  // -- Entity linking --

  @Post(':journalId/link')
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
  async unlinkFromEntity(
    @Param('journalId', ParseUUIDPipe) journalId: string,
    @Param('entityType') entityType: string,
    @Param('entityId', ParseUUIDPipe) entityId: string,
  ) {
    return this.journalsService.unlinkFromEntity({ journalId, entityType, entityId });
  }

  // -- Pages --

  @Get(':journalId/pages')
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
  async getPage(
    @Param('journalId', ParseUUIDPipe) journalId: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
  ) {
    return this.journalsService.getPage({ journalId, pageId });
  }

  @Post(':journalId/pages')
  async createPage(
    @Param('journalId', ParseUUIDPipe) journalId: string,
    @Body() dto: CreateJournalPageDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.journalsService.createPage({ journalId, dto, userId });
  }

  @Patch(':journalId/pages/:pageId')
  async updatePage(
    @Param('journalId', ParseUUIDPipe) journalId: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Body() dto: UpdateJournalPageDto,
  ) {
    return this.journalsService.updatePage({ journalId, pageId, dto });
  }

  @Delete(':journalId/pages/:pageId')
  async deletePage(
    @Param('journalId', ParseUUIDPipe) journalId: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
  ) {
    return this.journalsService.deletePage({ journalId, pageId });
  }

  @Post(':journalId/pages/reorder')
  async reorderPages(
    @Param('journalId', ParseUUIDPipe) journalId: string,
    @Body() dto: ReorderPagesDto,
  ) {
    return this.journalsService.reorderPages({ journalId, pageIds: dto.pageIds });
  }

  // -- Attachments --

  @Post(':journalId/pages/:pageId/attachments')
  async createAttachment(
    @Param('journalId', ParseUUIDPipe) journalId: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Body() dto: CreatePageAttachmentDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.journalsService.createAttachment({ journalId, pageId, dto, userId });
  }

  @Delete(':journalId/pages/:pageId/attachments/:attachmentId')
  async deleteAttachment(
    @Param('journalId', ParseUUIDPipe) journalId: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ) {
    return this.journalsService.deleteAttachment({ journalId, pageId, attachmentId });
  }

  // -- File upload (presigned URL) --

  @Post(':journalId/pages/:pageId/upload-url')
  async getUploadUrl(
    @Param('journalId', ParseUUIDPipe) journalId: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Body() body: { fileName: string; mimeType: string },
  ) {
    return this.journalsService.getUploadUrl({ journalId, pageId, fileName: body.fileName, mimeType: body.mimeType });
  }

  @Get(':journalId/pages/:pageId/attachments/:attachmentId/download')
  async getDownloadUrl(
    @Param('journalId', ParseUUIDPipe) journalId: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ) {
    return this.journalsService.getDownloadUrl({ journalId, pageId, attachmentId });
  }
}

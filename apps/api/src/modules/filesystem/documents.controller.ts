import { Body, Controller, Delete, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { DocumentsService } from './documents.service';
import {
  CreateDocumentUploadUrlDto,
  BatchUploadUrlsDto,
  UploadCompleteDto,
  AssignCategoryDto,
  BulkAssignCategoryDto,
} from './dto';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('uncategorised') uncategorised?: string,
    @Query('relatedRecordType') relatedRecordType?: string,
    @Query('relatedRecordId') relatedRecordId?: string,
    @Query('uploadStatus') uploadStatus?: string,
    @Query('sort') sort?: string,
  ) {
    return this.documentsService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
      categoryId,
      uncategorised: uncategorised === 'true',
      relatedRecordType,
      relatedRecordId,
      uploadStatus,
      sort,
    });
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.documentsService.findOne(id);
  }

  @Post('upload-url')
  async generateUploadUrl(
    @Body() dto: CreateDocumentUploadUrlDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.documentsService.generateUploadUrl(dto, userId);
  }

  @Post('upload-urls')
  async generateBatchUploadUrls(
    @Body() dto: BatchUploadUrlsDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.documentsService.generateBatchUploadUrls(dto, userId);
  }

  @Post('upload-complete')
  async markUploadComplete(@Body() dto: UploadCompleteDto) {
    return this.documentsService.markUploadComplete(dto.documentId);
  }

  @Post('upload-failed')
  async markUploadFailed(@Body() dto: UploadCompleteDto) {
    return this.documentsService.markUploadFailed(dto.documentId);
  }

  @Patch(':id/category')
  async assignCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignCategoryDto,
  ) {
    return this.documentsService.assignCategory(id, dto.categoryId);
  }

  @Post('bulk-category')
  async bulkAssignCategory(@Body() dto: BulkAssignCategoryDto) {
    return this.documentsService.bulkAssignCategory(dto.documentIds, dto.categoryId);
  }

  @Get(':id/download-url')
  async getDownloadUrl(@Param('id', ParseUUIDPipe) id: string) {
    return this.documentsService.getDownloadUrl(id);
  }

  @Get(':id/stream')
  async streamDownload(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { stream, fileName, mimeType } = await this.documentsService.getDownloadStream(id);
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
    });
    return new StreamableFile(stream as any);
  }

  @Post(':id/archive')
  async archive(@Param('id', ParseUUIDPipe) id: string) {
    return this.documentsService.archive(id);
  }

  @Delete(':id')
  async hardDelete(@Param('id', ParseUUIDPipe) id: string) {
    return this.documentsService.hardDelete(id);
  }
}

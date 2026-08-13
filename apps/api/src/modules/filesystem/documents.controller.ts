import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { DocumentsService } from './documents.service';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { P } from '../../auth/permission-constants';
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
  @RequirePermission(P.documents.read)
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('uncategorised') uncategorised?: string,
    @Query('relatedRecordType') relatedRecordType?: string,
    @Query('relatedRecordId') relatedRecordId?: string,
    @Query('filesystemId') filesystemId?: string,
    @Query('jobId') jobId?: string,
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
      filesystemId,
      jobId,
      uploadStatus,
      sort,
    });
  }

  @Get('counts')
  @RequirePermission(P.documents.read)
  async countByCategory(
    @Query('filesystemId') filesystemId?: string,
  ) {
    return this.documentsService.countByCategory(filesystemId);
  }

  @Get(':id')
  @RequirePermission(P.documents.read)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.documentsService.findOne(id);
  }

  @Post('upload-url')
  @RequirePermission(P.documents.manage)
  async generateUploadUrl(
    @Body() dto: CreateDocumentUploadUrlDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.documentsService.generateUploadUrl(dto, userId);
  }

  @Post('upload-urls')
  @RequirePermission(P.documents.manage)
  async generateBatchUploadUrls(
    @Body() dto: BatchUploadUrlsDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.documentsService.generateBatchUploadUrls(dto, userId);
  }

  @Post('upload-complete')
  @RequirePermission(P.documents.manage)
  async markUploadComplete(@Body() dto: UploadCompleteDto) {
    return this.documentsService.markUploadComplete(dto.documentId, dto.thumbnailObjectPath);
  }

  @Post('upload-failed')
  @RequirePermission(P.documents.manage)
  async markUploadFailed(@Body() dto: UploadCompleteDto) {
    return this.documentsService.markUploadFailed(dto.documentId);
  }

  @Patch(':id/category')
  @RequirePermission(P.documents.manage)
  async assignCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignCategoryDto,
  ) {
    return this.documentsService.assignCategory(id, dto.categoryId);
  }

  @Post('bulk-category')
  @RequirePermission(P.documents.manage)
  async bulkAssignCategory(@Body() dto: BulkAssignCategoryDto) {
    return this.documentsService.bulkAssignCategory(dto.documentIds, dto.categoryId);
  }

  @Get(':id/download-url')
  @RequirePermission(P.documents.read)
  async getDownloadUrl(@Param('id', ParseUUIDPipe) id: string) {
    return this.documentsService.getDownloadUrl(id);
  }

  @Get(':id/thumbnail')
  @RequirePermission(P.documents.read)
  async getThumbnailUrl(@Param('id', ParseUUIDPipe) id: string) {
    return this.documentsService.getThumbnailUrl(id);
  }

  @Get(':id/thumbnail/stream')
  @RequirePermission(P.documents.read)
  async streamThumbnail(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { stream, contentType } = await this.documentsService.getThumbnailStream(id);
    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=300',
    });
    return new StreamableFile(stream as any);
  }

  @Get(':id/stream')
  @RequirePermission(P.documents.read)
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
  @RequirePermission(P.documents.manage)
  async archive(@Param('id', ParseUUIDPipe) id: string) {
    return this.documentsService.archive(id);
  }

  @Delete(':id')
  @RequirePermission(P.documents.manage)
  async hardDelete(@Param('id', ParseUUIDPipe) id: string) {
    return this.documentsService.hardDelete(id);
  }
}

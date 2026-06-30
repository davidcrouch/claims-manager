import { Body, Controller, Get, Param, Post, Query, Res, NotFoundException, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { AttachmentsService } from './attachments.service';

@Controller('attachments')
export class AttachmentsController {
  private readonly logger = new Logger('AttachmentsController');

  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Get()
  async find(
    @Query('relatedRecordType') relatedRecordType?: string,
    @Query('relatedRecordId') relatedRecordId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('sort') sort?: string,
  ) {
    if (relatedRecordType && relatedRecordId) {
      return this.attachmentsService.findByRelatedRecord({
        relatedRecordType,
        relatedRecordId,
      });
    }
    return this.attachmentsService.findAll({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search: search || undefined,
      relatedRecordType: relatedRecordType || undefined,
      sort,
    });
  }

  @Get(':id/download')
  async download(
    @Param('id') id: string,
    @Query('disposition') disposition: string | undefined,
    @Res() res: Response,
  ) {
    const inline = disposition === 'inline';
    const result = await this.attachmentsService.getDownloadStream({ id, inline });
    if (!result) {
      throw new NotFoundException('Attachment not found');
    }

    const { stream, contentType, contentDisposition } = result;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', contentDisposition);
    stream.pipe(res);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.attachmentsService.findOne({ id });
  }

  @Post()
  async create(@Body() body: Record<string, unknown>) {
    return this.attachmentsService.create({ body });
  }

  @Post(':id')
  async update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.attachmentsService.update({ id, body });
  }
}

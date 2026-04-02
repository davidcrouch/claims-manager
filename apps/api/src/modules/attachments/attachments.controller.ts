import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AttachmentsService } from './attachments.service';

@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Get()
  async findByRelatedRecord(
    @Query('relatedRecordType') relatedRecordType?: string,
    @Query('relatedRecordId') relatedRecordId?: string,
  ) {
    if (relatedRecordType && relatedRecordId) {
      return this.attachmentsService.findByRelatedRecord({
        relatedRecordType,
        relatedRecordId,
      });
    }
    return [];
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

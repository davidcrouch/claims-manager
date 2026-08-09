import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  Res,
  Logger,
  StreamableFile,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { DocumentGenerationService } from './document-generation.service';
import { GenerateDocumentDto } from './dto/generate-document.dto';

@ApiTags('Generated Documents')
@Controller('generated-documents')
export class DocumentGenerationController {
  private readonly logger = new Logger('DocumentGenerationController');

  constructor(private readonly documentGenService: DocumentGenerationService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate a PDF document from an entity' })
  async generate(
    @Body() dto: GenerateDocumentDto,
    @CurrentUser('sub') userId?: string,
  ) {
    return this.documentGenService.generate({
      documentType: dto.documentType,
      entityId: dto.entityId,
      templateId: dto.templateId,
      filesystemDocumentId: dto.filesystemDocumentId,
      destinationCategoryId: dto.destinationCategoryId,
      trigger: 'manual',
      userId,
    });
  }

  @Get()
  @ApiOperation({ summary: 'List generated documents for the current tenant' })
  async findAll(
    @Query('documentType') documentType?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.documentGenService.findAll({
      documentType: documentType || undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a generated document by ID' })
  async findById(@Param('id') id: string) {
    return this.documentGenService.findById({ id });
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Get a presigned download URL for a generated document' })
  async download(
    @Param('id') id: string,
    @Query('format') format?: 'pdf' | 'docx',
  ) {
    return this.documentGenService.getDownloadUrl({ id, format });
  }

  @Get(':id/stream')
  @ApiOperation({ summary: 'Stream a generated document (ADC / local fallback)' })
  async stream(
    @Param('id') id: string,
    @Query('format') format: 'pdf' | 'docx' | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { stream, fileName, mimeType } = await this.documentGenService.getDownloadStream({
      id,
      format,
    });
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
    });
    return new StreamableFile(stream as any);
  }

  @Post(':id/regenerate')
  @ApiOperation({ summary: 'Regenerate a document with the same or a new template' })
  async regenerate(
    @Param('id') id: string,
    @Body('templateId') templateId?: string,
  ) {
    return this.documentGenService.regenerate({ id, templateId });
  }
}

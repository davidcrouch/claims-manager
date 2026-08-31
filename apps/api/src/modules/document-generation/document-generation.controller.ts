import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Res,
  Logger,
  StreamableFile,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { DocumentGenerationService } from './document-generation.service';
import { GenerateDocumentDto } from './dto/generate-document.dto';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { P } from '../../auth/permission-constants';
import { DOCUMENT_TYPES, type DocumentType } from './types/document-types';
import { getSourceJsonSchema, getAllSourceJsonSchemas } from './schemas/json-schema';
import { TransformService } from './services/transform.service';
import { DataContextService, enrichSourceSchemaWithDataContext } from './data-context';
import { TRANSFORM_DEFAULTS } from './schemas/target/defaults';

@ApiTags('Generated Documents')
@Controller('generated-documents')
export class DocumentGenerationController {
  private readonly logger = new Logger('DocumentGenerationController');

  constructor(
    private readonly documentGenService: DocumentGenerationService,
    private readonly transformService: TransformService,
    private readonly dataContextService: DataContextService,
  ) {}

  @Post('generate')
  @RequirePermission(P.documents.manage)
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
      enabledSlugs: dto.enabledSlugs,
      createPdf: dto.createPdf,
      trigger: 'manual',
      userId,
    });
  }

  @Get()
  @RequirePermission(P.documents.read)
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

  @Get('schemas/source')
  @RequirePermission(P.documents.read)
  @ApiOperation({ summary: 'List all source schemas as JSON Schema' })
  async listSourceSchemas() {
    return getAllSourceJsonSchemas();
  }

  @Get('schemas/source/:documentType')
  @RequirePermission(P.documents.read)
  @ApiOperation({ summary: 'Get the source schema for a document type as JSON Schema' })
  async getSourceSchema(@Param('documentType') documentType: string) {
    if (!(DOCUMENT_TYPES as readonly string[]).includes(documentType)) {
      return { error: `Unknown document type "${documentType}"` };
    }
    const type = documentType as DocumentType;
    const baseSchema = getSourceJsonSchema(type);
    const contextConfig = await this.dataContextService.getConfig({ documentType: type });
    const schema = enrichSourceSchemaWithDataContext({
      documentType: type,
      baseSchema,
      enabledSlugs: contextConfig.available ? contextConfig.enabledSlugs : null,
    });
    return {
      documentType,
      schema,
    };
  }

  @Get('transforms/:documentType')
  @RequirePermission(P.documents.read)
  @ApiOperation({ summary: 'Get the transform config (JSONata rules + target schema) for a document type' })
  async getTransform(@Param('documentType') documentType: string) {
    this.assertValidDocumentType(documentType);
    const data = await this.transformService.getTransformWithDefaults({
      documentType: documentType as DocumentType,
    });
    const defaults = TRANSFORM_DEFAULTS[documentType as DocumentType];
    return {
      documentType,
      ...data,
      defaultJsonataRules: defaults?.jsonataRules ?? null,
      defaultTargetSchema: defaults?.targetSchema ?? null,
    };
  }

  @Put('transforms/:documentType')
  @RequirePermission(P.documents.manage)
  @ApiOperation({ summary: 'Create or update the transform config for a document type' })
  async upsertTransform(
    @Param('documentType') documentType: string,
    @Body() body: { jsonataRules?: string; targetSchema?: unknown; testData?: unknown },
    @CurrentUser('sub') userId?: string,
  ) {
    this.assertValidDocumentType(documentType);
    const row = await this.transformService.upsertTransform({
      documentType: documentType as DocumentType,
      jsonataRules: body.jsonataRules,
      targetSchema: body.targetSchema,
      testData: body.testData,
      userId,
    });
    return { documentType, transform: row };
  }

  @Delete('transforms/:documentType')
  @RequirePermission(P.documents.manage)
  @ApiOperation({ summary: 'Delete the custom transform, reverting to built-in defaults' })
  async deleteTransform(@Param('documentType') documentType: string) {
    this.assertValidDocumentType(documentType);
    const deleted = await this.transformService.deleteTransform({
      documentType: documentType as DocumentType,
    });
    return { documentType, deleted };
  }

  @Post('transforms/:documentType/preview')
  @RequirePermission(P.documents.read)
  @ApiOperation({ summary: 'Evaluate JSONata rules against source data without saving' })
  async previewTransform(
    @Param('documentType') documentType: string,
    @Body() body: { sourceData: Record<string, unknown>; jsonataRules: string },
  ) {
    this.assertValidDocumentType(documentType);
    if (!body.jsonataRules || !body.sourceData) {
      throw new BadRequestException('Both sourceData and jsonataRules are required');
    }
    return this.transformService.previewTransform({
      documentType: documentType as DocumentType,
      jsonataRules: body.jsonataRules,
      sourceData: body.sourceData,
    });
  }

  @Get('transforms/:documentType/versions')
  @RequirePermission(P.documents.read)
  @ApiOperation({ summary: 'Get version history of a transform' })
  async getTransformVersions(@Param('documentType') documentType: string) {
    this.assertValidDocumentType(documentType);
    return this.transformService.getVersionHistory({
      documentType: documentType as DocumentType,
    });
  }

  @Post('transforms/:documentType/sample-data')
  @RequirePermission(P.documents.read)
  @ApiOperation({ summary: 'Run mapper to get sample source data for a real entity' })
  async getSampleData(
    @Param('documentType') documentType: string,
    @Body() body: { entityId: string; enabledSlugs?: string[] },
  ) {
    this.assertValidDocumentType(documentType);
    if (!body.entityId) {
      throw new BadRequestException('entityId is required');
    }
    const data = await this.documentGenService.getSampleData({
      documentType: documentType as DocumentType,
      entityId: body.entityId,
      enabledSlugs: body.enabledSlugs,
    });
    return { documentType, data };
  }

  @Get('data-context/:documentType')
  @RequirePermission(P.documents.read)
  @ApiOperation({
    summary: 'Get data context definition and tenant enabled related-entity slugs',
  })
  async getDataContext(@Param('documentType') documentType: string) {
    this.assertValidDocumentType(documentType);
    const config = await this.dataContextService.getConfig({
      documentType: documentType as DocumentType,
    });
    return { documentType, ...config };
  }

  @Put('data-context/:documentType')
  @RequirePermission(P.documents.manage)
  @ApiOperation({ summary: 'Update which related entities are enabled for a document type' })
  async upsertDataContext(
    @Param('documentType') documentType: string,
    @Body() body: { enabledSlugs: string[] },
  ) {
    this.assertValidDocumentType(documentType);
    if (!Array.isArray(body.enabledSlugs)) {
      throw new BadRequestException('enabledSlugs must be an array of strings');
    }
    const row = await this.dataContextService.upsertConfig({
      documentType: documentType as DocumentType,
      enabledSlugs: body.enabledSlugs,
    });
    return { documentType, config: row };
  }

  @Post('data-context/:documentType/preview')
  @RequirePermission(P.documents.read)
  @ApiOperation({ summary: 'Resolve a data context envelope for a real entity' })
  async previewDataContext(
    @Param('documentType') documentType: string,
    @Body() body: { entityId: string; enabledSlugs?: string[] },
  ) {
    this.assertValidDocumentType(documentType);
    if (!body.entityId) {
      throw new BadRequestException('entityId is required');
    }
    const result = await this.dataContextService.preview({
      documentType: documentType as DocumentType,
      entityId: body.entityId,
      enabledSlugs: body.enabledSlugs,
    });
    return { documentType, ...result };
  }

  private assertValidDocumentType(documentType: string): asserts documentType is DocumentType {
    if (!(DOCUMENT_TYPES as readonly string[]).includes(documentType)) {
      throw new BadRequestException(`Unknown document type "${documentType}"`);
    }
  }

  @Get(':id')
  @RequirePermission(P.documents.read)
  @ApiOperation({ summary: 'Get a generated document by ID' })
  async findById(@Param('id') id: string) {
    return this.documentGenService.findById({ id });
  }

  @Get(':id/download')
  @RequirePermission(P.documents.read)
  @ApiOperation({ summary: 'Get a presigned download URL for a generated document' })
  async download(
    @Param('id') id: string,
    @Query('format') format?: 'pdf' | 'docx',
  ) {
    return this.documentGenService.getDownloadUrl({ id, format });
  }

  @Get(':id/stream')
  @RequirePermission(P.documents.read)
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
  @RequirePermission(P.documents.manage)
  @ApiOperation({ summary: 'Regenerate a document with the same or a new template' })
  async regenerate(
    @Param('id') id: string,
    @Body('templateId') templateId?: string,
  ) {
    return this.documentGenService.regenerate({ id, templateId });
  }
}

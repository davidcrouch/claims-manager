import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Body,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TenantContext } from '../../../tenant/tenant-context';
import { TemplateRegistryService } from '../services/template-registry.service';
import { TemplateEngineService } from '../services/template-engine.service';
import { AssignTemplateDto } from '../dto/assign-template.dto';
import { UpdateTemplatesFolderDto } from '../dto/update-templates-folder.dto';
import { RequirePermission } from '../../../auth/decorators/require-permission.decorator';
import { P } from '../../../auth/permission-constants';
import {
  ASSIGNABLE_TEMPLATE_TYPES,
  isAssignableTemplateType,
  type AssignableTemplateType,
} from '../types/document-types';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const HTMLtoDOCX = require('html-to-docx');

@ApiTags('Document Templates')
@Controller('document-templates')
export class TemplatesController {
  private readonly logger = new Logger('TemplatesController');

  constructor(
    private readonly templateRegistry: TemplateRegistryService,
    private readonly templateEngine: TemplateEngineService,
    private readonly tenantContext: TenantContext,
  ) {}

  @Get()
  @RequirePermission(P.documents.read)
  @ApiOperation({ summary: 'List template settings for all generation scenarios' })
  async getSettings() {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(`TemplatesController.getSettings — tenantId=${tenantId}`);
    return this.templateRegistry.getSettings({ tenantId });
  }

  @Get('folder')
  @RequirePermission(P.documents.read)
  @ApiOperation({ summary: 'Get the company filesystem folder used for templates' })
  async getFolder() {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(`TemplatesController.getFolder — tenantId=${tenantId}`);
    return this.templateRegistry.getFolderSetting({ tenantId });
  }

  @Put('folder')
  @RequirePermission(P.documents.manage)
  @ApiOperation({ summary: 'Set the company filesystem folder used for templates' })
  async setFolder(@Body() dto: UpdateTemplatesFolderDto) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(
      `TemplatesController.setFolder — tenantId=${tenantId} folder=${dto.filesystemCategoryId ?? 'cleared'}`,
    );
    return this.templateRegistry.setFolderSetting({
      tenantId,
      filesystemCategoryId: dto.filesystemCategoryId ?? null,
    });
  }

  @Get(':documentType/content')
  @RequirePermission(P.documents.read)
  @ApiOperation({ summary: 'Get the assigned template content as base64 DOCX' })
  async getContent(@Param('documentType') documentType: string) {
    this.assertDocumentType(documentType);
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(
      `TemplatesController.getContent — tenantId=${tenantId} documentType=${documentType}`,
    );
    return this.templateRegistry.getTemplateContent({
      tenantId,
      documentType,
    });
  }

  @Put(':documentType/content')
  @RequirePermission(P.documents.manage)
  @ApiOperation({ summary: 'Save template content from HTML (converts to DOCX)' })
  async saveContent(
    @Param('documentType') documentType: string,
    @Body() body: { html: string },
  ) {
    this.assertDocumentType(documentType);
    const tenantId = this.tenantContext.getTenantId();
    const logPrefix = 'TemplatesController.saveContent';

    if (!body.html) {
      throw new BadRequestException('html body is required');
    }

    this.logger.debug(`${logPrefix} — converting HTML to DOCX for ${documentType}`);
    const docxBuffer = await HTMLtoDOCX(body.html, null, {
      table: { row: { cantSplit: true } },
      footer: true,
      pageNumber: true,
    }) as Buffer;

    return this.templateRegistry.saveTemplateContent({
      tenantId,
      documentType,
      docxBuffer: Buffer.from(docxBuffer),
    });
  }

  @Get(':documentType/tags')
  @RequirePermission(P.documents.read)
  @ApiOperation({ summary: 'Extract merge tags from the assigned template' })
  async getTags(@Param('documentType') documentType: string) {
    this.assertDocumentType(documentType);
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(
      `TemplatesController.getTags — tenantId=${tenantId} documentType=${documentType}`,
    );
    return this.templateRegistry.getTemplateTags({
      tenantId,
      documentType,
      templateEngineService: this.templateEngine,
    });
  }

  @Put(':documentType')
  @RequirePermission(P.documents.manage)
  @ApiOperation({ summary: 'Assign a filesystem .docx as the template for a scenario' })
  async assign(
    @Param('documentType') documentType: string,
    @Body() dto: AssignTemplateDto,
  ) {
    this.assertDocumentType(documentType);
    const tenantId = this.tenantContext.getTenantId();

    if (!dto.filesystemDocumentId) {
      return this.templateRegistry.clearAssignment({
        tenantId,
        documentType,
      });
    }

    return this.templateRegistry.assignFilesystemDocument({
      tenantId,
      documentType,
      filesystemDocumentId: dto.filesystemDocumentId,
    });
  }

  @Delete(':documentType')
  @RequirePermission(P.documents.manage)
  @ApiOperation({ summary: 'Clear the template assignment for a scenario' })
  async clear(@Param('documentType') documentType: string) {
    this.assertDocumentType(documentType);
    const tenantId = this.tenantContext.getTenantId();
    return this.templateRegistry.clearAssignment({
      tenantId,
      documentType,
    });
  }

  private assertDocumentType(
    documentType: string,
  ): asserts documentType is AssignableTemplateType {
    if (!isAssignableTemplateType(documentType)) {
      throw new BadRequestException(
        `Invalid document type "${documentType}". Expected one of: ${ASSIGNABLE_TEMPLATE_TYPES.join(', ')}`,
      );
    }
  }
}

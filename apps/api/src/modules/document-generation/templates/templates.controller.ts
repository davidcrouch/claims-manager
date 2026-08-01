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
import { AssignTemplateDto } from '../dto/assign-template.dto';
import { DOCUMENT_TYPES, type DocumentType } from '../types/document-types';

@ApiTags('Document Templates')
@Controller('document-templates')
export class TemplatesController {
  private readonly logger = new Logger('TemplatesController');

  constructor(
    private readonly templateRegistry: TemplateRegistryService,
    private readonly tenantContext: TenantContext,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List template settings for all generation scenarios' })
  async getSettings() {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(`TemplatesController.getSettings — tenantId=${tenantId}`);
    return this.templateRegistry.getSettings({ tenantId });
  }

  @Put(':documentType')
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
        documentType: documentType as DocumentType,
      });
    }

    return this.templateRegistry.assignFilesystemDocument({
      tenantId,
      documentType: documentType as DocumentType,
      filesystemDocumentId: dto.filesystemDocumentId,
    });
  }

  @Delete(':documentType')
  @ApiOperation({ summary: 'Clear the template assignment for a scenario' })
  async clear(@Param('documentType') documentType: string) {
    this.assertDocumentType(documentType);
    const tenantId = this.tenantContext.getTenantId();
    return this.templateRegistry.clearAssignment({
      tenantId,
      documentType: documentType as DocumentType,
    });
  }

  private assertDocumentType(documentType: string): asserts documentType is DocumentType {
    if (!(DOCUMENT_TYPES as readonly string[]).includes(documentType)) {
      throw new BadRequestException(
        `Invalid document type "${documentType}". Expected one of: ${DOCUMENT_TYPES.join(', ')}`,
      );
    }
  }
}

import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { TenantContext } from '../../../tenant/tenant-context';
import { DocumentTemplateDataContextsRepository } from '../../../database/repositories';
import type { DocumentType } from '../types/document-types';
import {
  ContextResolver,
  getContextDefinition,
  getDefaultEnabledSlugs,
  hasContextDefinition,
  type DataContextDefinition,
  type DataEnvelope,
} from './index';

@Injectable()
export class DataContextService {
  private readonly logger = new Logger('DataContextService');

  constructor(
    private readonly tenantContext: TenantContext,
    private readonly dataContextsRepo: DocumentTemplateDataContextsRepository,
    private readonly contextResolver: ContextResolver,
  ) {}

  getDefinition(documentType: DocumentType): DataContextDefinition | null {
    return getContextDefinition(documentType) ?? null;
  }

  async getConfig(params: { documentType: DocumentType }): Promise<{
    available: boolean;
    definition: DataContextDefinition | null;
    enabledSlugs: string[];
    isCustom: boolean;
  }> {
    const definition = getContextDefinition(params.documentType) ?? null;
    if (!definition) {
      return { available: false, definition: null, enabledSlugs: [], isCustom: false };
    }

    const tenantId = this.tenantContext.getTenantId();
    const row = await this.dataContextsRepo.findByType({
      tenantId,
      documentType: params.documentType,
    });

    const enabledSlugs = row?.enabledSlugs?.length
      ? row.enabledSlugs
      : getDefaultEnabledSlugs(params.documentType);

    return {
      available: true,
      definition,
      enabledSlugs,
      isCustom: !!row,
    };
  }

  async upsertConfig(params: {
    documentType: DocumentType;
    enabledSlugs: string[];
  }) {
    const definition = getContextDefinition(params.documentType);
    if (!definition) {
      throw new BadRequestException(
        `No data context definition for document type "${params.documentType}"`,
      );
    }

    const allowed = new Set(definition.relatedEntities.map((r) => r.slug));
    const invalid = params.enabledSlugs.filter((s) => !allowed.has(s));
    if (invalid.length > 0) {
      throw new BadRequestException(
        `Unknown related entity slug(s): ${invalid.join(', ')}`,
      );
    }

    const tenantId = this.tenantContext.getTenantId();
    const row = await this.dataContextsRepo.upsert({
      tenantId,
      documentType: params.documentType,
      enabledSlugs: params.enabledSlugs,
    });
    this.logger.log(
      `DataContextService.upsertConfig — type=${params.documentType} slugs=${params.enabledSlugs.join(',')}`,
    );
    return row;
  }

  async preview(params: {
    documentType: DocumentType;
    entityId: string;
    enabledSlugs?: string[];
  }): Promise<{ definition: DataContextDefinition; envelope: DataEnvelope }> {
    const definition = getContextDefinition(params.documentType);
    if (!definition) {
      throw new BadRequestException(
        `No data context definition for document type "${params.documentType}"`,
      );
    }

    const tenantId = this.tenantContext.getTenantId();
    let enabledSlugs = params.enabledSlugs;
    if (!enabledSlugs) {
      const row = await this.dataContextsRepo.findByType({
        tenantId,
        documentType: params.documentType,
      });
      enabledSlugs = row?.enabledSlugs?.length
        ? row.enabledSlugs
        : getDefaultEnabledSlugs(params.documentType);
    }

    const envelope = await this.contextResolver.resolve({
      tenantId,
      documentType: params.documentType,
      entityId: params.entityId,
      enabledSlugs,
    });

    if (!envelope) {
      throw new BadRequestException('Failed to resolve data context envelope');
    }

    return { definition, envelope };
  }

  async resolveForGeneration(params: {
    tenantId: string;
    documentType: DocumentType;
    entityId: string;
    enabledSlugs?: string[];
  }): Promise<DataEnvelope | null> {
    if (!hasContextDefinition(params.documentType)) return null;

    let enabledSlugs = params.enabledSlugs;
    if (!enabledSlugs) {
      const row = await this.dataContextsRepo.findByType({
        tenantId: params.tenantId,
        documentType: params.documentType,
      });
      enabledSlugs = row?.enabledSlugs?.length
        ? row.enabledSlugs
        : getDefaultEnabledSlugs(params.documentType);
    }

    return this.contextResolver.resolve({
      tenantId: params.tenantId,
      documentType: params.documentType,
      entityId: params.entityId,
      enabledSlugs,
    });
  }
}

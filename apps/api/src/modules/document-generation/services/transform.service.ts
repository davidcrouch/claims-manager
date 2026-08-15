import { Injectable, Logger } from '@nestjs/common';
import jsonata from 'jsonata';
import { TenantContext } from '../../../tenant/tenant-context';
import { DocumentTemplateTransformsRepository } from '../../../database/repositories';
import type {
  DocumentTemplateTransformRow,
  DocumentTemplateTransformVersionRow,
} from '../../../database/repositories';
import type { DocumentType } from '../types/document-types';
import type { TemplateData } from '../types/document-types';
import { TRANSFORM_DEFAULTS } from '../schemas/target/defaults';
import { getSourceJsonSchema } from '../schemas/json-schema';

const JSONATA_TIMEOUT_MS = 10_000;

@Injectable()
export class TransformService {
  private readonly logger = new Logger('TransformService');

  constructor(
    private readonly tenantContext: TenantContext,
    private readonly transformsRepo: DocumentTemplateTransformsRepository,
  ) {}

  async getTransform(params: {
    documentType: DocumentType;
  }): Promise<DocumentTemplateTransformRow | null> {
    const tenantId = this.tenantContext.getTenantId();
    const row = await this.transformsRepo.findByType({
      tenantId,
      documentType: params.documentType,
    });
    return row ?? null;
  }

  async getTransformWithDefaults(params: {
    documentType: DocumentType;
  }): Promise<{
    jsonataRules: string | null;
    targetSchema: unknown;
    testData: unknown;
    isCustom: boolean;
    sourceSchema: unknown;
  }> {
    const row = await this.getTransform(params);
    const defaults = TRANSFORM_DEFAULTS[params.documentType];
    const sourceSchema = getSourceJsonSchema(params.documentType);

    return {
      jsonataRules: row?.jsonataRules ?? defaults?.jsonataRules ?? null,
      targetSchema: row?.targetSchema ?? defaults?.targetSchema ?? null,
      testData: row?.testData ?? null,
      isCustom: !!row,
      sourceSchema,
    };
  }

  async upsertTransform(params: {
    documentType: DocumentType;
    jsonataRules?: string | null;
    targetSchema?: unknown;
    testData?: unknown;
    userId?: string;
  }): Promise<DocumentTemplateTransformRow> {
    const tenantId = this.tenantContext.getTenantId();
    return this.transformsRepo.upsert({
      tenantId,
      documentType: params.documentType,
      jsonataRules: params.jsonataRules,
      targetSchema: params.targetSchema,
      testData: params.testData,
      updatedBy: params.userId ?? null,
    });
  }

  async getVersionHistory(params: {
    documentType: DocumentType;
  }): Promise<{
    current: DocumentTemplateTransformRow | null;
    versions: DocumentTemplateTransformVersionRow[];
  }> {
    const row = await this.getTransform(params);
    if (!row) return { current: null, versions: [] };
    const versions = await this.transformsRepo.getVersions({ transformId: row.id });
    return { current: row, versions };
  }

  async deleteTransform(params: {
    documentType: DocumentType;
  }): Promise<boolean> {
    const tenantId = this.tenantContext.getTenantId();
    return this.transformsRepo.delete({
      tenantId,
      documentType: params.documentType,
    });
  }

  async evaluateJsonata(params: {
    jsonataRules: string;
    sourceData: TemplateData;
  }): Promise<{ result: unknown; error?: string }> {
    const logPrefix = 'TransformService.evaluateJsonata';
    try {
      const expression = jsonata(params.jsonataRules);
      const evaluatePromise = expression.evaluate(params.sourceData);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('JSONata evaluation timed out')), JSONATA_TIMEOUT_MS),
      );
      const result = await Promise.race([evaluatePromise, timeoutPromise]);
      return { result: result ?? {} };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`${logPrefix} — JSONata evaluation failed: ${message}`);
      return { result: null, error: message };
    }
  }

  async applyTransform(params: {
    documentType: DocumentType;
    sourceData: TemplateData;
  }): Promise<TemplateData> {
    const logPrefix = 'TransformService.applyTransform';
    const tenantId = this.tenantContext.getTenantId();

    const row = await this.transformsRepo.findByType({
      tenantId,
      documentType: params.documentType,
    });

    const jsonataRules = row?.jsonataRules;
    if (!jsonataRules) {
      return params.sourceData;
    }

    const { result, error } = await this.evaluateJsonata({
      jsonataRules,
      sourceData: params.sourceData,
    });

    if (error || result == null) {
      this.logger.warn(
        `${logPrefix} — falling back to source data for type=${params.documentType} tenant=${tenantId}: ${error}`,
      );
      return params.sourceData;
    }

    return result as TemplateData;
  }
}

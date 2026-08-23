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
import { DataContextService } from '../data-context';
import { enrichSourceSchemaWithDataContext } from '../data-context/enrich-source-schema';

import { formatCurrency, formatDate } from '../data-mappers/base.mapper';
import {
  contactEmail,
  contactMobile,
  contactName,
  contactPhone,
  jobAddressLine1,
  jobAddressLine2,
} from './transform-contact.helpers';

const JSONATA_TIMEOUT_MS = 10_000;

function yn(value: unknown): string {
  return value === true || value === 'true' || value === 'Yes' ? 'Yes' : 'No';
}

function registerTransformFunctions(expression: ReturnType<typeof jsonata>): void {
  expression.registerFunction('formatDate', (value: unknown) =>
    formatDate(value as Date | string | null | undefined),
  );
  expression.registerFunction('formatCurrency', (value: unknown) =>
    formatCurrency(value as string | number | null | undefined),
  );
  expression.registerFunction('yn', (value: unknown) => yn(value));
  expression.registerFunction('str', (value: unknown) =>
    value == null ? '' : String(value),
  );
  expression.registerFunction('contactName', contactName);
  expression.registerFunction('contactPhone', contactPhone);
  expression.registerFunction('contactMobile', contactMobile);
  expression.registerFunction('contactEmail', contactEmail);
  expression.registerFunction('jobAddressLine1', jobAddressLine1);
  expression.registerFunction('jobAddressLine2', jobAddressLine2);
}

@Injectable()
export class TransformService {
  private readonly logger = new Logger('TransformService');

  constructor(
    private readonly tenantContext: TenantContext,
    private readonly transformsRepo: DocumentTemplateTransformsRepository,
    private readonly dataContextService: DataContextService,
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
    const baseSchema = getSourceJsonSchema(params.documentType);

    const contextConfig = await this.dataContextService.getConfig({
      documentType: params.documentType,
    });
    const sourceSchema = enrichSourceSchemaWithDataContext({
      documentType: params.documentType,
      baseSchema,
      enabledSlugs: contextConfig.available ? contextConfig.enabledSlugs : null,
    });

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
      registerTransformFunctions(expression);
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

  async previewTransform(params: {
    documentType: DocumentType;
    sourceData: TemplateData;
    jsonataRules: string;
  }): Promise<{ result: unknown; error?: string }> {
    return this.evaluateJsonata({
      jsonataRules: params.jsonataRules,
      sourceData: params.sourceData,
    });
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

    const defaults = TRANSFORM_DEFAULTS[params.documentType];
    // Match getTransformWithDefaults / Transform tab: use saved rules, else code defaults.
    // Previously only saved rows were applied, so Test Generation / RFQ preview kept source
    // keys (company_name) while the Transform preview showed target keys (company).
    const jsonataRules = row?.jsonataRules ?? defaults?.jsonataRules ?? null;
    const rulesSource = row?.jsonataRules
      ? 'custom'
      : defaults?.jsonataRules
        ? 'default'
        : 'none';

    if (!jsonataRules) {
      this.logger.debug(
        `${logPrefix} — no rules for type=${params.documentType}; using source data`,
      );
      return params.sourceData;
    }

    const { result, error } = await this.evaluateJsonata({
      jsonataRules,
      sourceData: params.sourceData,
    });

    if (error || result == null) {
      this.logger.warn(
        `${logPrefix} — falling back to source data for type=${params.documentType} tenant=${tenantId} source=${rulesSource}: ${error}`,
      );
      return params.sourceData;
    }

    this.logger.debug(
      `${logPrefix} — applied ${rulesSource} rules for type=${params.documentType}`,
    );
    return result as TemplateData;
  }
}

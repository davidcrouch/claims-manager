import type { DocumentType } from '../types/document-types';

export type EntityFieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'currency'
  | 'object'
  | 'array';

export interface EntityFieldDef {
  key: string;
  label: string;
  type: EntityFieldType;
  description?: string;
}

export interface RelatedEntityDef {
  /** Domain entity type, e.g. 'Job', 'Claim', 'Quote'. */
  entityType: string;
  /** Key used in the resolved envelope and tenant enabledSlugs. */
  slug: string;
  label: string;
  description: string;
  cardinality: 'one' | 'many';
  /**
   * FK chain from the primary entity.
   * For cardinality `one`: walk each field to the next record, fetch final entity by id.
   * For cardinality `many`: walk all but the last hop to find a parent id, then query
   * children where `parentFk` equals that id. Empty path means use primary.id.
   */
  traversalPath: string[];
  /**
   * FK column on the related table used when cardinality is `many`.
   * Defaults to the last segment of `traversalPath`, or `{entity}Id` conventions.
   */
  parentFk?: string;
  /**
   * Optional join table for many-to-many (e.g. job contacts).
   */
  viaJoin?: 'job_contacts' | 'claim_contacts';
  fields: EntityFieldDef[];
  defaultEnabled: boolean;
}

export interface PrimaryEntityDef {
  entityType: string;
  label: string;
  fields: EntityFieldDef[];
}

export interface DataContextDefinition {
  documentType: DocumentType;
  primaryEntity: PrimaryEntityDef;
  relatedEntities: RelatedEntityDef[];
}

/** Nested envelope produced by the context resolver. */
export type DataEnvelope = Record<string, unknown>;

import type { DocumentType } from '../types/document-types';
import type { JsonSchemaObject, JsonSchemaProperty } from '../schemas/json-schema';
import type { DataContextDefinition, EntityFieldDef, EntityFieldType } from './types';
import { getContextDefinition, getDefaultEnabledSlugs } from './context-definitions';

/** Document types that include template line-item `groups` under `_context`. */
const GROUPED_CONTEXT_TYPES = new Set<DocumentType>([
  'quote',
  'invoice',
  'purchase_order',
  'work_order',
  'proposal',
  'rfq',
  'scope_of_work',
]);

function fieldTypeToJsonSchema(type: EntityFieldType): JsonSchemaProperty {
  switch (type) {
    case 'number':
    case 'currency':
      return { type: 'number' };
    case 'boolean':
      return { type: 'boolean' };
    case 'object':
      return { type: 'object', additionalProperties: true };
    case 'array':
      return {
        type: 'array',
        items: { type: 'object', properties: {}, required: [], additionalProperties: true },
      };
    case 'date':
    case 'string':
    default:
      return { type: 'string' };
  }
}

function fieldsToObjectSchema(
  fields: EntityFieldDef[],
  description?: string,
): JsonSchemaProperty {
  const properties: Record<string, JsonSchemaProperty> = {};
  for (const field of fields) {
    properties[field.key] = {
      ...fieldTypeToJsonSchema(field.type),
      ...(field.description || field.label
        ? { description: field.description ?? field.label }
        : {}),
    };
  }
  if (!properties.id) {
    properties.id = { type: 'string', description: 'Record ID' };
  }
  return {
    type: 'object',
    description,
    properties,
    additionalProperties: true,
  };
}

function envelopeKey(entityType: string): string {
  return entityType
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/\s+/g, '_')
    .toLowerCase();
}

const ORGANIZATION_SCHEMA: JsonSchemaProperty = {
  type: 'object',
  description: 'Tenant organisation (for company name on documents)',
  properties: {
    id: { type: 'string' },
    name: { type: 'string', description: 'Organisation / company name' },
  },
  additionalProperties: true,
};

const GROUPS_SCHEMA: JsonSchemaProperty = {
  type: 'array',
  description: 'Template line-item groups (name, items, combos, scopes)',
  items: {
    type: 'object',
    properties: {
      group_name: { type: 'string' },
      group_note: { type: 'string' },
      group_subtotal: { type: 'string' },
      group_length: { type: 'string', description: 'Group length' },
      group_width: { type: 'string', description: 'Group width' },
      group_height: { type: 'string', description: 'Group height' },
      group_perimeter: { type: 'string', description: 'Group perimeter' },
      items: { type: 'array', items: { type: 'object', additionalProperties: true } },
      combos: { type: 'array', items: { type: 'object', additionalProperties: true } },
      scopes: { type: 'array', items: { type: 'object', additionalProperties: true } },
    },
    additionalProperties: true,
  },
};

/** RFQ totals are summed from group totals in the mapper (no entity-level columns). */
const TOTALS_SCHEMA: JsonSchemaProperty = {
  type: 'object',
  description: 'Computed document totals (subtotal, tax, total)',
  properties: {
    subtotal: { type: 'number', description: 'Subtotal' },
    tax: { type: 'number', description: 'Tax' },
    total: { type: 'number', description: 'Grand total' },
  },
  additionalProperties: true,
};

/** Document types that expose mapper-computed `_context._totals`. */
const COMPUTED_TOTALS_CONTEXT_TYPES = new Set<DocumentType>(['rfq']);

/**
 * Build the `_context` object schema from the data-context definition
 * and currently enabled related-entity slugs.
 */
export function buildContextSourceSchemaProperty(params: {
  definition: DataContextDefinition;
  enabledSlugs: string[];
  includeGroups?: boolean;
  includeComputedTotals?: boolean;
}): JsonSchemaProperty {
  const { definition, enabledSlugs } = params;
  const properties: Record<string, JsonSchemaProperty> = {
    organization: ORGANIZATION_SCHEMA,
  };

  const primaryKey = envelopeKey(definition.primaryEntity.entityType);
  properties[primaryKey] = fieldsToObjectSchema(
    definition.primaryEntity.fields,
    `${definition.primaryEntity.label} (primary)`,
  );

  for (const related of definition.relatedEntities) {
    if (!enabledSlugs.includes(related.slug)) continue;
    const entitySchema = fieldsToObjectSchema(
      related.fields,
      `${related.label} — ${related.description}`,
    );
    if (related.cardinality === 'many') {
      properties[related.slug] = {
        type: 'array',
        description: related.description,
        items: entitySchema,
      };
    } else {
      properties[related.slug] = entitySchema;
    }
  }

  if (params.includeGroups) {
    properties.groups = GROUPS_SCHEMA;
  }

  if (params.includeComputedTotals) {
    properties._totals = TOTALS_SCHEMA;
  }

  return {
    type: 'object',
    description:
      'Data Sources envelope. Use paths like _context.job.name and _context.organization.name in JSONata.',
    properties,
  };
}

/**
 * Source schema for context-enabled document types: `_context` only (no legacy mapper fields).
 * Types without a data-context definition keep the mapper Zod schema unchanged.
 */
export function enrichSourceSchemaWithDataContext(params: {
  documentType: DocumentType;
  baseSchema: JsonSchemaObject;
  enabledSlugs?: string[] | null;
}): JsonSchemaObject {
  const definition = getContextDefinition(params.documentType);
  if (!definition) return params.baseSchema;

  const enabledSlugs =
    params.enabledSlugs && params.enabledSlugs.length > 0
      ? params.enabledSlugs
      : getDefaultEnabledSlugs(params.documentType);

  const contextProp = buildContextSourceSchemaProperty({
    definition,
    enabledSlugs,
    includeGroups: GROUPED_CONTEXT_TYPES.has(params.documentType),
    includeComputedTotals: COMPUTED_TOTALS_CONTEXT_TYPES.has(params.documentType),
  });

  return {
    type: 'object',
    properties: {
      _context: contextProp,
    },
    required: ['_context'],
  };
}

import type { DocumentType } from '../types/document-types';
import { SOURCE_SCHEMAS } from './index';

interface JsonSchemaProperty {
  type: string;
  items?: JsonSchemaObject;
  properties?: Record<string, JsonSchemaProperty>;
  additionalProperties?: boolean | JsonSchemaProperty;
}

export interface JsonSchemaObject {
  type: 'object';
  properties: Record<string, JsonSchemaProperty>;
  required: string[];
  additionalProperties?: boolean | JsonSchemaProperty;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

function zodShapeToJsonSchema(schema: any): JsonSchemaObject {
  const shape: Record<string, any> = schema.shape ?? {};
  const properties: Record<string, JsonSchemaProperty> = {};
  const required: string[] = [];

  for (const [key, field] of Object.entries(shape)) {
    const def = (field as any)._def;
    const prop = zodDefToJsonProp(def);
    properties[key] = prop;
    if (def.typeName !== 'ZodOptional') {
      required.push(key);
    }
  }

  const result: JsonSchemaObject = { type: 'object', properties, required };

  const schemaDef = schema._def;
  if (schemaDef?.catchall) {
    result.additionalProperties = true;
  }

  return result;
}

function zodDefToJsonProp(def: any): JsonSchemaProperty {
  switch (def?.typeName) {
    case 'ZodString':
      return { type: 'string' };
    case 'ZodNumber':
      return { type: 'number' };
    case 'ZodBoolean':
      return { type: 'boolean' };
    case 'ZodArray': {
      const itemDef = def.type?._def;
      if (itemDef?.typeName === 'ZodObject') {
        return { type: 'array', items: zodShapeToJsonSchema(def.type) };
      }
      return { type: 'array', items: { type: 'object', properties: {}, required: [] } };
    }
    case 'ZodObject':
      return zodShapeToJsonSchema(def) as unknown as JsonSchemaProperty;
    case 'ZodRecord':
      return { type: 'object', additionalProperties: true };
    case 'ZodOptional':
      return zodDefToJsonProp(def.innerType?._def);
    case 'ZodUnknown':
    case 'ZodAny':
      return { type: 'object' };
    default:
      return { type: 'string' };
  }
}

const cache = new Map<DocumentType, JsonSchemaObject>();

export function getSourceJsonSchema(documentType: DocumentType): JsonSchemaObject {
  const cached = cache.get(documentType);
  if (cached) return cached;

  const zodSchema = SOURCE_SCHEMAS[documentType];
  if (!zodSchema) {
    return { type: 'object', properties: {}, required: [] };
  }

  const jsonSchema = zodShapeToJsonSchema(zodSchema as any);
  cache.set(documentType, jsonSchema);
  return jsonSchema;
}

export function getAllSourceJsonSchemas(): Record<DocumentType, JsonSchemaObject> {
  const result: Record<string, JsonSchemaObject> = {};
  for (const key of Object.keys(SOURCE_SCHEMAS)) {
    result[key] = getSourceJsonSchema(key as DocumentType);
  }
  return result as Record<DocumentType, JsonSchemaObject>;
}

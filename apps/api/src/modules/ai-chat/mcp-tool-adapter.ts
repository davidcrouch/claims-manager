import type { ProviderToolDefinition } from './providers/types';

interface AiSdkTool {
  description?: string;
  parameters?: ZodLikeSchema;
  inputSchema?: ZodLikeSchema;
  execute?: (args: Record<string, unknown>) => Promise<unknown>;
  resourceUri?: string;
}

interface ZodLikeSchema {
  type?: string;
  jsonSchema?: () => Record<string, unknown>;
  _def?: ZodDef;
}

interface ZodDef {
  shape?: () => Record<string, ZodFieldSchema>;
  typeName?: string;
  innerType?: { _def?: ZodDef };
  description?: string;
  values?: unknown[];
}

interface ZodFieldSchema {
  _def?: ZodDef;
}

export function adaptMCPTools(
  aiSdkTools: Record<string, unknown>,
): Record<string, ProviderToolDefinition> {
  const adapted: Record<string, ProviderToolDefinition> = {};

  for (const [name, rawTool] of Object.entries(aiSdkTools)) {
    const tool = rawTool as AiSdkTool;
    if (!tool || typeof tool !== 'object') continue;

    const schema = extractSchema(tool);
    const execute =
      typeof tool.execute === 'function'
        ? (args: Record<string, unknown>) => tool.execute!(args)
        : async () => ({ error: 'Tool has no execute function' });

    adapted[name] = {
      name,
      description: tool.description ?? '',
      inputSchema: schema,
      execute,
      resourceUri: tool.resourceUri,
    };
  }

  return adapted;
}

function extractSchema(tool: AiSdkTool): Record<string, unknown> {
  if (tool.inputSchema) {
    return zodToJsonSchema(tool.inputSchema);
  }
  if (tool.parameters) {
    return zodToJsonSchema(tool.parameters);
  }
  return { type: 'object', properties: {} };
}

function zodToJsonSchema(schema: ZodLikeSchema): Record<string, unknown> {
  if (typeof schema.jsonSchema === 'function') {
    return schema.jsonSchema();
  }

  if (typeof schema._def !== 'undefined') {
    return zodDefToJsonSchema(schema);
  }

  if (schema.type) {
    return schema as Record<string, unknown>;
  }

  return { type: 'object', properties: {} };
}

function zodDefToJsonSchema(zodSchema: ZodLikeSchema): Record<string, unknown> {
  try {
    if (typeof zodSchema.jsonSchema === 'function') {
      return zodSchema.jsonSchema();
    }

    const shape = zodSchema._def?.shape?.();
    if (!shape) return { type: 'object', properties: {} };

    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      const field = value;
      const prop: Record<string, unknown> = {};

      if (field._def?.description) {
        prop.description = field._def.description;
      }

      const innerDef = field._def?.innerType?._def ?? field._def;
      const typeName = innerDef?.typeName;

      switch (typeName) {
        case 'ZodString':
          prop.type = 'string';
          break;
        case 'ZodNumber':
          prop.type = 'number';
          break;
        case 'ZodBoolean':
          prop.type = 'boolean';
          break;
        case 'ZodArray':
          prop.type = 'array';
          prop.items = { type: 'string' };
          break;
        case 'ZodObject':
          prop.type = 'object';
          prop.properties = {};
          break;
        case 'ZodEnum':
          prop.type = 'string';
          prop.enum = innerDef?.values;
          break;
        default:
          prop.type = 'string';
      }

      properties[key] = prop;

      if (field._def?.typeName !== 'ZodOptional') {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      ...(required.length > 0 ? { required } : {}),
    };
  } catch {
    return { type: 'object', properties: {} };
  }
}

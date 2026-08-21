import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsApiClient } from '../server.js';
import { toolError, toolResult } from '../server.js';
import { categoryDesc } from '../categories.js';

const CAT = 'documents' as const;

export function registerTransformTools(server: McpServer, api: ClaimsApiClient): void {
  server.tool(
    'get_source_schemas',
    categoryDesc(CAT, 'List all document-generation source schemas as JSON Schema.'),
    {},
    async () => {
      try {
        return toolResult(await api.request('/generated-documents/schemas/source'));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'get_source_schema',
    categoryDesc(CAT, 'Get the source JSON Schema for one document type.'),
    {
      documentType: z.string().describe('Document type slug (e.g. quote, claim, assessment)'),
    },
    async ({ documentType }) => {
      try {
        return toolResult(
          await api.request(`/generated-documents/schemas/source/${documentType}`),
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'get_transform',
    categoryDesc(
      CAT,
      'Get the JSONata transform config (custom + defaults) for a document type.',
    ),
    {
      documentType: z.string().describe('Document type slug'),
    },
    async ({ documentType }) => {
      try {
        return toolResult(await api.request(`/generated-documents/transforms/${documentType}`));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'upsert_transform',
    categoryDesc(CAT, 'Create or update the JSONata transform for a document type.'),
    {
      documentType: z.string().describe('Document type slug'),
      jsonataRules: z.string().optional().describe('JSONata expression'),
      targetSchema: z.unknown().optional().describe('Optional target JSON Schema'),
      testData: z.unknown().optional().describe('Optional test/sample payload to store'),
    },
    async ({ documentType, jsonataRules, targetSchema, testData }) => {
      try {
        return toolResult(
          await api.request(`/generated-documents/transforms/${documentType}`, {
            method: 'PUT',
            body: { jsonataRules, targetSchema, testData },
          }),
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'delete_transform',
    categoryDesc(
      CAT,
      'Delete the custom transform for a document type (reverts to built-in defaults).',
    ),
    {
      documentType: z.string().describe('Document type slug'),
    },
    async ({ documentType }) => {
      try {
        return toolResult(
          await api.request(`/generated-documents/transforms/${documentType}`, {
            method: 'DELETE',
          }),
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'preview_transform',
    categoryDesc(
      CAT,
      'Evaluate JSONata rules against source data without saving the transform.',
    ),
    {
      documentType: z.string().describe('Document type slug'),
      sourceData: z.record(z.unknown()).describe('Source object to transform'),
      jsonataRules: z.string().describe('JSONata expression to evaluate'),
    },
    async ({ documentType, sourceData, jsonataRules }) => {
      try {
        return toolResult(
          await api.request(`/generated-documents/transforms/${documentType}/preview`, {
            method: 'POST',
            body: { sourceData, jsonataRules },
          }),
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'list_transform_versions',
    categoryDesc(CAT, 'List version history for a document-type transform.'),
    {
      documentType: z.string().describe('Document type slug'),
    },
    async ({ documentType }) => {
      try {
        return toolResult(
          await api.request(`/generated-documents/transforms/${documentType}/versions`),
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'get_transform_sample_data',
    categoryDesc(
      CAT,
      'Run the document mapper to produce sample source data for a real entity.',
    ),
    {
      documentType: z.string().describe('Document type slug'),
      entityId: z.string().describe('Entity UUID to map'),
    },
    async ({ documentType, entityId }) => {
      try {
        return toolResult(
          await api.request(`/generated-documents/transforms/${documentType}/sample-data`, {
            method: 'POST',
            body: { entityId },
          }),
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'list_data_context',
    categoryDesc(
      CAT,
      'Get the data context definition and enabled related-entity slugs for a document type.',
    ),
    {
      documentType: z.string().describe('Document type slug (e.g. assessment, quote)'),
    },
    async ({ documentType }) => {
      try {
        return toolResult(
          await api.request(`/generated-documents/data-context/${documentType}`),
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'update_data_context',
    categoryDesc(
      CAT,
      'Update which related entities are enabled for a document type data context.',
    ),
    {
      documentType: z.string().describe('Document type slug'),
      enabledSlugs: z
        .array(z.string())
        .describe('Related entity slugs to enable (e.g. job, claim, quotes)'),
    },
    async ({ documentType, enabledSlugs }) => {
      try {
        return toolResult(
          await api.request(`/generated-documents/data-context/${documentType}`, {
            method: 'PUT',
            body: { enabledSlugs },
          }),
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'preview_data_envelope',
    categoryDesc(
      CAT,
      'Resolve a nested data context envelope for a real entity (optional enabledSlugs override).',
    ),
    {
      documentType: z.string().describe('Document type slug'),
      entityId: z.string().describe('Entity UUID'),
      enabledSlugs: z
        .array(z.string())
        .optional()
        .describe('Optional related-entity slugs to include for this preview'),
    },
    async ({ documentType, entityId, enabledSlugs }) => {
      try {
        return toolResult(
          await api.request(`/generated-documents/data-context/${documentType}/preview`, {
            method: 'POST',
            body: { entityId, enabledSlugs },
          }),
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );
}

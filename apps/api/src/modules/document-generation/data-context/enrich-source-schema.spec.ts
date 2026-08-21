import { enrichSourceSchemaWithDataContext } from './enrich-source-schema';
import type { JsonSchemaObject } from '../schemas/json-schema';

const emptyBase: JsonSchemaObject = {
  type: 'object',
  properties: {
    company_name: { type: 'string' },
  },
  required: ['company_name'],
};

describe('enrichSourceSchemaWithDataContext', () => {
  it('leaves schema unchanged when document type has no data context', () => {
    const result = enrichSourceSchemaWithDataContext({
      documentType: 'jobs_list',
      baseSchema: emptyBase,
      enabledSlugs: ['job'],
    });
    expect(result).toBe(emptyBase);
    expect(result.properties?._context).toBeUndefined();
  });

  it('returns _context-only schema with primary, organization, and default related entities', () => {
    const result = enrichSourceSchemaWithDataContext({
      documentType: 'assessment',
      baseSchema: emptyBase,
      enabledSlugs: null,
    });

    expect(result.properties?.company_name).toBeUndefined();
    expect(Object.keys(result.properties ?? {})).toEqual(['_context']);
    const context = result.properties?._context;
    expect(context?.type).toBe('object');
    expect(context?.properties?.organization).toBeDefined();
    expect(context?.properties?.assessment).toBeDefined();
    expect(context?.properties?.job).toBeDefined();
    expect(context?.properties?.claim).toBeUndefined();
    expect(context?.properties?.job?.properties?.name?.type).toBe('string');
  });

  it('only includes related entities from enabledSlugs', () => {
    const result = enrichSourceSchemaWithDataContext({
      documentType: 'assessment',
      baseSchema: emptyBase,
      enabledSlugs: ['claim'],
    });

    const context = result.properties?._context;
    expect(context?.properties?.assessment).toBeDefined();
    expect(context?.properties?.claim).toBeDefined();
    expect(context?.properties?.job).toBeUndefined();
  });

  it('includes groups for financial document types', () => {
    const result = enrichSourceSchemaWithDataContext({
      documentType: 'rfq',
      baseSchema: emptyBase,
      enabledSlugs: ['job'],
    });
    expect(result.properties?._context?.properties?.groups?.type).toBe('array');
  });

  it('does not mutate the cached base schema', () => {
    const base = {
      type: 'object' as const,
      properties: { a: { type: 'string' } },
      required: [] as string[],
    };
    enrichSourceSchemaWithDataContext({
      documentType: 'assessment',
      baseSchema: base,
      enabledSlugs: ['job'],
    });
    expect(base.properties._context).toBeUndefined();
  });
});

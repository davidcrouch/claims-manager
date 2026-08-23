import {
  CONTEXT_DEFINITIONS,
  getContextDefinition,
  getDefaultEnabledSlugs,
  hasContextDefinition,
} from './context-definitions';

describe('data-context definitions', () => {
  it('registers the core document types from the report builder plan', () => {
    const expected = [
      'assessment',
      'quote',
      'invoice',
      'job_details',
      'scope_of_work',
      'purchase_order',
      'work_order',
      'claim',
      'report',
      'bill',
      'proposal',
      'rfq',
    ] as const;

    for (const type of expected) {
      expect(hasContextDefinition(type)).toBe(true);
      const def = getContextDefinition(type);
      expect(def?.documentType).toBe(type);
      expect(def?.primaryEntity.fields.length).toBeGreaterThan(0);
    }
  });

  it('defaults job on for assessment and claim off', () => {
    const slugs = getDefaultEnabledSlugs('assessment');
    expect(slugs).toContain('job');
    expect(slugs).not.toContain('claim');
  });

  it('defaults job, claim, contacts, and claim_contacts on for scope_of_work', () => {
    const slugs = getDefaultEnabledSlugs('scope_of_work');
    expect(getContextDefinition('scope_of_work')?.primaryEntity.entityType).toBe('Quote');
    expect(slugs).toContain('job');
    expect(slugs).toContain('claim');
    expect(slugs).toContain('contacts');
    expect(slugs).toContain('claim_contacts');
    expect(slugs).not.toContain('quotes');
  });

  it('uses unique related slugs within each definition', () => {
    for (const def of Object.values(CONTEXT_DEFINITIONS)) {
      if (!def) continue;
      const slugs = def.relatedEntities.map((r) => r.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
    }
  });
});

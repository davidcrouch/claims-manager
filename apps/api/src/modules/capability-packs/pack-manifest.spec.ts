import {
  claimsMcpIntegrationUrl,
  knownClaimsMcpIntegrationByName,
  KNOWN_CLAIMS_MCP_INTEGRATIONS,
  resolveClaimsMcpBaseUrl,
} from './known-claims-mcp';
import {
  compileToolNamePattern,
  matchToolNames,
  unmatchedExactToolNames,
} from './pack-tool-matcher';
import {
  packAgentSchema,
  packManifestSchema,
  packSkillSchema,
} from './pack-manifest.types';

describe('known-claims-mcp', () => {
  it('maps pack integration names to category URLs', () => {
    const base = resolveClaimsMcpBaseUrl('http://localhost:4601/mcp');
    expect(base).toBe('http://localhost:4601');
    expect(claimsMcpIntegrationUrl('Claims Operations', base)).toBe(
      'http://localhost:4601/operations/mcp',
    );
    expect(claimsMcpIntegrationUrl('Claims AI', base)).toBe(
      'http://localhost:4601/ai/mcp',
    );
    expect(knownClaimsMcpIntegrationByName('Microsoft 365')).toBeUndefined();
    expect(KNOWN_CLAIMS_MCP_INTEGRATIONS.length).toBe(6);
  });
});

describe('pack-tool-matcher', () => {
  it('matches exact tool names', () => {
    expect(
      matchToolNames({
        toolNames: ['search_claims', 'get_claim', 'create_task'],
        patterns: ['get_claim'],
      }),
    ).toEqual(['get_claim']);
  });

  it('matches glob patterns', () => {
    expect(
      matchToolNames({
        toolNames: ['search_claims', 'get_claim', 'create_claim', 'list_quotes'],
        patterns: ['*_claim', 'search_*'],
      }).sort(),
    ).toEqual(['create_claim', 'get_claim', 'search_claims']);
  });

  it('returns empty when no patterns', () => {
    expect(
      matchToolNames({
        toolNames: ['search_claims'],
        patterns: [],
      }),
    ).toEqual([]);
  });

  it('compileToolNamePattern rejects non-matches', () => {
    const matcher = compileToolNamePattern('list_*');
    expect(matcher('list_quotes')).toBe(true);
    expect(matcher('get_quote')).toBe(false);
  });

  it('unmatchedExactToolNames keeps exact names missing from the cache', () => {
    expect(
      unmatchedExactToolNames({
        toolNames: ['get_journal', 'create_journal'],
        patterns: [
          'create_journal',
          'create_journal_site_entry',
          'list_*',
          'create_journal_site_entry',
        ],
      }),
    ).toEqual(['create_journal_site_entry']);
  });
});

describe('pack-manifest schemas', () => {
  it('parses a minimal pack manifest', () => {
    const parsed = packManifestSchema.parse({
      id: 'claims-core',
      version: '1.0.0',
      name: 'Claims Operations',
      integrationRefs: ['Claims Operations'],
      agents: [{ file: 'agents/a.yaml' }],
      skills: [{ file: 'skills/s.yaml' }],
    });
    expect(parsed.description).toBe('');
    expect(parsed.prompts).toEqual([]);
  });

  it('parses an agent definition', () => {
    const agent = packAgentSchema.parse({
      slug: 'claims-assistant',
      name: 'Claims Assistant',
      systemPrompt: 'Help with claims.',
      enabledTools: ['search_claims', 'get_*'],
      pinnedSkillSlugs: ['find-claim'],
    });
    expect(agent.provider).toBe('vertex-gemini');
    expect(agent.semanticSkills).toBe('all');
  });

  it('parses a skill definition', () => {
    const skill = packSkillSchema.parse({
      slug: 'find-claim',
      name: 'Find Claim',
      instructionPrompt: 'Search then summarize.',
      requiredToolRefs: [{ integration: 'Claims Operations', tool: 'search_claims' }],
    });
    expect(skill.category).toBe('general');
    expect(skill.invocationMode).toBe('inline');
  });
});

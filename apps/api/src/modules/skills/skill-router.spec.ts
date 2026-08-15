import { resolveInvocationMode } from './skill-router';
import type { SkillConfig, SkillInvocationMode } from './skill.types';

function baseSkill(overrides: Partial<SkillConfig> = {}): SkillConfig {
  return {
    id: 's1',
    tenantId: 't1',
    name: 'Test Skill',
    triggerHints: [],
    instructionPrompt: 'Do the thing.',
    requiredToolRefs: [],
    invocationMode: 'inline',
    includeHistory: true,
    visibility: 'org',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/** Heuristic path: no explicit mode stored on the skill. */
function heuristicSkill(overrides: Partial<SkillConfig> = {}): SkillConfig {
  const skill = baseSkill(overrides);
  delete (skill as { invocationMode?: SkillInvocationMode }).invocationMode;
  return skill;
}

describe('resolveInvocationMode', () => {
  it('honours explicit isolated mode', () => {
    expect(resolveInvocationMode(baseSkill({ invocationMode: 'isolated' }))).toBe(
      'isolated',
    );
  });

  it('honours explicit inline mode even without history', () => {
    expect(
      resolveInvocationMode(
        baseSkill({ invocationMode: 'inline', includeHistory: false }),
      ),
    ).toBe('inline');
  });

  it('honours explicit inline mode even with model override', () => {
    expect(
      resolveInvocationMode(
        baseSkill({
          invocationMode: 'inline',
          modelOverride: 'claude-sonnet-4',
        }),
        'gemini-2.5-flash',
      ),
    ).toBe('inline');
  });

  it('isolates when model override differs from parent', () => {
    expect(
      resolveInvocationMode(
        heuristicSkill({ modelOverride: 'claude-sonnet-4' }),
        'gemini-2.5-flash',
      ),
    ).toBe('isolated');
  });

  it('isolates when output schema is set', () => {
    expect(
      resolveInvocationMode(heuristicSkill({ outputSchema: { type: 'object' } })),
    ).toBe('isolated');
  });

  it('isolates when history is not included', () => {
    expect(resolveInvocationMode(heuristicSkill({ includeHistory: false }))).toBe(
      'isolated',
    );
  });

  it('stays inline by default with history', () => {
    expect(resolveInvocationMode(baseSkill())).toBe('inline');
  });
});
